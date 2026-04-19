# FounderMate — Technical Flow

## The One-Line Version

You give a LinkedIn URL + what you need → FounderMate finds people who match, discovers who BOTH of you know, and writes a message using that connection.

---

## The Flow (Step by Step)

```
YOU type: "I need a product co-founder in Bangalore, entrepreneurial"
  │
  ▼
STEP 1: WHO ARE YOU?
  │  Call: GET /screener/person/enrich?linkedin_profile_url=YOUR_URL
  │  Returns: your name, title, schools, employers, skills
  │  Now we know: "Mitul, Gen AI Engineer, PES University, Oracle"
  │
  ▼
STEP 2: WHO IS YOUR NETWORK?
  │  Call: GET /screener/linkedin_posts?person_linkedin_url=YOUR_URL&fields=reactors
  │  Returns: every person who liked/commented on your recent posts
  │  Each reactor comes with FULL profile (name, title, company, school)
  │  Now we have: 150 people who actively engage with you = YOUR network
  │
  ▼
STEP 3: WHO MATCHES YOUR CRITERIA?
  │  Call: POST /screener/person/search
  │  LLM converts "product co-founder in Bangalore" →
  │    filters: title=["VP Product","Head of Growth"], region=["Bangalore"]
  │  Returns: 25 matching professionals
  │  We take top 5
  │
  ▼
STEP 4: WHO ARE THEY? (for each of the 5)
  │  Call: GET /screener/person/enrich?linkedin_profile_url=CANDIDATE_URL
  │  Returns: their career, schools, employers, skills, email
  │
  ▼
STEP 5: WHO IS THEIR NETWORK? (for each of the 5)
  │  Call: GET /screener/linkedin_posts?person_linkedin_url=CANDIDATE_URL&fields=reactors
  │  Returns: every person who engages with THEIR posts
  │  Now we have: 150 people in THEIR network
  │
  ▼
STEP 6: THE MAGIC — CROSS-REFERENCE
  │
  │  YOUR network (150 people) ∩ THEIR network (150 people)
  │  = MUTUAL ENGAGERS (people who engage with BOTH of you)
  │
  │  Also compare:
  │  YOUR schools ∩ THEIR schools = shared alma maters
  │  YOUR employers ∩ THEIR employers = shared companies
  │
  │  Example result:
  │  "Deepak liked YOUR post 3 days ago
  │   AND commented on SNEHA's post yesterday
  │   → Deepak is your BRIDGE to Sneha"
  │
  ▼
STEP 7: SCORE
  │  Mutual engagers found?     → +40 points
  │  Shared school?             → +25 points
  │  Shared employer?           → +20 points
  │  Large network?             → up to +15 points
  │  Score = min(100, total)
  │
  ▼
STEP 8: PERSONALITY (if traits requested)
  │  Send to LLM:
  │    "Here's their headline, summary, posts, career.
  │     Founder wants: entrepreneurial, strong communicator.
  │     Score 1-10 how well they match."
  │  Returns: {score: 8, traits: ["entrepreneurial"], reasoning: ["3 startup posts"]}
  │
  ▼
STEP 9: DRAFT MESSAGE
  │  Send to LLM:
  │    "Write a DM from Mitul to Sneha.
  │     Warm path: Deepak engages with both of you.
  │     Her recent post: 'D2C growth metrics...'
  │     Keep under 80 words."
  │  Returns: personalized message referencing REAL post + REAL connection
  │
  ▼
OUTPUT: 5 candidates, each with:
  ├── Profile (name, title, company, email, photo)
  ├── Match score (0-100)
  ├── Personality score (1-10) + reasoning
  ├── Warm path (You → Bridge → Target)
  ├── Their recent LinkedIn post
  └── Ready-to-send personalized message
```

---

## Latency Breakdown

