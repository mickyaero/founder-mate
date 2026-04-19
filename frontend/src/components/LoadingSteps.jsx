import { useEffect, useState } from "react";

const STEPS = [
  { label: "Enriching your profile", duration: 2100 },
  { label: "Scanning your LinkedIn network", duration: 4300 },
  { label: "Finding matching professionals", duration: 3200 },
  { label: "Analyzing their posts", duration: 10000 },
  { label: "Finding warm connections", duration: 4000 },
  { label: "Drafting personalized approach", duration: 3500 },
];

export default function LoadingSteps({ done }) {
  const [active, setActive] = useState(0);
  const [elapsed, setElapsed] = useState(Array(STEPS.length).fill(0));

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
      setActive((a) => Math.min(a + 1, STEPS.length));
    }, step.duration);
    return () => {
      clearTimeout(t);
      clearInterval(int);
    };
  }, [active, done]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        fontFamily: "var(--font-mono)",
        fontSize: 13,
      }}
      data-testid="loading-steps"
    >
      {STEPS.map((s, i) => {
        const state = i < active || done ? "done" : i === active ? "active" : "pending";
        const sym = state === "done" ? "◆" : state === "active" ? "◇" : "·";
        const color =
          state === "done" ? "var(--mint)" : state === "active" ? "var(--mint)" : "var(--text-mute)";
        const textColor = state === "pending" ? "var(--text-mute)" : "var(--text)";
        const time =
          state === "done"
            ? `${(s.duration / 1000).toFixed(1)}s`
            : state === "active"
              ? `${(elapsed[i] / 1000).toFixed(1)}s`
              : "";
        return (
          <div
            key={s.label}
            style={{ display: "flex", alignItems: "center", gap: 14 }}
            data-testid={`loading-step-${i}`}
          >
            <span
              className={state === "active" ? "sn-pulse" : ""}
              style={{ color, width: 16, display: "inline-block", textAlign: "center" }}
            >
              {sym}
            </span>
            <span style={{ color: textColor, flex: 1 }}>{s.label}...</span>
            <span style={{ color: "var(--text-mute)", minWidth: 48, textAlign: "right" }}>{time}</span>
          </div>
        );
      })}
    </div>
  );
}
