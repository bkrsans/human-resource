import { describe, expect, it } from 'vitest';
import { exportBackup, exportMarkdown, importBackup, importMarkdown } from './formats';
import type { Network, UserData } from '../../../shared/schema';

const network: Network = {
  id: 'net_roundtrip', name: '왕복 테스트', description: '설명', createdAt: '2026-09-13T00:00:00.000Z', updatedAt: '2026-09-13T00:00:00.000Z',
  people: [
    { id: 'person_a', name: '홍길동', organization: '전략실', email: 'hong@example.com', competencies: { execution: 8, analysis: 7, entrepreneurship: 6, global: 5 }, tags: ['전략', '운영'], energyCost: 4, history: '출시를 주도함', traits: '차분함', strategicFit: '운영 리드' },
    { id: 'person_b', name: '김영희', competencies: { execution: 5, analysis: 9, entrepreneurship: 7, global: 8 }, tags: ['리서치'] },
  ], connections: [{ source: 'person_a', target: 'person_b', strength: 7, type: '협업', description: '프로젝트 협업' }],
};

describe('import/export', () => {
  it('round-trips Markdown without losing profile meaning', () => {
    const restored = importMarkdown(exportMarkdown(network));
    expect(restored.name).toBe(network.name);
    expect(restored.people).toEqual(network.people);
    expect(restored.connections).toEqual(network.connections);
  });

  it('round-trips a JSON backup and rejects future versions', () => {
    const data: UserData = { version: 1, networks: [network], selectedNetworkId: network.id };
    expect(importBackup(exportBackup(data))).toEqual(data);
    expect(() => importBackup('{"version":2,"networks":[],"selectedNetworkId":null}')).toThrow();
  });

  it('does not accept dangling Markdown relationships', () => {
    expect(() => importMarkdown(`${exportMarkdown(network)}\n- person_a | missing | 5 | 협업 | 오류`)).toThrow();
  });
});
