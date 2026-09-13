import type { Person } from '../../../shared/schema';

const axes = [
  { key: 'execution', label: '실행력', x: 150, y: 20 },
  { key: 'analysis', label: '분석·연구', x: 280, y: 150 },
  { key: 'entrepreneurship', label: '창업가', x: 150, y: 280 },
  { key: 'global', label: '글로벌', x: 20, y: 150 },
] as const;

export function Radar({ person }: { person: Person }) {
  const center = 150; const radius = 96;
  const point = (index: number, ratio: number) => { const angle = -Math.PI / 2 + index * Math.PI / 2; return `${center + Math.cos(angle) * radius * ratio},${center + Math.sin(angle) * radius * ratio}`; };
  const polygon = axes.map((axis, index) => point(index, person.competencies[axis.key] / 10)).join(' ');
  return <div className="radar-wrap"><svg viewBox="0 0 300 300" role="img" aria-label={`${person.name}의 네 가지 핵심 역량 레이더 차트`}>
    {[.25,.5,.75,1].map((level) => <polygon key={level} points={axes.map((_, index) => point(index, level)).join(' ')} className="radar-grid" />)}
    {axes.map((axis) => <line key={axis.key} x1={center} y1={center} x2={axis.x} y2={axis.y} className="radar-axis" />)}<polygon points={polygon} className="radar-value" />{axes.map((axis, index) => <g key={axis.key}><circle cx={point(index, person.competencies[axis.key] / 10).split(',')[0]} cy={point(index, person.competencies[axis.key] / 10).split(',')[1]} r="4" className="radar-point" /><text x={axis.x} y={axis.y + (index === 0 ? -4 : index === 2 ? 15 : 4)} textAnchor={index === 1 ? 'end' : index === 3 ? 'start' : 'middle'}>{axis.label}</text></g>)}</svg><dl>{axes.map((axis) => <div key={axis.key}><dt>{axis.label}</dt><dd>{person.competencies[axis.key]} / 10</dd></div>)}</dl></div>;
}
