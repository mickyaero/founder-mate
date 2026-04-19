import { useEffect, useState } from "react";

const STEPS = [
  { label: "Enriching your profile", duration: 2100 },
  { label: "Scanning your LinkedIn network", duration: 4300 },
  { label: "Finding matching professionals", duration: 3200 },
  { label: "Analyzing their posts", duration: 10000 },
  { label: "Finding warm connections", duration: 4000 },
  { label: "Drafting personalized approach", duration: 3500 },
  { label: "Building your connection graph", duration: 600000 }, // holds until `done`
];

export default function LoadingSteps({ done }) {
  const [active, setActive] = useState(0);
  const [elapsed, setElapsed] = useState(Array(STEPS.length).fill(0));
  const [flash, setFlash] = useState(-1);
  const [totalElapsed, setTotalElapsed] = useState(0);

  // Total elapsed timer
  useEffect(() => {
    const start = performance.now();
    const int = setInterval(() => setTotalElapsed((performance.now() - start) / 1000), 300);
    return () => clearInterval(int);
  }, []);

  // Step auto-advance
  useEffect(() => {
    if (done) {
      setActive(STEPS.length);
      return;
    }
    if (active >= STEPS.length) return;
    const step = STEPS[active];
    const start = performance.now();
    const int = setInterval(() => {
      const e = performance.now() - start;
      setElapsed((prev) => {
        const next = [...prev];
        next[active] = e;
        return next;
      });
    }, 90);
    const t = setTimeout(() => {
      clearInterval(int);
      setFlash(active);
      setTimeout(() => setFlash(-1), 220);
      setActive((a) => Math.min(a + 1, STEPS.length));
    }, step.duration);
    return () => {
      clearTimeout(t);
      clearInterval(int);
    };
  }, [active, done]);

  const progress = Math.min(1, active / STEPS.length);
  const showDeepNotice = totalElapsed > 90 && !done;

  return (
    <div
      style={{
        background: "#12111a",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: "28px 32px 22px",
        position: "relative",
      }}
      data-testid="loading-steps"
    >
      <div style={{display:'flex',justifyContent:'center',marginBottom:24}} className={done ? '' : 'logo-pulse'}>
        <svg width="48" height="48" viewBox="0 0 64 64" fill="none" stroke="#6ee7b7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 36l8-8 6 2 8-8"/>
          <path d="M52 28l-8 8-6-2-8 8"/>
          <path d="M12 36c-4 4-4 8 0 12s8 4 12 0l4-4"/>
          <path d="M52 28c4-4 4-8 0-12s-8-4-12 0l-4 4"/>
          <path d="M20 22l6-6c2-2 6-2 8 0l2 2"/>
          <path d="M44 42l-6 6c-2 2-6 2-8 0l-2-2"/>
        </svg>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {STEPS.map((s, i) => {
          const state = i < active || done ? "done" : i === active ? "active" : "pending";
          const sym = state === "done" ? "◆" : state === "active" ? "◇" : "·";
          const symColor =
            state === "done" ? "#6ee7b7" : state === "active" ? "#6ee7b7" : "#4a4458";
          const textColor = state === "pending" ? "#4a4458" : "#ede9e3";
          const time =
            state === "done"
              ? i === STEPS.length - 1
                ? "✓"
                : `${(s.duration / 1000).toFixed(1)}s`
              : state === "active"
                ? `${(elapsed[i] / 1000).toFixed(1)}s`
                : "";
          const isFlash = flash === i;
          return (
            <div
              key={s.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                background: isFlash ? "rgba(110,231,183,0.1)" : "transparent",
                borderRadius: 8,
                padding: "6px 8px",
                margin: "-6px -8px",
                transition: "background 220ms ease",
              }}
              data-testid={`loading-step-${i}`}
            >
              <span
                className={state === "active" ? "sn-pulse" : ""}
                style={{ color: symColor, width: 18, display: "inline-block", textAlign: "center", fontSize: 16 }}
              >
                {sym}
              </span>
              <span
                style={{
                  color: textColor,
                  flex: 1,
                  fontSize: 16,
                  fontWeight: 500,
                  fontFamily: "var(--font-sans)",
                }}
              >
                {s.label}...
              </span>
              <span
                style={{
                  color: "#6ee7b7",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  fontSize: 14,
                  minWidth: 54,
                  textAlign: "right",
                }}
              >
                {time}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div
        style={{
          marginTop: 22,
          height: 3,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 99,
          overflow: "hidden",
        }}
        data-testid="loading-progress"
      >
        <div
          style={{
            height: "100%",
            width: `${progress * 100}%`,
            background: "linear-gradient(90deg, #6ee7b7 0%, #34d399 100%)",
            boxShadow: "0 0 12px rgba(110,231,183,0.6)",
            transition: "width 400ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        />
      </div>

      {showDeepNotice && (
        <div
          style={{
            marginTop: 18,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "#8a8494",
            letterSpacing: "0.12em",
            textAlign: "center",
          }}
          data-testid="deep-notice"
        >
          Deep network analysis in progress...
        </div>
      )}
    </div>
  );
}
