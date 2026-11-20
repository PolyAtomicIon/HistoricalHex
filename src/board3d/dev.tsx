// Временная песочница для ручной проверки (нигде не подключена): открыть /src/board3d/dev.html в `npm run dev`.
import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { generateBoard, seededRng, topologyFor } from '../engine';
import Board3D, { type BoardMode } from './Board3D';

function App() {
  const [mode, setMode] = useState<BoardMode>('25d');
  const [k, setK] = useState(0);
  const [shake, setShake] = useState(0);
  const [low, setLow] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const { board, robberHex } = useMemo(() => generateBoard("standard", seededRng(7)), []);
  const topo = topologyFor('standard');
  const [robber, setRobber] = useState(robberHex);
  const vs = [...topo.vertices.values()];
  const es = [...topo.edges.values()];
  const view = {
    board,
    robberHex: robber,
    buildings: { [vs[10].id]: { owner: 'a', kind: 'settlement' as const }, [vs[30].id]: { owner: 'b', kind: 'city' as const }, [vs[22].id]: { owner: 'c', kind: 'settlement' as const } },
    roads: { [es[12].id]: 'a', [es[14].id]: 'b', [es[40].id]: 'c' },
  };
  const hexes = board.hexes.map((h) => h.id);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 6, display: 'flex', gap: 6, flexWrap: 'wrap', background: '#fff8' }}>
        {(['2d', '25d', '3d'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} style={{ fontWeight: m === mode ? 700 : 400 }}>{m}</button>
        ))}
        <button onClick={() => setK(k + 1)}>focus/flash</button>
        <button onClick={() => setShake(shake + 1)}>shake</button>
        <button onClick={() => setRecent([vs[10].id, es[12].id])}>recent</button>
        <button onClick={() => setRobber(hexes[(hexes.indexOf(robber) + 5) % hexes.length])}>robber</button>
        <label><input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} />low</label>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Board3D
          mode={mode}
          lowPower={low}
          view={view}
          colors={{ a: 'red', b: 'blue', c: 'orange' }}
          highlight={{ vertices: vs.slice(40, 46).map((v) => v.id), edges: es.slice(60, 64).map((e) => e.id), hexes: [hexes[3]] }}
          selected={vs[42].id}
          recent={recent}
          flash={{ hexes: hexes.slice(0, 4), key: k }}
          focus={{ vertex: vs[30].id, key: k }}
          shake={shake}
          ghosts={[{ vertex: vs[50].id, kind: 'settlement', color: 'green' }, { edge: es[70].id, kind: 'road', color: 'green' }, { vertex: vs[52].id, kind: 'city', color: 'purple', broken: true }]}
          onVertex={(v) => console.log('vertex', v)}
          onEdge={(e) => console.log('edge', e)}
          onHex={(h) => console.log('hex', h)}
        />
      </div>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
