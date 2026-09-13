import { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, Scan } from 'lucide-react';
import type { Network } from '../../../shared/schema';

type Point = { x: number; y: number };
type Drag = { kind: 'node'; id: string } | { kind: 'pan'; startX: number; startY: number; originX: number; originY: number } | null;

export function NetworkGraph({ network, selectedId, onSelect, onPositions, onViewport }: {
  network: Network; selectedId: string | null; onSelect: (id: string) => void;
  onPositions: (positions: Record<string, Point>) => void;
  onViewport: (viewport: { x: number; y: number; zoom: number }) => void;
}) {
  const frame = useRef<SVGSVGElement>(null);
  const [positions, setPositions] = useState<Record<string, Point>>({});
  const [view, setView] = useState(network.viewport ?? { x: 0, y: 0, zoom: 1 });
  const drag = useRef<Drag>(null);

  useEffect(() => {
    const existing = network.positions ?? {};
    const next: Record<string, Point> = {};
    network.people.forEach((person, index) => {
      const angle = index / Math.max(network.people.length, 1) * Math.PI * 2 - Math.PI / 2;
      next[person.id] = existing[person.id] ?? { x: 350 + Math.cos(angle) * Math.min(220, 70 + network.people.length * 12), y: 240 + Math.sin(angle) * Math.min(170, 60 + network.people.length * 8) };
    });
    // A bounded force pass makes imported graphs readable without keeping an animation loop alive.
    for (let tick = 0; tick < Math.min(50, network.people.length * 5); tick++) {
      const delta: Record<string, Point> = Object.fromEntries(network.people.map((person) => [person.id, { x: 0, y: 0 }]));
      for (let i = 0; i < network.people.length; i++) for (let j = i + 1; j < network.people.length; j++) {
        const a = next[network.people[i].id], b = next[network.people[j].id]; const dx = a.x - b.x, dy = a.y - b.y; const distance = Math.max(20, Math.hypot(dx, dy));
        const force = Math.min(3, 700 / (distance * distance)); delta[network.people[i].id].x += dx / distance * force; delta[network.people[i].id].y += dy / distance * force; delta[network.people[j].id].x -= dx / distance * force; delta[network.people[j].id].y -= dy / distance * force;
      }
      network.connections.forEach((link) => { const a = next[link.source], b = next[link.target]; if (!a || !b) return; const dx = b.x - a.x, dy = b.y - a.y; const distance = Math.max(1, Math.hypot(dx, dy)); const force = (distance - 130) * .008; delta[link.source].x += dx / distance * force; delta[link.source].y += dy / distance * force; delta[link.target].x -= dx / distance * force; delta[link.target].y -= dy / distance * force; });
      network.people.forEach((person) => { if (!existing[person.id]) { next[person.id].x += delta[person.id].x; next[person.id].y += delta[person.id].y; } });
    }
    setPositions(next); setView(network.viewport ?? { x: 0, y: 0, zoom: 1 });
  }, [network.id, network.people.length, network.connections.length]);

  const connected = useMemo(() => {
    const ids = new Set<string>();
    if (selectedId) network.connections.forEach((link) => { if (link.source === selectedId) ids.add(link.target); if (link.target === selectedId) ids.add(link.source); });
    return ids;
  }, [network.connections, selectedId]);

  const graphPoint = (event: React.PointerEvent) => {
    const rect = frame.current!.getBoundingClientRect();
    return { x: (event.clientX - rect.left - view.x) / view.zoom, y: (event.clientY - rect.top - view.y) / view.zoom };
  };
  const onMove = (event: React.PointerEvent) => {
    if (!drag.current) return;
    if (drag.current.kind === 'node') { const at = graphPoint(event); setPositions((old) => ({ ...old, [drag.current && drag.current.kind === 'node' ? drag.current.id : '']: at })); }
    else setView((old) => ({ ...old, x: drag.current && drag.current.kind === 'pan' ? drag.current.originX + event.clientX - drag.current.startX : old.x, y: drag.current && drag.current.kind === 'pan' ? drag.current.originY + event.clientY - drag.current.startY : old.y }));
  };
  const endDrag = () => { if (drag.current?.kind === 'node') onPositions(positions); else if (drag.current?.kind === 'pan') onViewport(view); drag.current = null; };
  const zoom = (factor: number) => { const next = { ...view, zoom: Math.max(.35, Math.min(3, view.zoom * factor)) }; setView(next); onViewport(next); };
  const reset = () => { const next = { x: 0, y: 0, zoom: 1 }; setView(next); onViewport(next); };

  if (!network.people.length) return <div className="graph-empty"><div className="empty-orbit" /><h3>아직 연결할 인재가 없습니다</h3><p>인재 풀에서 첫 프로필을 추가해 보세요.</p></div>;
  return <div className="graph-shell">
    <div className="graph-controls" aria-label="그래프 보기 제어"><button onClick={() => zoom(1.2)} aria-label="확대"><Plus size={17} /></button><button onClick={() => zoom(.8)} aria-label="축소"><Minus size={17} /></button><button onClick={reset} aria-label="화면 맞춤"><Scan size={17} /></button></div>
    <svg ref={frame} className="network-canvas" viewBox="0 0 700 480" role="img" aria-label={`${network.name} 관계망. 인재 ${network.people.length}명, 관계 ${network.connections.length}개`}
      onWheel={(event) => { event.preventDefault(); zoom(event.deltaY < 0 ? 1.1 : .9); }}
      onPointerDown={(event) => { if (event.target === event.currentTarget) { drag.current = { kind: 'pan', startX: event.clientX, startY: event.clientY, originX: view.x, originY: view.y }; event.currentTarget.setPointerCapture(event.pointerId); } }}
      onPointerMove={onMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
      <g transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
        {network.connections.map((link) => { const a = positions[link.source], b = positions[link.target]; if (!a || !b) return null; const active = !selectedId || link.source === selectedId || link.target === selectedId; return <line key={`${link.source}-${link.target}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`graph-link ${active ? 'active' : 'muted'}`} strokeWidth={1 + link.strength / 3}><title>{link.type || '관계'} · 강도 {link.strength}</title></line>; })}
        {network.people.map((person) => { const at = positions[person.id]; if (!at) return null; const active = !selectedId || selectedId === person.id || connected.has(person.id); return <g key={person.id} transform={`translate(${at.x} ${at.y})`} className={`graph-node ${active ? 'active' : 'muted'} ${selectedId === person.id ? 'selected' : ''}`} role="button" tabIndex={0} aria-label={`${person.name} 선택`} onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && onSelect(person.id)} onClick={() => onSelect(person.id)} onPointerDown={(event) => { event.stopPropagation(); drag.current = { kind: 'node', id: person.id }; (event.currentTarget.ownerSVGElement as SVGSVGElement).setPointerCapture(event.pointerId); }}>
          <circle r="27" /><text textAnchor="middle" dy="4">{person.name.slice(0, 4)}</text><text className="node-tag" textAnchor="middle" y="42">{person.tags[0] ?? person.organization ?? ''}</text>
        </g>; })}
      </g>
    </svg>
    <div className="sr-only">{network.connections.map((link) => `${network.people.find((p) => p.id === link.source)?.name}와 ${network.people.find((p) => p.id === link.target)?.name}, ${link.type ?? '관계'}, 강도 ${link.strength}`).join('. ')}</div>
  </div>;
}
