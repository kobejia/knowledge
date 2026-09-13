export const BRIDGE_PROTOCOL = "bridge-lab";
export const BRIDGE_VERSION = 1;

export class BridgeError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "BridgeError";
    this.code = code;
    this.details = details;
  }
}

function assertRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BridgeError("INVALID_MESSAGE", `${label} must be an object`);
  }
}

export function validateEnvelope(message) {
  assertRecord(message, "message");

  if (message.protocol !== BRIDGE_PROTOCOL) {
    throw new BridgeError("INVALID_PROTOCOL", "Unknown bridge protocol");
  }

  if (!Number.isInteger(message.version) || message.version < 1) {
    throw new BridgeError("INVALID_VERSION", "Bridge version must be a positive integer");
  }

  if (!new Set(["request", "response", "event"]).has(message.kind)) {
    throw new BridgeError("INVALID_KIND", "Unknown bridge message kind");
  }

  if (typeof message.sessionId !== "string" || message.sessionId.length < 1) {
    throw new BridgeError("INVALID_SESSION", "Bridge message requires a sessionId");
  }

  if (message.kind === "request") {
    if (typeof message.id !== "string" || message.id.length < 1) {
      throw new BridgeError("INVALID_REQUEST", "Request requires an id");
    }
    if (typeof message.method !== "string" || !/^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/.test(message.method)) {
      throw new BridgeError("INVALID_METHOD", "Request method must use a namespaced name");
    }
    assertRecord(message.params ?? {}, "request params");
  }

  if (message.kind === "response") {
    if (typeof message.id !== "string" || typeof message.ok !== "boolean") {
      throw new BridgeError("INVALID_RESPONSE", "Response requires an id and ok flag");
    }
    if (!message.ok) {
      assertRecord(message.error, "response error");
      if (typeof message.error.code !== "string" || typeof message.error.message !== "string") {
        throw new BridgeError("INVALID_RESPONSE", "Response error requires code and message");
      }
    }
  }

  if (message.kind === "event" && typeof message.name !== "string") {
    throw new BridgeError("INVALID_EVENT", "Event requires a name");
  }

  return message;
}

export function createRequest({ id, sessionId, method, params = {} }) {
  return validateEnvelope({
    protocol: BRIDGE_PROTOCOL,
    version: BRIDGE_VERSION,
    kind: "request",
    sessionId,
    id,
    method,
    params
  });
}

export function createResponse(request, payload) {
  validateEnvelope(request);
  const base = {
    protocol: BRIDGE_PROTOCOL,
    version: BRIDGE_VERSION,
    kind: "response",
    sessionId: request.sessionId,
    id: request.id
  };

  if (payload.ok) {
    return validateEnvelope({ ...base, ok: true, result: payload.result });
  }

  return validateEnvelope({
    ...base,
    ok: false,
    error: {
      code: payload.code,
      message: payload.message,
      retryable: Boolean(payload.retryable)
    }
  });
}

export function createEvent({ sessionId, name, data = {} }) {
  return validateEnvelope({
    protocol: BRIDGE_PROTOCOL,
    version: BRIDGE_VERSION,
    kind: "event",
    sessionId,
    name,
    data
  });
}

export function createBridgeClient({
  sessionId,
  send,
  timeoutMs = 700,
  onDiagnostic = () => {},
  setTimer = setTimeout,
  clearTimer = clearTimeout
}) {
  if (typeof sessionId !== "string" || sessionId.length < 1) {
    throw new BridgeError("INVALID_SESSION", "Bridge client requires a sessionId");
  }
  if (typeof send !== "function") {
    throw new BridgeError("INVALID_TRANSPORT", "Bridge client requires a send function");
  }

  const pending = new Map();
  const listeners = new Map();
  let sequence = 0;
  let active = true;

  function diagnostic(type, detail) {
    onDiagnostic({ type, detail, sessionId, at: Date.now() });
  }

  function call(method, params = {}, options = {}) {
    if (!active) {
      return Promise.reject(new BridgeError("BRIDGE_INVALIDATED", "Bridge session is no longer active"));
    }

    sequence += 1;
    const id = `${sessionId}:${sequence}`;
    const request = createRequest({ id, sessionId, method, params });
    const deadline = options.timeoutMs ?? timeoutMs;

    return new Promise((resolve, reject) => {
      const timer = setTimer(() => {
        if (!pending.delete(id)) return;
        const error = new BridgeError("BRIDGE_TIMEOUT", `${method} did not respond within ${deadline}ms`, {
          id,
          method,
          timeoutMs: deadline
        });
        diagnostic("timeout", { id, method, timeoutMs: deadline });
        reject(error);
      }, deadline);

      pending.set(id, { method, resolve, reject, timer });

      try {
        send(request);
        diagnostic("request-sent", { id, method });
      } catch (error) {
        clearTimer(timer);
        pending.delete(id);
        reject(new BridgeError("TRANSPORT_ERROR", error.message, { id, method }));
      }
    });
  }

  function receive(rawMessage) {
    let message;
    try {
      message = validateEnvelope(rawMessage);
    } catch (error) {
      diagnostic("message-rejected", { code: error.code, message: error.message });
      return false;
    }

    if (message.sessionId !== sessionId) {
      diagnostic("stale-session", { expected: sessionId, received: message.sessionId });
      return false;
    }

    if (message.kind === "event") {
      const eventListeners = listeners.get(message.name) ?? new Set();
      for (const listener of eventListeners) listener(message.data);
      diagnostic("event-received", { name: message.name, listeners: eventListeners.size });
      return true;
    }

    if (message.kind !== "response") {
      diagnostic("message-rejected", { code: "UNEXPECTED_KIND", kind: message.kind });
      return false;
    }

    const request = pending.get(message.id);
    if (!request) {
      diagnostic("late-or-duplicate-response", { id: message.id });
      return false;
    }

    pending.delete(message.id);
    clearTimer(request.timer);

    if (message.ok) {
      request.resolve(message.result);
      diagnostic("request-resolved", { id: message.id, method: request.method });
    } else {
      request.reject(new BridgeError(message.error.code, message.error.message, {
        id: message.id,
        method: request.method,
        retryable: message.error.retryable
      }));
      diagnostic("request-rejected", { id: message.id, method: request.method, code: message.error.code });
    }

    return true;
  }

  function on(name, listener) {
    const eventListeners = listeners.get(name) ?? new Set();
    eventListeners.add(listener);
    listeners.set(name, eventListeners);
    return () => {
      eventListeners.delete(listener);
      if (eventListeners.size === 0) listeners.delete(name);
    };
  }

  function invalidate(reason = "Bridge session was replaced") {
    if (!active) return;
    active = false;
    for (const [id, request] of pending) {
      clearTimer(request.timer);
      request.reject(new BridgeError("BRIDGE_INVALIDATED", reason, { id, method: request.method }));
    }
    const rejected = pending.size;
    pending.clear();
    listeners.clear();
    diagnostic("bridge-invalidated", { reason, rejected });
  }

  function snapshot() {
    return {
      active,
      sessionId,
      pending: [...pending.entries()].map(([id, request]) => ({ id, method: request.method })),
      listeners: [...listeners.entries()].map(([name, set]) => ({ name, count: set.size }))
    };
  }

  return Object.freeze({ call, receive, on, invalidate, snapshot });
}
