import { useMemo, useState } from "react";

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

function firstName(name) {
  if (!name) return "";
  return name.trim().split(/\s+/)[0];
}

function scoreColor(s) {
  if (s >= 90) return "#6ee7b7";
  if (s >= 70) return "#60a5fa";
  return "#8a8494";
}

// Build up to 3 bridge nodes per candidate, in priority: mutual > school > employer
function buildBridges(c) {
  const out = [];
  const mutuals = c.bridges || [];
  for (const m of mutuals.slice(0, 2)) {
    out.push({
      type: "mutual",
      name: m.name || "Mutual",
      label: `Mutual: ${firstName(m.name) || "?"}`,
      sub: m.title || "",
    });
  }
  if (c.shared_schools?.length > 0 && out.length < 3) {
    out.push({
      type: "school",
      name: c.shared_schools[0],
      label: c.shared_schools[0],
      sub: "Alumni",
    });
  }
  if (c.shared_employers?.length > 0 && out.length < 3) {
    out.push({
      type: "employer",
      name: c.shared_employers[0],
      label: `Ex-${c.shared_employers[0]}`,
      sub: "Ex-colleagues",
    });
  }
  return out;
}

export default function NetworkGraph({ user, candidates, selectedIdx, onSelect }) {
  const W = 640;
  const H = 580;
  const cx = W / 2;
  const cy = H / 2;
  const radius = 230;
  const [hovered, setHovered] = useState(-1);

  const layout = useMemo(() => {
    return candidates.map((c, i) => {
      const angle = (i / Math.max(candidates.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      const bridges = buildBridges(c);
      // Position bridges along the radial segment
      const bridgePositions = bridges.map((b, bi) => {
        const t = (bi + 1) / (bridges.length + 1); // 0.5 for 1, 0.33/0.66 for 2, ...
        return {
          ...b,
          x: cx + (x - cx) * t,
          y: cy + (y - cy) * t,
        };
      });
      return { x, y, angle, bridges: bridgePositions };
    });
  }, [candidates]);

  const activeIdx = hovered >= 0 ? hovered : selectedIdx;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="100%"
      style={{ maxHeight: 640, overflow: "visible" }}
      data-testid="network-graph"
    >
      <defs>
        <filter id="mintGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Edges (flowing dashed lines) */}
      {candidates.map((c, i) => {
        const p = layout[i];
        const bridges = p.bridges;
        const dim = activeIdx >= 0 && activeIdx !== i;
        const baseStroke = dim ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.22)";
        const activeStroke = "#6ee7b7";
        const isActive = activeIdx === i;
        const stroke = isActive ? activeStroke : baseStroke;
        const sw = isActive ? 1.6 : 1;
        // Build points: YOU -> bridge1 -> bridge2 -> ... -> candidate
        const points = [{ x: cx, y: cy }, ...bridges.map((b) => ({ x: b.x, y: b.y })), { x: p.x, y: p.y }];
        return (
          <g key={`edge-${i}`} style={{ transition: "opacity 200ms", opacity: dim ? 0.4 : 1 }}>
            {points.slice(0, -1).map((s, si) => {
              const e = points[si + 1];
              return (
                <line
                  key={si}
                  x1={s.x}
                  y1={s.y}
                  x2={e.x}
                  y2={e.y}
                  stroke={stroke}
                  strokeWidth={sw}
                  strokeDasharray="5 5"
                  className="sn-flow"
                  style={{
                    animation: `sn-dash 1.6s linear infinite`,
                    animationDelay: `${si * 80}ms`,
                  }}
                />
              );
            })}
          </g>
        );
      })}

      {/* Bridge nodes (on top of edges) */}
      {candidates.map((c, i) =>
        layout[i].bridges.map((b, bi) => {
          const dim = activeIdx >= 0 && activeIdx !== i;
          return (
            <g
              key={`bridge-${i}-${bi}`}
              style={{
                opacity: dim ? 0.3 : 1,
                transition: "opacity 200ms",
                animation: `sn-float 3.4s ease-in-out ${(i * 0.15 + bi * 0.2).toFixed(2)}s infinite`,
              }}
            >
              <circle
                cx={b.x}
                cy={b.y}
                r="22"
                fill="#12111a"
                stroke="#6ee7b7"
                strokeOpacity="0.5"
                strokeWidth="1"
                strokeDasharray="3 3"
                className="sn-bridge-pulse"
                filter={activeIdx === i ? "url(#mintGlow)" : undefined}
              />
              <text
                x={b.x}
                y={b.y + 4}
                textAnchor="middle"
                fill="#ede9e3"
                fontSize="10"
                fontFamily="var(--font-mono)"
              >
                {initials(b.name)}
              </text>
              <text
                x={b.x}
                y={b.y - 30}
                textAnchor="middle"
                fill="#6ee7b7"
                fontSize="10"
                fontFamily="var(--font-mono)"
                letterSpacing="0.06em"
              >
                {b.label.length > 22 ? b.label.slice(0, 22) + "…" : b.label}
              </text>
            </g>
          );
        })
      )}

      {/* Candidate nodes */}
      {candidates.map((c, i) => {
        const p = layout[i];
        const color = scoreColor(c.score);
        const isSel = i === selectedIdx;
        const isActive = activeIdx === i;
        const dim = activeIdx >= 0 && !isActive;
        return (
          <g
            key={`cand-${i}`}
            style={{
              cursor: "pointer",
              opacity: dim ? 0.45 : 1,
              transition: "opacity 200ms",
              animation: `sn-float 3.6s ease-in-out ${(i * 0.22).toFixed(2)}s infinite`,
            }}
            onClick={() => onSelect(i)}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(-1)}
            data-testid={`graph-candidate-${i}`}
          >
            <circle
              cx={p.x}
              cy={p.y}
              r="32"
              fill="#12111a"
              stroke={color}
              strokeWidth={isSel ? 2.5 : 1.5}
              filter={isSel || isActive ? "url(#mintGlow)" : undefined}
            />
            <text
              x={p.x}
              y={p.y + 5}
              textAnchor="middle"
              fill="#ede9e3"
              fontSize="13"
              fontFamily="var(--font-serif)"
              fontStyle="italic"
            >
              {initials(c.profile?.name)}
            </text>
            <text
              x={p.x}
              y={p.y + 56}
              textAnchor="middle"
              fill={color}
              fontSize="11"
              fontFamily="var(--font-mono)"
              fontWeight="600"
            >
              {c.score}%
            </text>
            <text
              x={p.x}
              y={p.y + 70}
              textAnchor="middle"
              fill="#8a8494"
              fontSize="9"
              fontFamily="var(--font-sans)"
            >
              {firstName(c.profile?.name)}
            </text>
          </g>
        );
      })}

      {/* YOU node */}
      <g style={{ animation: "sn-float 4s ease-in-out infinite" }}>
        <circle cx={cx} cy={cy} r="44" fill="#12111a" stroke="#6ee7b7" strokeWidth="2" filter="url(#mintGlow)" />
        <text
          x={cx}
          y={cy + 6}
          textAnchor="middle"
          fill="#ede9e3"
          fontSize="18"
          fontFamily="var(--font-serif)"
          fontStyle="italic"
        >
          {initials(user?.name) || "YOU"}
        </text>
        <text
          x={cx}
          y={cy + 66}
          textAnchor="middle"
          fill="#8a8494"
          fontSize="10"
          fontFamily="var(--font-mono)"
          letterSpacing="2"
        >
          YOU
        </text>
      </g>
    </svg>
  );
}