```
Step 1: Enrich you          ~3 sec    (1 API call)
Step 2: Your reactors       ~30 sec   (1 API call, LinkedIn is slow)
Step 3: Search candidates   ~10 sec   (1 API call + 1 LLM call)
Step 4: Enrich 5 people     ~15 sec   (5 API calls in parallel)
Step 5: Their reactors      ~90 sec   (5 API calls in parallel, each ~30s)
Step 6: Cross-reference     ~0.1 sec  (just set intersection in Python)
Step 7: Score               ~0.1 sec  (math)
Step 8: Personality         ~15 sec   (5 LLM calls in parallel)
Step 9: Draft messages      ~15 sec   (5 LLM calls in parallel)
                            ─────────
                    Total:  ~3 minutes
```

The bottleneck is Steps 2 and 5 — LinkedIn post reactors take 30-60 seconds per person because Crustdata fetches from LinkedIn in real-time.

---

## Crustdata API Mapping

| Step | Endpoint | Key | Credits |
|------|----------|-----|---------|
| 1. Enrich user | `GET /screener/person/enrich` | Published | 3 |
| 2. User reactors | `GET /screener/linkedin_posts?fields=reactors` | Unpublished | 5/post |
| 3. Search | `POST /screener/person/search` | Published | 1/profile |
| 4. Enrich candidates | `GET /screener/person/enrich` (×5) | Published | 3 each |
| 5. Candidate reactors | `GET /screener/linkedin_posts?fields=reactors` (×5) | Unpublished | 5/post |
| 6. Cross-reference | Python set intersection | — | 0 |
| 7. Score | Python math | — | 0 |
| 8. Personality | LLM call (×5) | — | 0 (cligate) |
| 9. Draft message | LLM call (×5) | — | 0 (cligate) |
| **Total per search** | | | **~125 credits** |

---

## Warm Path Algorithm

```python
def find_warm_path(user_reactors, candidate_reactors, user_schools, 
                   candidate_schools, user_employers, candidate_employers):
    
    # Priority 1: Mutual engagers (STRONGEST signal)
    # Someone who likes/comments on BOTH your posts
    mutual = user_reactor_urls ∩ candidate_reactor_urls
    if mutual:
        return "bridge" → person who engages with both
    
    # Priority 2: Shared school
    shared_schools = user_schools ∩ candidate_schools  
    if shared_schools:
        return "alumni" → school name
    
    # Priority 3: Shared employer
    shared_employers = user_employers ∩ candidate_employers
    if shared_employers:
        return "ex-colleagues" → company name
    
    # Priority 4: Cold (no warm path found)
    return "cold" → direct outreach
```

---

## What Makes This Different

```
What Apollo/Clay give you:          What FounderMate gives you:
├── Name, title, email              ├── Name, title, email
├── Company, industry               ├── Company, industry
├── (that's it)                     ├── WHO ENGAGES WITH THEM (reactors)
                                    ├── WHO ENGAGES WITH YOU (your reactors)
                                    ├── WHO ENGAGES WITH BOTH (mutual = bridge)
                                    ├── Personality inferred from posts
                                    └── Message referencing THEIR actual post
```

No other tool cross-references LinkedIn post reactors to find warm paths. That's the moat.

---

## Parallelization Strategy

```python
# Steps 1, 2, 3 run in PARALLEL (no dependencies)
user_data, user_reactors, filters = await asyncio.gather(
    enrich_person(user_url),
    get_reactors(user_url),
    parse_query_to_filters(request),
)

# Steps 4, 5, 8 for ALL candidates run in PARALLEL
all_results = await asyncio.gather(
    *[enrich_person(url) for url in candidate_urls],      # 5 enrichments
    *[get_reactors(url) for url in candidate_urls],        # 5 reactor fetches
    *[get_recent_post(url) for url in candidate_urls],     # 5 post fetches
)

# Step 9: ALL message drafts run in PARALLEL
messages = await asyncio.gather(
    *[draft_approach(user, cand, warm_path, post) for cand in candidates]
)
```

This reduces wall-clock time from ~15 minutes (sequential) to ~3 minutes (parallel).

---

*Built at ContextCon 2026 — YC's First India Hackathon*
