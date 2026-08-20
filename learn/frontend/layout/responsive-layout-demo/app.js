const lab = document.querySelector(".lab");
const strategySelect = document.querySelector("#strategy");
const widthInput = document.querySelector("#host-width");
const widthOutput = document.querySelector("#host-width-output");
const contentSelect = document.querySelector("#content-profile");
const explanation = document.querySelector("#strategy-explanation");
const template = document.querySelector("#card-template");
const hosts = [...document.querySelectorAll(".card-host")];

const strategyCopy = {
  viewport:
    "媒体查询观察页面视口。页面超过 60rem 后，两张卡片都会进入双列；窄宿主可能出现“宿主错配”。",
  intrinsic:
    "内在 Grid 不查询任何断点。每一列至少需要 17rem，宿主容不下两列时自动回到单列。",
  container:
    "容器查询观察每张卡片的宿主。宿主达到 34rem 才进入双列，与页面视口和另一张卡片无关。"
};

const profiles = {
  normal: {
    dir: "ltr",
    title: "A component should respond to the space it actually owns",
    description:
      "Viewport width is a page-level signal. A reusable component needs a contract that survives sidebars, dialogs and split panes.",
    token: "layout-contract://card/inline-size/34rem"
  },
  stress: {
    dir: "ltr",
    title: "Long content exposes constraints that polished device presets hide",
    description:
      "The same component must survive translated copy, large numbers, missing media and identifiers that have no convenient soft-wrap opportunity.",
    token:
      "tenant_eu-central-1__responsive-component-contract__2026-08-18T23:59:59.999Z"
  },
  rtl: {
    dir: "rtl",
    title: "يجب أن يستجيب المكوّن للمساحة التي يملكها فعلاً",
    description:
      "تختبر هذه العينة ترتيب القراءة والخصائص المنطقية وتمدد النص داخل المضيف نفسه.",
    token: "عقد-التخطيط://بطاقة/الحجم-المنطقي/34rem"
  }
};

for (const host of hosts) {
  host.append(template.content.cloneNode(true));
}

function applyProfile(name) {
  const profile = profiles[name];
  for (const card of document.querySelectorAll(".responsive-card")) {
    card.dir = profile.dir;
    card.querySelector(".card-title").textContent = profile.title;
    card.querySelector(".card-description").textContent = profile.description;
    card.querySelector(".card-token").textContent = profile.token;
  }
}

function countGridTracks(card) {
  const tracks = getComputedStyle(card).gridTemplateColumns.trim();
  return tracks ? tracks.split(/\s+/).length : 1;
}

function hasOverflow(element) {
  if (element.scrollWidth > element.clientWidth + 1) return true;
  return [...element.querySelectorAll("*")].some(
    (child) => child.scrollWidth > child.clientWidth + 1
  );
}

function updateStatus() {
  for (const host of hosts) {
    const card = host.querySelector(".responsive-card");
    const width = Math.round(host.getBoundingClientRect().width);
    const tracks = countGridTracks(card);
    const overflow = hasOverflow(card);
    const mismatch = lab.dataset.strategy === "viewport" && width < 544 && tracks > 1;
    const status = document.querySelector(`#${host.dataset.host}-status`);

    status.dataset.state = mismatch ? "mismatch" : overflow ? "overflow" : "ok";
    status.textContent = [
      `${width}px`,
      `${tracks} 列`,
      mismatch ? "宿主错配" : "上下文匹配",
      overflow ? "存在溢出" : "无溢出"
    ].join(" · ");
  }
}

function nextFrameStatus() {
  requestAnimationFrame(() => requestAnimationFrame(updateStatus));
}

strategySelect.addEventListener("change", () => {
  lab.dataset.strategy = strategySelect.value;
  explanation.textContent = strategyCopy[strategySelect.value];
  nextFrameStatus();
});

widthInput.addEventListener("input", () => {
  const value = `${widthInput.value}px`;
  document.documentElement.style.setProperty("--host-size", value);
  widthOutput.value = value;
  nextFrameStatus();
});

contentSelect.addEventListener("change", () => {
  applyProfile(contentSelect.value);
  nextFrameStatus();
});

const resizeObserver = new ResizeObserver(updateStatus);
for (const host of hosts) resizeObserver.observe(host, { box: "border-box" });

explanation.textContent = strategyCopy[strategySelect.value];
applyProfile(contentSelect.value);
updateStatus();
