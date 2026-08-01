const segment = "^(?!\\.{1,2}$)(?!.*[/\\\\])[A-Za-z0-9][A-Za-z0-9._-]*$";

export const DEPTHS = ["survey", "beginner", "advanced", "deep-dive", "expert"];

export const documentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "title", "path"],
  properties: {
    id: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
    title: { type: "string", minLength: 1 },
    path: { type: "string", pattern: segment }
  }
};

export const categorySchema = {
  $id: "category",
  type: "object",
  additionalProperties: false,
  required: ["id", "title", "path", "children", "documents"],
  properties: {
    id: documentSchema.properties.id,
    title: documentSchema.properties.title,
    path: documentSchema.properties.path,
    children: { type: "array", items: { $ref: "category" } },
    documents: { type: "array", items: documentSchema }
  }
};

export const knowledgeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["version", "classificationMode", "contentRoot", "categories"],
  properties: {
    version: { const: 1 },
    classificationMode: { enum: ["confirm", "automatic"] },
    contentRoot: { const: "learn" },
    categories: { type: "array", minItems: 1, items: { $ref: "category" } }
  }
};
