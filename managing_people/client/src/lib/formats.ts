import { networkSchema, userDataSchema, type Connection, type Network, type Person, type UserData } from '../../../shared/schema';

const clean = (value?: string) => value?.replaceAll('\r', '').trim();
const scalar = (value: string) => value.replace(/^\s*-\s*/, '').trim();

export function exportMarkdown(network: Network) {
  const lines = [`# ${network.name}`, '', `Network-ID: ${network.id}`, `Description: ${network.description ?? ''}`, ''];
  for (const person of network.people) {
    lines.push(`## Person: ${person.name}`, `ID: ${person.id}`, `Organization: ${person.organization ?? ''}`, `Email: ${person.email ?? ''}`, `Phone: ${person.phone ?? ''}`,
      `Tags: ${person.tags.join(', ')}`, `Execution: ${person.competencies.execution}`, `Analysis: ${person.competencies.analysis}`,
      `Entrepreneurship: ${person.competencies.entrepreneurship}`, `Global: ${person.competencies.global}`, `Energy-Cost: ${person.energyCost ?? ''}`,
      '### History', person.history ?? '', '### Traits', person.traits ?? '', '### Strategic-Fit', person.strategicFit ?? '', '');
  }
  lines.push('## Connections');
  for (const link of network.connections) lines.push(`- ${link.source} | ${link.target} | ${link.strength} | ${link.type ?? ''} | ${link.description ?? ''}`);
  return lines.join('\n');
}

export function importMarkdown(markdown: string): Network {
  if (markdown.length > 1_000_000) throw new Error('Markdown 파일이 허용 크기를 초과했습니다.');
  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? '가져온 네트워크';
  const networkId = markdown.match(/^Network-ID:\s*(.+)$/mi)?.[1]?.trim() || `net_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
  const description = clean(markdown.match(/^Description:[ \\t]*(.*)$/mi)?.[1]) || undefined;
  const personBlocks = markdown.split(/^## Person:\s*/m).slice(1);
  const people: Person[] = personBlocks.map((block) => {
    const [header, ...rest] = block.split('\n');
    const body = rest.join('\n').split(/^## Connections/m)[0];
    const field = (name: string) => clean(body.match(new RegExp(`^${name}:[ \\t]*(.*)$`, 'mi'))?.[1]);
    const section = (name: string, next?: string) => clean(body.match(new RegExp(`^### ${name}\\s*\\n([\\s\\S]*?)${next ? `(?=^### ${next})` : '(?=^##|$)'}`, 'mi'))?.[1]);
    return {
      id: field('ID') || `person_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`,
      name: header.trim(), organization: field('Organization') || undefined, email: field('Email') || undefined, phone: field('Phone') || undefined,
      tags: (field('Tags') ?? '').split(',').map((tag) => tag.trim()).filter(Boolean),
      competencies: { execution: Number(field('Execution')), analysis: Number(field('Analysis')), entrepreneurship: Number(field('Entrepreneurship')), global: Number(field('Global')) },
      energyCost: field('Energy-Cost') ? Number(field('Energy-Cost')) : undefined,
      history: section('History', 'Traits') || undefined, traits: section('Traits', 'Strategic-Fit') || undefined, strategicFit: section('Strategic-Fit') || undefined,
    };
  });
  const connectionText = markdown.split(/^## Connections\s*$/m)[1] ?? '';
  const connections: Connection[] = connectionText.split('\n').map(scalar).filter(Boolean).map((line) => {
    const [source, target, strength, type, descriptionValue] = line.split('|').map((part) => part.trim());
    return { source, target, strength: Number(strength), type: type || undefined, description: descriptionValue || undefined };
  });
  const now = new Date().toISOString();
  const result = networkSchema.safeParse({ id: networkId, name: title, description, people, connections, createdAt: now, updatedAt: now });
  if (!result.success) throw new Error(result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n'));
  return networkSchema.parse(JSON.parse(JSON.stringify(result.data)));
}

export function exportBackup(data: UserData) {
  return JSON.stringify(userDataSchema.parse(data), null, 2);
}

export function importBackup(json: string) {
  if (json.length > 5_000_000) throw new Error('백업 파일이 허용 크기를 초과했습니다.');
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new Error('올바른 JSON 파일이 아닙니다.'); }
  const result = userDataSchema.safeParse(parsed);
  if (!result.success) throw new Error(result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n'));
  return result.data;
}

export function downloadText(filename: string, value: string, type: string) {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}
