# FounderMate — PRD

## Original Problem Statement
Build "FounderMate" — an AI agent that helps founders find co-founders and customers through warm connections. Design: "Signal Noir" (dark, investigative, precise). Crustdata-powered enrichment + user-proxy Claude LLM for filter parsing & personalised outreach drafting.

## User Personas
- **Early-stage founder** searching for technical/growth co-founders in their geography
- **B2B founder** looking for first 10 paying customers with warm intros

## Core Requirements
- Home (/) — search form with Co-founder / Customer mode toggle
- Results (/results) — two-column layout: network graph (55%) + detail panel (45%)
- 10-step orchestration: user enrich → reactors → LLM filter parse → search → 5× (enrich + reactors + recent post) → cross-ref networks → score → LLM draft DM
- Async job pattern (Kubernetes ingress ~120s timeout workaround)

## Architecture
- **Backend**: FastAPI, Crustdata (published + unpublished keys), user's Tailscale LLM proxy (Claude-Haiku-4.5) with Emergent LLM key fallback
- **Frontend**: React 19 + Vite, custom SVG network graph, Signal Noir CSS variables
- **Jobs**: In-memory async job store, 2.5s client polling

## Implemented (Feb 2026)
- POST /api/search → job_id (fire-and-forget)
- GET /api/search/{job_id} → polling for result
- Home page: mode tabs, all inputs, monospace footer, mint outlined "FIND THEM" button
- Results page: top bar with elapsed timer, animated SVG graph (nodes pop-in staggered, edges draw), clickable candidates
- Detail panel: name (Georgia italic 28px), 56px mint score, Why This Person, Warm Path chain, dashed evidence post card, drafted DM with rotated VERIFIED stamp, Copy / Open LinkedIn buttons
- Typewriter loading steps (◆ done / ◇ pulsing / · pending)
- Graceful per-call exception handling via `return_exceptions=True` in gather

## Backlog (P1/P2)
- P1: Persist jobs to MongoDB so reload mid-run recovers
- P1: Larger candidate pool (currently top 5); pagination in graph
- P2: "Customer" mode — buying-signal detection from recent posts (orange accent in design)
- P2: Cache Crustdata reactor calls across sessions (Redis)
- P2: Send LinkedIn DM directly via integration
