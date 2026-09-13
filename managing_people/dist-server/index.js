// server/index.ts
import crypto2 from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { ZodError } from "zod";

// shared/schema.ts
import { z } from "zod";
var SCORE_MIN = 0;
var SCORE_MAX = 10;
var MAX_PEOPLE = 500;
var MAX_NETWORKS = 50;
var MAX_SOURCE_LENGTH = 5e4;
var idSchema = z.string().trim().min(1).max(80).regex(/^[\w-]+$/, "\uC601\uBB38, \uC22B\uC790, \uBC11\uC904, \uD558\uC774\uD508\uB9CC \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
var optionalText = (max) => z.string().trim().max(max).optional();
var score = z.number().finite().min(SCORE_MIN).max(SCORE_MAX);
var competenciesSchema = z.object({
  execution: score,
  analysis: score,
  entrepreneurship: score,
  global: score
}).strict();
var personSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1, "\uC774\uB984\uC740 \uD544\uC218\uC785\uB2C8\uB2E4.").max(100),
  organization: optionalText(150),
  email: z.union([z.literal(""), z.string().email()]).optional(),
  phone: z.union([z.literal(""), z.string().trim().regex(/^[+\d][\d\s().-]{5,24}$/)]).optional(),
  competencies: competenciesSchema,
  tags: z.array(z.string().trim().min(1).max(40)).max(30).transform((tags) => [...new Map(tags.map((tag) => [tag.toLocaleLowerCase(), tag])).values()]),
  energyCost: z.number().finite().min(0).max(10).optional(),
  history: optionalText(5e3),
  traits: optionalText(3e3),
  strategicFit: optionalText(3e3)
}).strict();
var connectionSchema = z.object({
  source: idSchema,
  target: idSchema,
  strength: z.number().finite().min(0).max(10),
  type: optionalText(80),
  description: optionalText(500)
}).strict();
var viewportSchema = z.object({ x: z.number().finite(), y: z.number().finite(), zoom: z.number().finite().min(0.35).max(3) }).strict();
var networkSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(120),
  description: optionalText(500),
  people: z.array(personSchema).max(MAX_PEOPLE),
  connections: z.array(connectionSchema).max(3e3),
  positions: z.record(idSchema, z.object({ x: z.number().finite(), y: z.number().finite() }).strict()).optional(),
  viewport: viewportSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict().superRefine((network, ctx) => {
  const ids = /* @__PURE__ */ new Set();
  network.people.forEach((person, index) => {
    if (ids.has(person.id)) ctx.addIssue({ code: "custom", path: ["people", index, "id"], message: "\uC911\uBCF5\uB41C \uC778\uC7AC ID\uC785\uB2C8\uB2E4." });
    ids.add(person.id);
  });
  const pairs = /* @__PURE__ */ new Set();
  network.connections.forEach((link, index) => {
    if (link.source === link.target) ctx.addIssue({ code: "custom", path: ["connections", index], message: "\uC790\uAE30 \uC790\uC2E0\uACFC\uC758 \uAD00\uACC4\uB294 \uD5C8\uC6A9\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." });
    if (!ids.has(link.source) || !ids.has(link.target)) ctx.addIssue({ code: "custom", path: ["connections", index], message: "\uAD00\uACC4 \uB300\uC0C1\uC774 \uC778\uC7AC \uBAA9\uB85D\uC5D0 \uC5C6\uC2B5\uB2C8\uB2E4." });
    const key = [link.source, link.target].sort().join("::");
    if (pairs.has(key)) ctx.addIssue({ code: "custom", path: ["connections", index], message: "\uC911\uBCF5 \uAD00\uACC4\uC785\uB2C8\uB2E4." });
    pairs.add(key);
  });
});
var userDataSchema = z.object({
  version: z.literal(1),
  networks: z.array(networkSchema).max(MAX_NETWORKS),
  selectedNetworkId: idSchema.nullable()
}).strict().superRefine((data, ctx) => {
  const ids = /* @__PURE__ */ new Set();
  data.networks.forEach((network, index) => {
    if (ids.has(network.id)) ctx.addIssue({ code: "custom", path: ["networks", index, "id"], message: "\uC911\uBCF5\uB41C \uB124\uD2B8\uC6CC\uD06C ID\uC785\uB2C8\uB2E4." });
    ids.add(network.id);
  });
  if (data.selectedNetworkId && !ids.has(data.selectedNetworkId)) ctx.addIssue({ code: "custom", path: ["selectedNetworkId"], message: "\uC120\uD0DD\uD55C \uB124\uD2B8\uC6CC\uD06C\uAC00 \uC874\uC7AC\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." });
});
var analysisRequestSchema = z.object({ text: z.string().trim().min(1).max(MAX_SOURCE_LENGTH) }).strict();
var analysisResultSchema = z.object({ people: z.array(personSchema).max(100), connections: z.array(connectionSchema).max(500) }).strict().superRefine((result, ctx) => {
  const ids = new Set(result.people.map((person) => person.id));
  if (ids.size !== result.people.length) ctx.addIssue({ code: "custom", path: ["people"], message: "\uC778\uC7AC ID\uAC00 \uC911\uBCF5\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  result.connections.forEach((link, index) => {
    if (!ids.has(link.source) || !ids.has(link.target)) ctx.addIssue({ code: "custom", path: ["connections", index], message: "\uAD00\uACC4 \uB300\uC0C1\uC774 \uBD84\uC11D \uACB0\uACFC\uC5D0 \uC5C6\uC2B5\uB2C8\uB2E4." });
  });
});

