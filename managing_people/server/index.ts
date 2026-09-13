import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { analysisRequestSchema, analysisResultSchema, MAX_SOURCE_LENGTH } from '../shared/schema.js';

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4173);

type ApiError = Error & { status?: number; code?: string; details?: unknown };
function apiError(status: number, code: string, message: string, details?: unknown): ApiError {
  return Object.assign(new Error(message), { status, code, details });
}

app.disable('x-powered-by');
app.use('/api', express.json({ limit: `${Math.ceil(MAX_SOURCE_LENGTH / 1000) + 5}kb`, type: 'application/json' }));

app.get('/api/health', (_request, response) => response.json({ status: 'ok', aiConfigured: Boolean(process.env.AI_API_KEY && process.env.AI_MODEL) }));

app.post('/api/analyze', async (request, response, next) => {
  try {
    if (!request.is('application/json')) throw apiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'JSON 형식으로 요청해 주세요.');
    const input = analysisRequestSchema.parse(request.body);
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL;
    if (!apiKey || !model) throw apiError(503, 'AI_NOT_CONFIGURED', 'AI 분석 기능이 아직 설정되지 않았습니다.');
    const baseUrl = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    let providerResponse: globalThis.Response;
    try {
      providerResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST', signal: controller.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model, temperature: 0,
          messages: [
            { role: 'system', content: 'Extract only people explicitly present in the source. Never invent contact details, organizations, facts, or relationships. Separate factual history from inferred traits and strategic fit. Use scores from 0 to 10. IDs must use only letters, numbers, underscore, and hyphen. Return JSON only.' },
            { role: 'user', content: input.text },
          ],
          response_format: { type: 'json_schema', json_schema: { name: 'people_analysis', strict: true, schema: analysisJsonSchema } },
        }),
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw apiError(504, 'AI_TIMEOUT', 'AI 서비스 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');
      throw apiError(502, 'AI_UNAVAILABLE', 'AI 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
    } finally { clearTimeout(timer); }
    if (!providerResponse.ok) throw apiError(providerResponse.status === 429 ? 429 : 502, 'AI_PROVIDER_ERROR', 'AI 서비스가 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    const payload = await providerResponse.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw apiError(502, 'AI_OUTPUT_INVALID', 'AI 분석 결과를 읽을 수 없습니다.');
    let parsed: unknown;
    try {
      // Strict provider schemas represent absent optional fields as null; the shared
      // domain contract represents them as omitted values.
      parsed = JSON.parse(content, (_key, value) => value === null ? undefined : value);
    } catch { throw apiError(502, 'AI_OUTPUT_INVALID', 'AI 분석 결과 형식이 올바르지 않습니다.'); }
    const result = analysisResultSchema.safeParse(parsed);
    if (!result.success) throw apiError(502, 'AI_OUTPUT_INVALID', 'AI 분석 결과가 데이터 규칙을 충족하지 않습니다.');
    response.json(result.data);
  } catch (error) { next(error); }
});

app.use('/api', (_request, _response, next) => next(apiError(404, 'API_NOT_FOUND', '요청한 API를 찾을 수 없습니다.')));

if (isProduction) {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const clientDir = path.resolve(currentDir, '../dist/client');
  app.use(express.static(clientDir));
  app.use((request, response, next) => request.method === 'GET' ? response.sendFile(path.join(clientDir, 'index.html')) : next());
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ configFile: path.resolve('vite.config.ts'), server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

app.use((error: ApiError, request: Request, response: Response, _next: NextFunction) => {
  const requestId = crypto.randomUUID();
  if (error instanceof ZodError) return response.status(400).json({ code: 'INVALID_REQUEST', message: '입력값을 확인해 주세요.', details: error.issues.map(({ path, message }) => ({ path: path.join('.'), message })), requestId });
  if ((error as { type?: string }).type === 'entity.too.large') return response.status(413).json({ code: 'PAYLOAD_TOO_LARGE', message: '입력 내용이 허용 크기를 초과했습니다.', requestId });
  const status = error.status ?? 500;
  if (status >= 500) console.error(`[${requestId}] ${error.code ?? 'INTERNAL_ERROR'}: ${error.message}`);
  response.status(status).json({ code: error.code ?? 'INTERNAL_ERROR', message: status >= 500 && !error.code ? '예기치 않은 오류가 발생했습니다.' : error.message, ...(error.details ? { details: error.details } : {}), requestId });
});

app.listen(port, host, () => console.log(`Project Combination Engine: http://${host}:${port}`));

const optionalString = { anyOf: [{ type: 'string', maxLength: 5000 }, { type: 'null' }] };
const analysisJsonSchema = {
  type: 'object', additionalProperties: false, required: ['people', 'connections'],
  properties: {
    people: { type: 'array', maxItems: 100, items: { type: 'object', additionalProperties: false, required: ['id', 'name', 'competencies', 'tags', 'organization', 'email', 'phone', 'energyCost', 'history', 'traits', 'strategicFit'], properties: {
      id: { type: 'string' }, name: { type: 'string' }, organization: optionalString, email: optionalString, phone: optionalString,
      competencies: { type: 'object', additionalProperties: false, required: ['execution', 'analysis', 'entrepreneurship', 'global'], properties: { execution: { type: 'number', minimum: 0, maximum: 10 }, analysis: { type: 'number', minimum: 0, maximum: 10 }, entrepreneurship: { type: 'number', minimum: 0, maximum: 10 }, global: { type: 'number', minimum: 0, maximum: 10 } } },
      tags: { type: 'array', items: { type: 'string' } }, energyCost: { anyOf: [{ type: 'number', minimum: 0, maximum: 10 }, { type: 'null' }] }, history: optionalString, traits: optionalString, strategicFit: optionalString,
    } } },
    connections: { type: 'array', maxItems: 500, items: { type: 'object', additionalProperties: false, required: ['source', 'target', 'strength', 'type', 'description'], properties: { source: { type: 'string' }, target: { type: 'string' }, strength: { type: 'number', minimum: 0, maximum: 10 }, type: optionalString, description: optionalString } } },
  },
};
