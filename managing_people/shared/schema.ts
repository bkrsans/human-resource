import { z } from 'zod';

export const SCORE_MIN = 0;
export const SCORE_MAX = 10;
export const MAX_PEOPLE = 500;
export const MAX_NETWORKS = 50;
export const MAX_SOURCE_LENGTH = 50_000;

const idSchema = z.string().trim().min(1).max(80).regex(/^[\w-]+$/, '영문, 숫자, 밑줄, 하이픈만 사용할 수 있습니다.');
const optionalText = (max: number) => z.string().trim().max(max).optional();
const score = z.number().finite().min(SCORE_MIN).max(SCORE_MAX);

export const competenciesSchema = z.object({
  execution: score,
  analysis: score,
  entrepreneurship: score,
  global: score,
}).strict();

export const personSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1, '이름은 필수입니다.').max(100),
  organization: optionalText(150),
  email: z.union([z.literal(''), z.string().email()]).optional(),
  phone: z.union([z.literal(''), z.string().trim().regex(/^[+\d][\d\s().-]{5,24}$/)]).optional(),
  competencies: competenciesSchema,
  tags: z.array(z.string().trim().min(1).max(40)).max(30).transform((tags) => [...new Map(tags.map((tag) => [tag.toLocaleLowerCase(), tag])).values()]),
  energyCost: z.number().finite().min(0).max(10).optional(),
  history: optionalText(5_000),
  traits: optionalText(3_000),
  strategicFit: optionalText(3_000),
}).strict();

export const connectionSchema = z.object({
  source: idSchema,
  target: idSchema,
  strength: z.number().finite().min(0).max(10),
  type: optionalText(80),
  description: optionalText(500),
}).strict();

export const viewportSchema = z.object({ x: z.number().finite(), y: z.number().finite(), zoom: z.number().finite().min(0.35).max(3) }).strict();

export const networkSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(120),
  description: optionalText(500),
  people: z.array(personSchema).max(MAX_PEOPLE),
  connections: z.array(connectionSchema).max(3_000),
  positions: z.record(idSchema, z.object({ x: z.number().finite(), y: z.number().finite() }).strict()).optional(),
  viewport: viewportSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict().superRefine((network, ctx) => {
  const ids = new Set<string>();
  network.people.forEach((person, index) => {
    if (ids.has(person.id)) ctx.addIssue({ code: 'custom', path: ['people', index, 'id'], message: '중복된 인재 ID입니다.' });
    ids.add(person.id);
  });
  const pairs = new Set<string>();
  network.connections.forEach((link, index) => {
    if (link.source === link.target) ctx.addIssue({ code: 'custom', path: ['connections', index], message: '자기 자신과의 관계는 허용되지 않습니다.' });
    if (!ids.has(link.source) || !ids.has(link.target)) ctx.addIssue({ code: 'custom', path: ['connections', index], message: '관계 대상이 인재 목록에 없습니다.' });
    const key = [link.source, link.target].sort().join('::');
    if (pairs.has(key)) ctx.addIssue({ code: 'custom', path: ['connections', index], message: '중복 관계입니다.' });
    pairs.add(key);
  });
});

export const userDataSchema = z.object({
  version: z.literal(1),
  networks: z.array(networkSchema).max(MAX_NETWORKS),
  selectedNetworkId: idSchema.nullable(),
}).strict().superRefine((data, ctx) => {
  const ids = new Set<string>();
  data.networks.forEach((network, index) => {
    if (ids.has(network.id)) ctx.addIssue({ code: 'custom', path: ['networks', index, 'id'], message: '중복된 네트워크 ID입니다.' });
    ids.add(network.id);
  });
  if (data.selectedNetworkId && !ids.has(data.selectedNetworkId)) ctx.addIssue({ code: 'custom', path: ['selectedNetworkId'], message: '선택한 네트워크가 존재하지 않습니다.' });
});

export const analysisRequestSchema = z.object({ text: z.string().trim().min(1).max(MAX_SOURCE_LENGTH) }).strict();
export const analysisResultSchema = z.object({ people: z.array(personSchema).max(100), connections: z.array(connectionSchema).max(500) }).strict().superRefine((result, ctx) => {
  const ids = new Set(result.people.map((person) => person.id));
  if (ids.size !== result.people.length) ctx.addIssue({ code: 'custom', path: ['people'], message: '인재 ID가 중복되었습니다.' });
  result.connections.forEach((link, index) => {
    if (!ids.has(link.source) || !ids.has(link.target)) ctx.addIssue({ code: 'custom', path: ['connections', index], message: '관계 대상이 분석 결과에 없습니다.' });
  });
});

export type Competencies = z.infer<typeof competenciesSchema>;
export type Person = z.infer<typeof personSchema>;
export type Connection = z.infer<typeof connectionSchema>;
export type Network = z.infer<typeof networkSchema>;
export type UserData = z.infer<typeof userDataSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
}

export function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.join('.') || '입력'}: ${issue.message}`).join('\n');
}
