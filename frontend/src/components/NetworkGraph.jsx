import { useMemo } from "react";

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

function scoreColor(s) {
  if (s >= 90) return "var(--mint)";
  if (s >= 70) return "var(--blue)";
  return "var(--text-dim)";
}

export default function NetworkGraph({ user, candidates, selectedIdx, onSelect }) {
  const W = 640;
  const H = 560;
  const cx = W / 2;
  const cy = H / 2;
  const radius = 210;

  const layout = useMemo(() => {
    return candidates.map((c, i) => {
      const angle = (i / Math.max(candidates.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      // Bridge position: midpoint offset toward outside
      const mx = (cx + x) / 2;
      const my = (cy + y) / 2;
      return { x, y, mx, my, angle };
    });
  }, [candidates]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ maxHeight: 620 }} data-testid="network-graph">
      {/* Edges first (under nodes) */}
      {candidates.map((c, i) => {
        const p = layout[i];
        const hasBridge = (c.bridges && c.bridges.length > 0) || c.shared_schools?.length > 0 || c.shared_employers?.length > 0;
        const label =
          c.bridges?.[0]?.name ? `both liked by ${c.bridges[0].name.split(" ")[0]}` : c.shared_schools?.[0] || c.shared_employers?.[0] || "";
        const isSel = i === selectedIdx;
        return (
          <g key={`edge-${i}`}>
            {hasBridge ? (
              <>
                <line
                  x1={cx} y1={cy} x2={p.mx} y2={p.my}
                  stroke={isSel ? "var(--mint)" : "rgba(255,255,255,0.18)"}
                  strokeWidth={isSel ? 1.5 : 1}
                  strokeDasharray="4 4"
                  style={{
                    strokeDasharray: "1000",
                    strokeDashoffset: "1000",
                    animation: `sn-draw 900ms ${180 + i * 120}ms forwards ease-out`,
                  }}
                />
                <line
                  x1={p.mx} y1={p.my} x2={p.x} y2={p.y}
                  stroke={isSel ? "var(--mint)" : "rgba(255,255,255,0.18)"}
                  strokeWidth={isSel ? 1.5 : 1}
                  strokeDasharray="4 4"
                  style={{
                    strokeDasharray: "1000",
                    strokeDashoffset: "1000",
                    animation: `sn-draw 900ms ${260 + i * 120}ms forwards ease-out`,
                  }}
                />
              </>
            ) : (
              <line
                x1={cx} y1={cy} x2={p.x} y2={p.y}
                stroke={isSel ? "var(--mint)" : "rgba(255,255,255,0.14)"}
                strokeWidth={isSel ? 1.5 : 1}
                style={{
                  strokeDasharray: "1000",
                  strokeDashoffset: "1000",
                  animation: `sn-draw 900ms ${180 + i * 120}ms forwards ease-out`,
                }}
              />
            )}
            {label && (
              <text
                x={(cx + p.x) / 2}
                y={(cy + p.y) / 2 - 10}
                textAnchor="middle"
                fill="var(--text-mute)"
                fontFamily="var(--font-mono)"
                fontSize="9"
                style={{ opacity: 0, animation: `sn-pop 400ms ${600 + i * 120}ms forwards` }}
              >
                {label}
              </text>
            )}
          </g>
        );
      })}

      {/* Bridge nodes */}
      {candidates.map((c, i) => {
        const p = layout[i];
        const hasBridge = (c.bridges && c.bridges.length > 0) || c.shared_schools?.length > 0 || c.shared_employers?.length > 0;
        if (!hasBridge) return null;
        const name = c.bridges?.[0]?.name || c.shared_schools?.[0] || c.shared_employers?.[0] || "";
        return (
          <g key={`bridge-${i}`} className="sn-pop" style={{ animationDelay: `${450 + i * 120}ms` }}>
            <circle
              cx={p.mx} cy={p.my} r="20"
              fill="var(--bg-elev)"
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <text x={p.mx} y={p.my + 4} textAnchor="middle" fill="var(--text-dim)" fontSize="10" fontFamily="var(--font-mono)">
              {initials(name)}
            </text>
          </g>
        );
      })}

      {/* Candidate nodes */}
      {candidates.map((c, i) => {
        const p = layout[i];
        const color = scoreColor(c.score);
        const isSel = i === selectedIdx;
        return (
          <g
            key={`cand-${i}`}
            className="sn-pop"
            style={{ cursor: "pointer", animationDelay: `${200 + i * 120}ms` }}
            onClick={() => onSelect(i)}
            data-testid={`graph-candidate-${i}`}
          >
            <circle
              cx={p.x} cy={p.y} r="30"
              fill="var(--bg-elev)"
              stroke={color}
              strokeWidth={isSel ? "2.5" : "1.5"}
            />
            <text x={p.x} y={p.y + 5} textAnchor="middle" fill="var(--text)" fontSize="13" fontFamily="var(--font-serif)" fontStyle="italic">
              {initials(c.profile?.name)}
            </text>
            <text x={p.x} y={p.y + 52} textAnchor="middle" fill={color} fontSize="11" fontFamily="var(--font-mono)">
              {c.score}%
            </text>
          </g>
        );
      })}

      {/* YOU node */}
      <g className="sn-pop" style={{ animationDelay: "60ms" }}>
        <circle cx={cx} cy={cy} r="42" fill="var(--bg-elev)" stroke="var(--mint)" strokeWidth="2" />
        <text x={cx} y={cy + 6} textAnchor="middle" fill="var(--text)" fontSize="18" fontFamily="var(--font-serif)" fontStyle="italic">
          {initials(user?.name) || "YOU"}
        </text>
        <text x={cx} y={cy + 64} textAnchor="middle" fill="var(--text-dim)" fontSize="10" fontFamily="var(--font-mono)" letterSpacing="2">
          YOU
        </text>
      </g>
    </svg>
  );
}
