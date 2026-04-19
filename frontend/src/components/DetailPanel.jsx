import { useState } from "react";

export default function DetailPanel({ candidate }) {
  const [copied, setCopied] = useState(false);
  if (!candidate) {
    return (
      <div style={{ color: "var(--text-mute)", fontSize: 13, marginTop: 120, textAlign: "center" }} data-testid="detail-empty">
        Select a node to see details
      </div>
    );
  }
  const p = candidate.profile || {};
  const msg = candidate.message || {};
  const post = candidate.recent_post;

  const copyMsg = () => {
    navigator.clipboard.writeText(msg.body || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }} data-testid="detail-panel">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
        <div style={{ flex: 1 }}>
          <div className="font-serif-it" style={{ fontSize: 28, color: "var(--text)", lineHeight: 1.1 }} data-testid="detail-name">
            {p.name || "Unknown"}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 6 }}>
            {p.title}{p.company ? ` · ${p.company}` : ""}
          </div>
          {p.schools?.length > 0 && (
            <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 8, fontFamily: "var(--font-mono)" }}>
              {p.schools.slice(0, 2).join(" · ")}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="score-big" data-testid="detail-score">
            {candidate.score}
            <small>%</small>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-mute)", fontFamily: "var(--font-mono)", letterSpacing: "0.18em", marginTop: 4 }}>
            MATCH
          </div>
        </div>
      </div>

      {/* Why this person */}
      <div>
        <div className="section-label">WHY THIS PERSON</div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {buildWhy(candidate).map((r, i) => (
            <li key={i} style={{ display: "flex", gap: 10, fontSize: 13, color: "var(--text)" }}>
              <span style={{ color: "var(--mint)" }}>◆</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Personality Match */}
      {typeof candidate.personality_score === "number" && (
        <div data-testid="personality-match">
          <div className="section-label">PERSONALITY MATCH</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 28,
                color: "var(--mint)",
                letterSpacing: "-0.02em",
              }}
              data-testid="personality-score"
            >
              {candidate.personality_score}
              <span style={{ fontSize: 14, color: "var(--mint)", marginLeft: 2 }}>/10</span>
            </span>
            {candidate.inferred_traits?.length > 0 && (
              <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                {candidate.inferred_traits.slice(0, 4).join(" · ")}
              </span>
            )}
          </div>
          {candidate.personality_reasoning?.length > 0 && (
            <ul
              style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}
            >
              {candidate.personality_reasoning.map((r, i) => (
                <li key={i} style={{ display: "flex", gap: 10, fontSize: 12, color: "var(--text-dim)" }}>
                  <span style={{ color: "var(--mint)" }}>·</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Warm Path */}
      <div>
        <div className="section-label">WARM PATH</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }} data-testid="warm-path">
          {(candidate.warm_path?.steps || []).map((s, i, arr) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="warm-node">{s.node}</div>
              {i < arr.length - 1 && <span className="warm-arrow">──▶</span>}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 10, fontFamily: "var(--font-mono)" }}>
          {candidate.warm_path?.description}
        </div>
      </div>

      {/* Recent post */}
      {post?.text && (
        <div>
          <div className="section-label">THEIR RECENT POST</div>
          <div className="evidence-card" data-testid="recent-post">
            <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 14, color: "var(--text)", lineHeight: 1.55 }}>
              "{post.text.slice(0, 280)}{post.text.length > 280 ? "..." : ""}"
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mute)", letterSpacing: "0.1em" }}>
              <span>{post.date || ""}</span>
              <span>{post.reactions || 0} reactions</span>
            </div>
          </div>
        </div>
      )}

      {/* Your approach */}
      <div>
        <div className="section-label">YOUR APPROACH</div>
        <div style={{ position: "relative" }}>
          <div
            style={{
              background: "var(--bg-elev)",
              border: "1px solid var(--border-soft)",
              borderRadius: 12,
              padding: "22px 22px 20px",
              fontFamily: "var(--font-serif)",
              fontSize: 15,
              lineHeight: 1.65,
              color: "var(--text)",
              whiteSpace: "pre-wrap",
            }}
            data-testid="approach-body"
          >
            {msg.body || "(Draft unavailable)"}
          </div>
          {msg.verified && (
            <div style={{ position: "absolute", top: -14, right: 20 }} data-testid="verified-stamp">
              <span className="sn-stamp">VERIFIED ✓</span>
            </div>
          )}
        </div>
        {msg.based_on?.length > 0 && (
          <div
            style={{
              marginTop: 14,
              border: "1px solid var(--border-soft)",
              borderRadius: 10,
              padding: "12px 14px",
              background: "rgba(255,255,255,0.015)",
            }}
          >
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-mute)", letterSpacing: "0.24em", marginBottom: 8 }}>
              BASED ON
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              {msg.based_on.map((b, i) => (
                <li key={i} style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  · {b}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="sn-btn-ghost" onClick={copyMsg} data-testid="copy-msg-btn">
            {copied ? "COPIED" : "COPY"}
          </button>
          {p.linkedin_url && (
            <a
              className="sn-btn-ghost"
              href={p.linkedin_url}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: "none" }}
              data-testid="open-linkedin-btn"
            >
              OPEN LINKEDIN
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function buildWhy(c) {
  const out = [];
  if (c.shared_schools?.length > 0) out.push(`Shared school: ${c.shared_schools[0]}`);
  if (c.shared_employers?.length > 0) out.push(`Shared employer: ${c.shared_employers[0]}`);
  if (c.mutual_engager_count > 0) out.push(`${c.mutual_engager_count} mutual engagers in your networks`);
  if (c.bridges?.[0]?.name) out.push(`Bridge: ${c.bridges[0].name}${c.bridges[0].title ? ` (${c.bridges[0].title})` : ""}`);
  if (c.profile?.title) out.push(`Role fit: ${c.profile.title}`);
  if (out.length === 0) out.push("Strong profile match in target region and title");
  return out.slice(0, 5);
}
