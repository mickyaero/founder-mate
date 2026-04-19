import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import LoadingSteps from "@/components/LoadingSteps";
import NetworkGraph from "@/components/NetworkGraph";
import DetailPanel from "@/components/DetailPanel";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const payload = location.state?.payload;

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [selected, setSelected] = useState(0);
  const startRef = useRef(null);
  const calledRef = useRef(false);

  useEffect(() => {
    if (!payload) {
      navigate("/");
      return;
    }

    // Guard against StrictMode double-invoke: only create one job globally
    if (window.__foundermateJob) {
      // Re-attach polling to existing job without posting again
    }

    startRef.current = performance.now();
    const tick = setInterval(() => {
      setElapsed((performance.now() - startRef.current) / 1000);
    }, 100);

    let cancelled = false;
    let pollInt = null;

    const poll = async (jobId) => {
      if (cancelled) return;
      try {
        const r = await axios.get(`${API}/search/${jobId}`, { timeout: 30000 });
        if (cancelled) return;
        if (r.data.status === "done") {
          setData(r.data.result);
          clearInterval(pollInt);
          clearInterval(tick);
          window.__foundermateJob = null;
        } else if (r.data.status === "error") {
          setError(r.data.error || "Search failed");
          clearInterval(pollInt);
          clearInterval(tick);
          window.__foundermateJob = null;
        }
      } catch (e) {
        // transient poll errors are OK; keep polling
      }
    };

    const startJob = async () => {
      let jobId = window.__foundermateJob;
      if (!jobId) {
        try {
          const r = await axios.post(`${API}/search`, payload, { timeout: 30000 });
          jobId = r.data.job_id;
          window.__foundermateJob = jobId;
        } catch (e) {
          if (cancelled) return;
          setError(e?.response?.data?.detail || e.message || "Request failed");
          clearInterval(tick);
          return;
        }
      }
      if (cancelled) return;
      pollInt = setInterval(() => poll(jobId), 2500);
      poll(jobId);
    };

    startJob();

    return () => {
      cancelled = true;
      clearInterval(tick);
      if (pollInt) clearInterval(pollInt);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modeLabel = payload?.mode === "cofounder" ? "find co-founder" : "find customer";

  return (
    <div data-testid="results-page">
      <div className="top-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span className="font-serif-it" style={{ fontSize: 18, color: "var(--text)" }}>
            foundermate
          </span>
          <span className="sn-dot" />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.14em" }}>
            {modeLabel}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mute)", letterSpacing: "0.14em" }} data-testid="elapsed-time">
            {elapsed.toFixed(1)}s
          </span>
          <button className="sn-btn-ghost" onClick={() => navigate("/")} data-testid="new-search-btn">
            ← NEW SEARCH
          </button>
        </div>
      </div>

      {!data && !error && (
        <div style={{ padding: "80px 40px", maxWidth: 560, margin: "0 auto" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text-mute)",
              letterSpacing: "0.24em",
              marginBottom: 28,
            }}
          >
            SIGNAL ACQUISITION
          </div>
          <LoadingSteps done={false} />
        </div>
      )}

      {error && (
        <div style={{ padding: "80px 40px", maxWidth: 640, margin: "0 auto", textAlign: "center" }} data-testid="results-error">
          <div style={{ color: "var(--orange)", fontSize: 14, marginBottom: 16 }}>Search failed</div>
          <div style={{ color: "var(--text-dim)", fontSize: 13 }}>{error}</div>
          <button className="sn-btn-ghost" onClick={() => navigate("/")} style={{ marginTop: 24 }}>
            ← BACK
          </button>
        </div>
      )}

      {data && (
        <div className="results-grid">
          <div className="graph-panel">
            <div className="section-label" style={{ marginBottom: 20 }}>
              NETWORK MAP · {data.candidates?.length || 0} CANDIDATES
            </div>
            <NetworkGraph
              user={data.user}
              candidates={data.candidates || []}
              selectedIdx={selected}
              onSelect={setSelected}
            />
          </div>
          <div className="detail-panel">
            <DetailPanel candidate={data.candidates?.[selected]} />
          </div>
        </div>
      )}
    </div>
  );
}