// server/index.ts
var app = express();
var isProduction = process.env.NODE_ENV === "production";
var host = process.env.HOST || "127.0.0.1";
var port = Number(process.env.PORT || 4173);
function apiError(status, code, message, details) {
  return Object.assign(new Error(message), { status, code, details });
}
app.disable("x-powered-by");
app.use("/api", express.json({ limit: `${Math.ceil(MAX_SOURCE_LENGTH / 1e3) + 5}kb`, type: "application/json" }));
app.get("/api/health", (_request, response) => response.json({ status: "ok", aiConfigured: Boolean(process.env.AI_API_KEY && process.env.AI_MODEL) }));
app.post("/api/analyze", async (request, response, next) => {
  try {
    if (!request.is("application/json")) throw apiError(415, "UNSUPPORTED_MEDIA_TYPE", "JSON \uD615\uC2DD\uC73C\uB85C \uC694\uCCAD\uD574 \uC8FC\uC138\uC694.");
    const input = analysisRequestSchema.parse(request.body);
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL;
    if (!apiKey || !model) throw apiError(503, "AI_NOT_CONFIGURED", "AI \uBD84\uC11D \uAE30\uB2A5\uC774 \uC544\uC9C1 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
    const baseUrl = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45e3);
    let providerResponse;
    try {
      providerResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            { role: "system", content: "Extract only people explicitly present in the source. Never invent contact details, organizations, facts, or relationships. Separate factual history from inferred traits and strategic fit. Use scores from 0 to 10. IDs must use only letters, numbers, underscore, and hyphen. Return JSON only." },
            { role: "user", content: input.text }
          ],
          response_format: { type: "json_schema", json_schema: { name: "people_analysis", strict: true, schema: analysisJsonSchema } }
        })
      });
    } catch (error) {
      if (error.name === "AbortError") throw apiError(504, "AI_TIMEOUT", "AI \uC11C\uBE44\uC2A4 \uC751\uB2F5 \uC2DC\uAC04\uC774 \uCD08\uACFC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
      throw apiError(502, "AI_UNAVAILABLE", "AI \uC11C\uBE44\uC2A4\uC5D0 \uC5F0\uACB0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
    } finally {
      clearTimeout(timer);
    }
    if (!providerResponse.ok) throw apiError(providerResponse.status === 429 ? 429 : 502, "AI_PROVIDER_ERROR", "AI \uC11C\uBE44\uC2A4\uAC00 \uC694\uCCAD\uC744 \uCC98\uB9AC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
    const payload = await providerResponse.json();
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw apiError(502, "AI_OUTPUT_INVALID", "AI \uBD84\uC11D \uACB0\uACFC\uB97C \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    let parsed;
    try {
      parsed = JSON.parse(content, (_key, value) => value === null ? void 0 : value);
    } catch {
      throw apiError(502, "AI_OUTPUT_INVALID", "AI \uBD84\uC11D \uACB0\uACFC \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
    }
    const result = analysisResultSchema.safeParse(parsed);
    if (!result.success) throw apiError(502, "AI_OUTPUT_INVALID", "AI \uBD84\uC11D \uACB0\uACFC\uAC00 \uB370\uC774\uD130 \uADDC\uCE59\uC744 \uCDA9\uC871\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
    response.json(result.data);
  } catch (error) {
    next(error);
  }
});
app.use("/api", (_request, _response, next) => next(apiError(404, "API_NOT_FOUND", "\uC694\uCCAD\uD55C API\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.")));
if (isProduction) {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const clientDir = path.resolve(currentDir, "../dist/client");
  app.use(express.static(clientDir));
  app.use((request, response, next) => request.method === "GET" ? response.sendFile(path.join(clientDir, "index.html")) : next());
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({ configFile: path.resolve("vite.config.ts"), server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
}
app.use((error, request, response, _next) => {
  const requestId = crypto2.randomUUID();
  if (error instanceof ZodError) return response.status(400).json({ code: "INVALID_REQUEST", message: "\uC785\uB825\uAC12\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.", details: error.issues.map(({ path: path2, message }) => ({ path: path2.join("."), message })), requestId });
  if (error.type === "entity.too.large") return response.status(413).json({ code: "PAYLOAD_TOO_LARGE", message: "\uC785\uB825 \uB0B4\uC6A9\uC774 \uD5C8\uC6A9 \uD06C\uAE30\uB97C \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4.", requestId });
  const status = error.status ?? 500;
  if (status >= 500) console.error(`[${requestId}] ${error.code ?? "INTERNAL_ERROR"}: ${error.message}`);
  response.status(status).json({ code: error.code ?? "INTERNAL_ERROR", message: status >= 500 && !error.code ? "\uC608\uAE30\uCE58 \uC54A\uC740 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." : error.message, ...error.details ? { details: error.details } : {}, requestId });
});
app.listen(port, host, () => console.log(`Project Combination Engine: http://${host}:${port}`));
var optionalString = { anyOf: [{ type: "string", maxLength: 5e3 }, { type: "null" }] };
var analysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["people", "connections"],
  properties: {
    people: { type: "array", maxItems: 100, items: { type: "object", additionalProperties: false, required: ["id", "name", "competencies", "tags", "organization", "email", "phone", "energyCost", "history", "traits", "strategicFit"], properties: {
      id: { type: "string" },
      name: { type: "string" },
      organization: optionalString,
      email: optionalString,
      phone: optionalString,
      competencies: { type: "object", additionalProperties: false, required: ["execution", "analysis", "entrepreneurship", "global"], properties: { execution: { type: "number", minimum: 0, maximum: 10 }, analysis: { type: "number", minimum: 0, maximum: 10 }, entrepreneurship: { type: "number", minimum: 0, maximum: 10 }, global: { type: "number", minimum: 0, maximum: 10 } } },
      tags: { type: "array", items: { type: "string" } },
      energyCost: { anyOf: [{ type: "number", minimum: 0, maximum: 10 }, { type: "null" }] },
      history: optionalString,
      traits: optionalString,
      strategicFit: optionalString
    } } },
    connections: { type: "array", maxItems: 500, items: { type: "object", additionalProperties: false, required: ["source", "target", "strength", "type", "description"], properties: { source: { type: "string" }, target: { type: "string" }, strength: { type: "number", minimum: 0, maximum: 10 }, type: optionalString, description: optionalString } } }
  }
};
