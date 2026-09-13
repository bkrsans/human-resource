import { describe, expect, it } from 'vitest';
import { networkSchema, userDataSchema } from './schema';

const person = (id: string) => ({ id, name: id, competencies: { execution: 5, analysis: 6, entrepreneurship: 7, global: 8 }, tags: ['전략'] });
const stamp = '2026-09-13T00:00:00.000Z';

describe('shared data contract', () => {
  it('accepts a valid network', () => {
    expect(networkSchema.safeParse({ id: 'net_a', name: 'A', people: [person('p1'), person('p2')], connections: [{ source: 'p1', target: 'p2', strength: 7 }], createdAt: stamp, updatedAt: stamp }).success).toBe(true);
  });

  it('rejects dangling, duplicate, and self connections', () => {
    const base = { id: 'net_a', name: 'A', people: [person('p1'), person('p2')], createdAt: stamp, updatedAt: stamp };
    expect(networkSchema.safeParse({ ...base, connections: [{ source: 'p1', target: 'missing', strength: 4 }] }).success).toBe(false);
    expect(networkSchema.safeParse({ ...base, connections: [{ source: 'p1', target: 'p2', strength: 4 }, { source: 'p2', target: 'p1', strength: 8 }] }).success).toBe(false);
    expect(networkSchema.safeParse({ ...base, connections: [{ source: 'p1', target: 'p1', strength: 4 }] }).success).toBe(false);
  });

  it('rejects a selected network outside the backup', () => {
    expect(userDataSchema.safeParse({ version: 1, networks: [], selectedNetworkId: 'missing' }).success).toBe(false);
  });
});
