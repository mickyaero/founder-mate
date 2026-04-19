# 🤝 FounderMate

**We find and get you connected.**

FounderMate helps founders find co-founders and customers through warm connections — not cold outreach.

Built at [ContextCon 2026](https://crustdata.com/contextcon) — YC's First India Hackathon, powered by Crustdata.

---

## The Problem

Solo founders spend hours scrolling LinkedIn, sending cold DMs that get ignored. They can't find the right people, and even when they do, they have no warm path to reach them.

Cold outreach gets 2% reply rates. Warm intros get 10x more.

## The Solution

FounderMate is an AI agent that finds the right person AND the warm path to reach them — through people who already engage with both of you on LinkedIn.

### Two Modes, One Engine

| Mode | What It Does |
|------|-------------|
| **Find Co-founder** | Matches by complementary skills, personality traits (inferred from posts), location, and warm connections |
| **Find Customer** | Finds decision-makers with buying signals, personalized outreach referencing their actual LinkedIn posts |

### How It Works

```
You describe what you need
  → FounderMate searches 700M+ profiles (Crustdata Person Search)
  → Enriches candidates with career, education, email (Person Enrich)
  → Reads their LinkedIn posts (LinkedIn Posts API)
  → Gets everyone who engages with their content (Post Reactors API)
  → Cross-references YOUR reactors with THEIR reactors
  → Finds MUTUAL ENGAGERS = your warm bridge
  → Infers personality from posts + career trajectory
  → Drafts personalized approach using the warm path + their recent post
  → Shows the connection graph: You → Bridge → Target
```

### The Key Innovation: Warm Path Discovery

We use Crustdata's LinkedIn Post Reactors API to build a real-time social graph:

- Get everyone who likes/comments on YOUR posts → your active network
- Get everyone who likes/comments on the TARGET's posts → their active network
- **Cross-reference** → people who engage with BOTH of you = verified bridge
- Not guesswork — real social proof you can verify on LinkedIn right now

Additionally, we find warm paths through:
- Shared alma maters (you both went to PES University)
- Shared past employers (you both worked at Oracle)
- Bridge people (someone at your company who went to their school)

---

## Crustdata APIs Used

| API | Purpose | Key |
|-----|---------|-----|
| `GET /screener/person/enrich` | Full profile: career, education, skills, verified email | Published |
| `POST /screener/person/search` | Find candidates by title, region, seniority, function | Published |
| `GET /screener/linkedin_posts` | Recent posts + full reactor profiles (name, title, company, education) | Unpublished |
| `POST /screener/linkedin_posts/keyword_search` | Find people posting about specific topics | Unpublished |
| `POST /web/search/live` | Web search for additional context | Published |
| `POST /company/search` | Find target companies for customer mode | Published |

### API Chain

```
1. Person Enrich (YOU)          → your career, schools, employers
2. LinkedIn Posts + Reactors    → your active network (who engages with you)
3. Person Search                → find candidates matching your criteria
4. Person Enrich (CANDIDATES)   → their career, schools, employers
5. LinkedIn Posts + Reactors    → their active network
6. CROSS-REFERENCE              → mutual engagers = warm bridge
7. Keyword Search               → find people posting about your topics
8. LLM                          → personality inference + personalized message draft
```

---

## Features

- **Personality Matching** — LLM analyzes candidate's LinkedIn posts, headline, career trajectory to infer personality traits. Compares against founder's preferences. Returns a 1-10 score with reasoning.

- **Warm Path Graph** — Visual network showing YOU → Bridge → Target with labeled connections (shared school, mutual engager, shared employer).

- **Personalized Messages** — AI-drafted DMs that reference the candidate's actual recent LinkedIn post and the warm connection. Verified stamp when a real post is referenced.

- **Signal Acquisition Loading** — Real-time step-by-step progress showing each phase: enriching profile, scanning network, finding matches, analyzing posts, finding connections, drafting approach.

- **Dual Mode** — Same engine handles both co-founder search (personality + complementarity scoring) and customer search (buying signals + outreach).

---

## Tech Stack

- **Frontend**: React + Tailwind CSS + shadcn/ui
- **Backend**: FastAPI (Python) + MongoDB
- **Data**: Crustdata APIs (6 endpoints)
- **LLM**: Claude (via Emergent integration + cligate proxy)
- **Design**: "Signal Noir" — dark, investigative, precise. Mint (#6ee7b7) as brand color.

---

## Architecture

```
React Frontend (Emergent hosted)
  ├── Home page (mode selector + input form)
  ├── Results page (network graph + detail panel)
  └── Loading animation (step-by-step signal acquisition)
      │
      ▼
FastAPI Backend (Emergent hosted)
  ├── /api/search (async job system)
  ├── Crustdata API integration (published + unpublished keys)
  ├── Cross-reference engine (mutual engager detection)
  ├── Personality inference (LLM-powered)
  └── Message drafting (LLM-powered, personalized from posts)
      │
      ▼
Crustdata APIs                    LLM (Claude)
  ├── Person Search (700M+)        ├── Query → filter parsing
  ├── Person Enrich                ├── Personality inference
  ├── LinkedIn Posts + Reactors    └── Message drafting
  ├── Keyword Search
  └── Company Search
```

---

## Future Scope

- **Career Mirror** — Find people who had your exact career trajectory 3-5 years ago. See where they are now — your possible futures.
- **Investor Matching** — Find VCs who backed companies similar to yours. Identify the right partner. Warm intro paths.
- **Network Graph Growth** — Your warm path intelligence grows with every search. The algorithm learns which connections lead to meetings.
- **Multi-hop Bridges** — You → Person A → Person B → Target. Finding 2-3 degree warm paths.
- **Outcome Learning** — Tell FounderMate which intros led to meetings. It learns what works and improves recommendations.

---

## Team

**Micky** — IIT Bombay. Aerospace engineer turned AI builder. Previously built ProofLayer (deep financial verification against SEC XBRL data, top 5 at VibeCon from 20,000 applicants) and DocStruct (document intelligence with fine-tuned SLM).

---

*Built in 5 hours at ContextCon — YC's First India Hackathon, Bengaluru, April 19, 2026*

*"We find and get you connected."*
