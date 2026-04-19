import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("cofounder");
  const [linkedin, setLinkedin] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [topics, setTopics] = useState("");
  const [personality, setPersonality] = useState("");
  const [product, setProduct] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const valid =
    linkedin.trim().length > 0 &&
    (mode === "cofounder" ? role.trim().length > 0 : product.trim().length > 0);

  const submit = (e) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setError("");
    setSubmitting(true);
    const payload =
      mode === "cofounder"
        ? { mode, linkedin_url: linkedin.trim(), role: role.trim(), location: location.trim(), topics: topics.trim(), personality: personality.trim() }
        : { mode, linkedin_url: linkedin.trim(), product: product.trim(), location: location.trim() };
    navigate("/results", { state: { payload } });
  };

  return (
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}
      data-testid="home-page"
    >
      <div className="container-narrow" style={{ width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <h1
            className="font-serif-it"
            style={{ fontSize: 56, margin: 0, letterSpacing: "-0.01em", color: "var(--text)" }}
            data-testid="home-logo"
          >
            foundermate
          </h1>
          <p
            className="font-serif-it"
            style={{ fontSize: 18, color: "var(--text-dim)", marginTop: 8 }}
            data-testid="home-tagline"
          >
            We find and get you connected.
          </p>
        </div>

        {/* Mode tabs */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 48, marginBottom: 32, borderBottom: "1px solid var(--border-soft)" }}>
          <button
            className="sn-tab"
            data-active={mode === "cofounder"}
            onClick={() => setMode("cofounder")}
            data-testid="tab-cofounder"
            type="button"
          >
            Find Co-founder
          </button>
          <button
            className="sn-tab"
            data-active={mode === "customer"}
            onClick={() => setMode("customer")}
            data-testid="tab-customer"
            type="button"
          >
            Find Customer
          </button>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 18 }} data-testid="home-form">
          {mode === "cofounder" ? (
            <>
              <Field label="Your LinkedIn URL">
                <input
                  className="sn-input"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="https://linkedin.com/in/yourhandle"
                  data-testid="input-linkedin"
                />
              </Field>
              <Field label="What role do you need?">
                <input
                  className="sn-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Product/growth person with D2C experience"
                  data-testid="input-role"
                />
              </Field>
              <Field label="Personality traits">
                <input
                  className="sn-input"
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  placeholder="Strong communicator, entrepreneurial, hands-on, data-driven"
                  data-testid="input-personality"
                />
              </Field>
              <Field label="Location">
                <input
                  className="sn-input"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Bangalore"
                  data-testid="input-location"
                />
              </Field>
              <Field label="Topics they care about (optional)">
                <input
                  className="sn-input"
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  placeholder="agentic AI, growth hacking"
                  data-testid="input-topics"
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="What do you sell?">
                <input
                  className="sn-input"
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  placeholder="API monitoring tools for fintech companies"
                  data-testid="input-product"
                />
              </Field>
              <Field label="Your LinkedIn URL">
                <input
                  className="sn-input"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="https://linkedin.com/in/yourhandle"
                  data-testid="input-linkedin"
                />
              </Field>
              <Field label="Location">
                <input
                  className="sn-input"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="India"
                  data-testid="input-location"
                />
              </Field>
            </>
          )}

          {error && (
            <div style={{ color: "var(--orange)", fontSize: 13 }} data-testid="home-error">
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
            <button
              type="submit"
              className="sn-btn"
              disabled={!valid || submitting}
              data-testid="find-them-btn"
            >
              <span style={{ color: "var(--mint)" }}>◆</span> FIND THEM
            </button>
          </div>
        </form>

        <div
          style={{
            marginTop: 72,
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--text-mute)",
            letterSpacing: "0.14em",
          }}
          data-testid="home-footer"
        >
          Powered by Crustdata · ContextCon 2026
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span className="section-label" style={{ marginBottom: 0 }}>{label}</span>
      {children}
    </label>
  );
}
