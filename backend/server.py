from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
import asyncio
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

import uuid

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Config
CRUSTDATA_PUBLISHED_KEY = os.environ.get('CRUSTDATA_PUBLISHED_KEY')
CRUSTDATA_UNPUBLISHED_KEY = os.environ.get('CRUSTDATA_UNPUBLISHED_KEY')
LLM_BASE_URL = os.environ.get('LLM_BASE_URL')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
CRUSTDATA_API = 'https://api.crustdata.com'
API_VERSION = '2025-11-01'

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# In-memory enrich cache + job store (per-process)
enrich_cache: Dict[str, Dict[str, Any]] = {}
jobs: Dict[str, Dict[str, Any]] = {}


# ------------- Models -------------
class SearchRequest(BaseModel):
    mode: str  # "cofounder" | "customer"
    linkedin_url: str
    role: Optional[str] = None
    location: Optional[str] = None
    topics: Optional[str] = None
    personality: Optional[str] = None
    product: Optional[str] = None


# ------------- HTTP helpers -------------
def crust_headers(key: str) -> Dict[str, str]:
    return {"authorization": f"Bearer {key}", "x-api-version": API_VERSION}


async def crust_get(path: str, params: Dict[str, Any], key: str, timeout: float = 90.0) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=timeout) as hc:
        r = await hc.get(f"{CRUSTDATA_API}{path}", params=params, headers=crust_headers(key))
        if r.status_code != 200:
            logger.warning(f"Crustdata GET {path} -> {r.status_code}: {r.text[:300]}")
            return {}
        try:
            return r.json()
        except Exception:
            return {}


async def crust_post(path: str, body: Dict[str, Any], key: str, timeout: float = 90.0) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=timeout) as hc:
        r = await hc.post(f"{CRUSTDATA_API}{path}", json=body, headers=crust_headers(key))
        if r.status_code != 200:
            logger.warning(f"Crustdata POST {path} -> {r.status_code}: {r.text[:300]}")
            return {}
        try:
            return r.json()
        except Exception:
            return {}


# ------------- LLM helpers (primary: user proxy, fallback: emergent) -------------
async def _call_user_proxy(messages: List[Dict[str, str]], timeout: float = 45.0) -> Optional[str]:
    if not LLM_BASE_URL:
        return None
    try:
        async with httpx.AsyncClient(timeout=timeout) as hc:
            # The proxy is a Claude CLI wrapper; omit `model`/`temperature` to use its default
            r = await hc.post(
                LLM_BASE_URL,
                json={"messages": messages},
                headers={"Content-Type": "application/json"},
            )
            if r.status_code == 200:
                data = r.json()
                choices = data.get("choices") or []
                if choices:
                    msg = choices[0].get("message") or {}
                    content = msg.get("content")
                    if content:
                        return content
                logger.warning(f"User LLM proxy odd body: {str(data)[:300]}")
            else:
                logger.warning(f"User LLM proxy {r.status_code}: {r.text[:200]}")
    except Exception as e:
        logger.warning(f"User LLM proxy unreachable: {e}")
    return None


async def _call_emergent(system: str, user: str) -> Optional[str]:
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"foundermate-{datetime.now(timezone.utc).timestamp()}",
            system_message=system,
        ).with_model("anthropic", "claude-haiku-4-5-20251001")
        resp = await chat.send_message(UserMessage(text=user))
        return resp
    except Exception as e:
        logger.error(f"Emergent LLM fallback failed: {e}")
        return None


async def llm_complete(system: str, user: str, timeout: float = 15.0) -> str:
    msgs = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    try:
        out = await asyncio.wait_for(_call_user_proxy(msgs, timeout=timeout), timeout=timeout)
        if out:
            return out
    except asyncio.TimeoutError:
        logger.warning("User LLM proxy timed out")
    try:
        out = await asyncio.wait_for(_call_emergent(system, user), timeout=timeout)
        if out:
            return out
    except asyncio.TimeoutError:
        logger.warning("Emergent LLM timed out")
    return ""


# ------------- Core flow helpers -------------
async def enrich_person(url: str) -> Dict[str, Any]:
    if url in enrich_cache:
        return enrich_cache[url]
    data = await crust_get(
        "/screener/person/enrich",
        {"linkedin_profile_url": url},
        CRUSTDATA_PUBLISHED_KEY,
        timeout=60.0,
    )
    # API may return list or object
    if isinstance(data, list) and data:
        data = data[0]
    if not isinstance(data, dict):
        data = {}
    enrich_cache[url] = data
    return data


async def get_reactors(url: str) -> List[Dict[str, Any]]:
    data = await crust_get(
        "/screener/linkedin_posts",
        {"person_linkedin_url": url, "fields": "reactors", "limit": 3, "max_reactors": 50},
        CRUSTDATA_UNPUBLISHED_KEY,
        timeout=90.0,
    )
    reactors: List[Dict[str, Any]] = []
    posts = []
    if isinstance(data, dict):
        posts = data.get("posts", data.get("data", []))
    elif isinstance(data, list):
        posts = data
    for p in posts or []:
        for r in (p.get("reactors") or []):
            reactors.append(r)
    return reactors


async def get_recent_post(url: str) -> Optional[Dict[str, Any]]:
    data = await crust_get(
        "/screener/linkedin_posts",
        {"person_linkedin_url": url, "limit": 1, "max_reactors": 0},
        CRUSTDATA_UNPUBLISHED_KEY,
        timeout=60.0,
    )
    posts = []
    if isinstance(data, dict):
        posts = data.get("posts", data.get("data", []))
    elif isinstance(data, list):
        posts = data
    if posts:
        p = posts[0]
        return {
            "text": p.get("text") or p.get("content") or p.get("post_text") or "",
            "date": p.get("date") or p.get("posted_at") or p.get("created_at") or "",
            "reactions": p.get("num_reactions") or p.get("reactions_count") or p.get("likes") or 0,
        }
    return None


async def parse_query_to_filters(req: SearchRequest) -> Dict[str, Any]:
    if req.mode == "cofounder":
        user_text = f"Role: {req.role or ''}\nLocation: {req.location or ''}\nTopics: {req.topics or ''}"
    else:
        user_text = f"Product: {req.product or ''}\nLocation: {req.location or ''}"

    system = (
        "You are an expert at converting natural-language recruiting/sales queries into Crustdata "
        "person search filters. Respond with STRICT JSON only, no prose. Schema: "
        '{"titles": [..up to 6 likely current titles..], "regions": [..locations..]} '
        "For co-founder queries, titles should be senior roles matching the requested discipline "
        "(e.g. 'VP Growth', 'Head of Product'). For customer queries, titles should be buyers/"
        "decision-makers for the product (e.g. 'VP Engineering', 'CTO', 'Head of Platform'). "
        "Regions MUST be in Crustdata's canonical LinkedIn geography format, e.g. "
        "'Bangalore Urban, Karnataka, India', 'Bengaluru, Karnataka, India', "
        "'San Francisco Bay Area', 'New York City Metropolitan Area', 'London Area, United Kingdom', "
        "'Greater Seattle Area'. If user says just a country (e.g. 'India'), output just 'India'. "
        "If a city is given, output 2 likely canonical variants."
    )
    out = await llm_complete(system, user_text)
    titles = []
    regions = []
    try:
        s = out.strip()
        if s.startswith("```"):
            s = s.strip("`")
            if s.lower().startswith("json"):
                s = s[4:]
        parsed = json.loads(s)
        titles = parsed.get("titles", []) or []
        regions = parsed.get("regions", []) or []
    except Exception:
        logger.warning(f"Could not parse LLM filters output: {out[:200]}")
    # Defaults if empty
    if not titles:
        titles = [req.role] if req.role else ["Head of Product", "VP Growth"]
    if not regions and req.location:
        regions = [req.location]
    return {"titles": titles[:6], "regions": regions[:3]}


async def search_candidates(filters: Dict[str, Any]) -> List[Dict[str, Any]]:
    titles = filters.get("titles") or []
    regions = filters.get("regions") or []

    async def _post(flt):
        body = {"filters": flt, "page": 1}
        data = await crust_post("/screener/person/search/", body, CRUSTDATA_PUBLISHED_KEY, timeout=30.0)
        if isinstance(data, dict):
            return data.get("profiles") or data.get("results") or data.get("data") or []
        if isinstance(data, list):
            return data
        return []

    base_flt = []
    if titles:
        base_flt.append({"filter_type": "CURRENT_TITLE", "type": "in", "value": titles})

    # Try each region variant until one returns results
    if regions:
        for r in regions:
            flt = base_flt + [{"filter_type": "REGION", "type": "in", "value": [r]}]
            results = await _post(flt)
            if results:
                return results
        # try all at once
        flt = base_flt + [{"filter_type": "REGION", "type": "in", "value": regions}]
        results = await _post(flt)
        if results:
            return results
    # fallback: no region
    return await _post(base_flt)


def _names_from(items: List[Any], keys: List[str]) -> List[str]:
    out = []
    for it in items or []:
        if isinstance(it, dict):
            for k in keys:
                v = it.get(k)
                if v:
                    out.append(str(v))
                    break
        elif isinstance(it, str):
            out.append(it)
    return out


def score_candidate(
    shared_schools: List[str],
    shared_employers: List[str],
    mutual_engagers: List[Dict[str, Any]],
    network_size: int,
) -> int:
    score = 0
    if len(mutual_engagers) > 0:
        score += 40
    if len(shared_schools) > 0:
        score += 25
    if len(shared_employers) > 0:
        score += 20
    score += min(15, int(network_size / 5))
    return min(100, score)


async def infer_personality(cand_data: Dict[str, Any], posts: List[str], personality_traits: str) -> Dict[str, Any]:
    """Ask LLM to infer personality match score (1-10), inferred traits, and reasoning bullets."""
    headline = cand_data.get("headline") or cand_data.get("title") or ""
    summary = cand_data.get("summary") or cand_data.get("about") or ""
    education = ", ".join(
        _names_from(cand_data.get("all_schools") or cand_data.get("education_background") or [], ["school_name", "name", "school"])
    )
    employers = _names_from(cand_data.get("all_employers") or cand_data.get("employer") or [], ["company_name", "name", "employer_name"])
    career_summary = " → ".join(employers[:6])
    post_texts = "\n---\n".join((p or "")[:300] for p in posts if p)

    system = (
        "You infer a LinkedIn candidate's personality from their profile data and score "
        "how well they match the founder's preferences. Return STRICT JSON only, no prose."
    )
    user = (
        "CANDIDATE DATA:\n"
        f"Headline: {headline}\n"
        f"Summary: {summary[:600]}\n"
        f"Recent posts: {post_texts[:1200] if post_texts else '(none)'}\n"
        f"Career: {career_summary}\n"
        f"Education: {education}\n\n"
        f"FOUNDER WANTS: {personality_traits}\n\n"
        "Infer this candidate's personality from the data above. Score how well they match the founder's preferences 1-10. Return JSON only:\n"
        '{"personality_score": 8, "inferred_traits": ["entrepreneurial", "strong communicator"], "reasoning": ["Posted 3x about startup life", "High engagement shows strong network"]}'
    )
    out = await llm_complete(system, user)
    try:
        s = (out or "").strip()
        if s.startswith("```"):
            s = s.strip("`")
            if s.lower().startswith("json"):
                s = s[4:]
        # Extract JSON object substring if model added prose
        if "{" in s and "}" in s:
            s = s[s.index("{"): s.rindex("}") + 1]
        parsed = json.loads(s)
        score = int(parsed.get("personality_score") or 0)
        return {
            "personality_score": max(0, min(10, score)),
            "inferred_traits": parsed.get("inferred_traits") or [],
            "personality_reasoning": parsed.get("reasoning") or [],
        }
    except Exception as e:
        logger.warning(f"personality inference parse failed: {e} | out={str(out)[:200]}")
        return {"personality_score": None, "inferred_traits": [], "personality_reasoning": []}


async def draft_approach(
    user: Dict[str, Any], cand: Dict[str, Any], warm_path: Dict[str, Any], post: Optional[Dict[str, Any]],
    personality: Optional[str] = None,
) -> str:
    target_name = cand.get("name") or "there"
    your_name = user.get("name") or "I"
    post_text = (post or {}).get("text") or ""
    path_desc = warm_path.get("description", "")
    system = (
        "You draft concise, warm, personalized LinkedIn DMs for founder outreach. "
        "Keep under 110 words. No emojis. No flattery. Reference a specific detail from their "
        "recent post when provided, and mention the warm connection naturally."
    )
    personality_line = (
        f"The founder wants someone who is: {personality}. Analyze the candidate's posts and career to assess if they match these traits.\n"
        if personality else ""
    )
    user_prompt = (
        f"Sender: {your_name} ({user.get('title','')}).\n"
        f"Target: {target_name} ({cand.get('title','')} at {cand.get('company','')}).\n"
        f"Warm path: {path_desc}.\n"
        f"Their recent post: {post_text[:400] if post_text else '(none)'}.\n"
        f"{personality_line}"
        "Write the DM body only."
    )
    out = await llm_complete(system, user_prompt)
    body = (out or "").strip()
    if not body:
        # Fallback template
        name_short = (target_name.split(" ")[0] if target_name and target_name != "there" else "there")
        path_line = f"We share a connection through {path_desc.lower()}." if path_desc else ""
        post_line = f"Saw your recent post — really resonated." if post_text else ""
        body = (
            f"Hi {name_short},\n\n"
            f"{path_line} {post_line}\n\n"
            f"I'm working on something I'd love your take on — got 15 min this week?\n\n"
            f"Best,\n{your_name.split(' ')[0] if your_name else 'Founder'}"
        ).strip()
    return body


# ------------- Endpoints -------------
@api_router.get("/")
async def root():
    return {"message": "FounderMate API", "ok": True}


@api_router.post("/search")
async def search(req: SearchRequest):
    """Kick off a background search job and return job_id for polling."""
    if not req.linkedin_url:
        raise HTTPException(400, "linkedin_url required")
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "running",
        "started": datetime.now(timezone.utc).isoformat(),
        "result": None,
        "error": None,
    }
    asyncio.create_task(_run_search_job(job_id, req))
    return {"job_id": job_id, "status": "running"}


@api_router.get("/search/{job_id}")
async def search_status(job_id: str):
    j = jobs.get(job_id)
    if not j:
        raise HTTPException(404, "job not found")
    return {"status": j["status"], "result": j["result"], "error": j["error"]}


async def _run_search_job(job_id: str, req: SearchRequest):
    try:
        data = await _do_search(req)
        jobs[job_id]["result"] = data
        jobs[job_id]["status"] = "done"
    except Exception as e:
        logger.exception(f"Search job {job_id} failed")
        jobs[job_id]["error"] = str(e)
        jobs[job_id]["status"] = "error"


async def _do_search(req: SearchRequest):
    # Step 1: enrich user + Step 2: user reactors + Step 3 prep: parse filters
    user_task = enrich_person(req.linkedin_url)
    user_reactors_task = get_reactors(req.linkedin_url)
    filters_task = parse_query_to_filters(req)

    user_data, user_reactors, filters = await asyncio.gather(
        user_task, user_reactors_task, filters_task, return_exceptions=True
    )
    if isinstance(user_data, BaseException):
        logger.warning(f"user enrich failed: {user_data}")
        user_data = {}
    if isinstance(user_reactors, BaseException):
        logger.warning(f"user reactors failed: {user_reactors}")
        user_reactors = []
    if isinstance(filters, BaseException):
        logger.warning(f"filter parse failed: {filters}")
        filters = {"titles": [req.role] if req.role else ["Head of Product"], "regions": [req.location] if req.location else []}
    user_reactor_urls = {
        (r.get("linkedin_profile_url") or r.get("linkedin_url") or "").lower()
        for r in user_reactors
        if isinstance(r, dict)
    }
    user_reactor_urls.discard("")

    # Step 3: search candidates
    raw_candidates = await search_candidates(filters)
    # Filter out self
    self_url_low = (req.linkedin_url or "").lower()
    cand_list = []
    for c in raw_candidates:
        if not isinstance(c, dict):
            continue
        curl = (c.get("linkedin_profile_url") or c.get("linkedin_url") or "").lower()
        if curl and curl == self_url_low:
            continue
        cand_list.append(c)
        if len(cand_list) >= 5:
            break

    # Step 4+5+8: enrich + reactors + recent_post for each candidate — all in ONE parallel gather
    cand_urls = [
        (c.get("linkedin_profile_url") or c.get("linkedin_url") or "") for c in cand_list
    ]
    valid_urls = [u for u in cand_urls if u]
    all_tasks = (
        [enrich_person(u) for u in valid_urls]
        + [get_reactors(u) for u in valid_urls]
        + [get_recent_post(u) for u in valid_urls]
    )
    all_res = await asyncio.gather(*all_tasks, return_exceptions=True)
    n = len(valid_urls)
    # Replace exceptions with safe defaults
    def _safe(x, default):
        return default if isinstance(x, BaseException) else x
    enrich_results = [_safe(x, {}) for x in all_res[:n]]
    reactor_results = [_safe(x, []) for x in all_res[n : 2 * n]]
    post_results = [_safe(x, None) for x in all_res[2 * n : 3 * n]]

    # User identity data
    user_schools = _names_from(user_data.get("all_schools") or user_data.get("education_background") or [], ["school_name", "name", "school"])
    user_employers = _names_from(user_data.get("all_employers") or user_data.get("employer") or [], ["company_name", "name", "employer_name"])

    # First pass: compute warm paths, then parallelize message drafting
    prepped = []
    for i, c in enumerate(cand_list):
        cenriched = enrich_results[i] if i < len(enrich_results) else {}
        creactors = reactor_results[i] if i < len(reactor_results) else []
        cpost = post_results[i] if i < len(post_results) else None

        cand_schools = _names_from(
            cenriched.get("all_schools") or cenriched.get("education_background") or [],
            ["school_name", "name", "school"],
        )
        cand_employers = _names_from(
            cenriched.get("all_employers") or cenriched.get("employer") or [],
            ["company_name", "name", "employer_name"],
        )

        shared_schools = sorted(set(s.lower() for s in user_schools) & set(s.lower() for s in cand_schools))
        shared_employers = sorted(set(s.lower() for s in user_employers) & set(s.lower() for s in cand_employers))
        def _cap(s_low, ref):
            for r in ref:
                if r.lower() == s_low:
                    return r
            return s_low
        shared_schools = [_cap(s, user_schools) for s in shared_schools]
        shared_employers = [_cap(s, user_employers) for s in shared_employers]

        cand_reactor_map = {}
        for r in creactors:
            if not isinstance(r, dict):
                continue
            url = (r.get("linkedin_profile_url") or r.get("linkedin_url") or "").lower()
            if url:
                cand_reactor_map[url] = r
        mutual_urls = set(cand_reactor_map.keys()) & user_reactor_urls
        mutual_engagers = [cand_reactor_map[u] for u in list(mutual_urls)[:5]]

        network_size = len(cand_reactor_map)
        sc = score_candidate(shared_schools, shared_employers, mutual_engagers, network_size)

        cand_name = cenriched.get("name") or c.get("name") or "there"
        cand_title = cenriched.get("title") or c.get("default_position_title") or c.get("title") or ""
        cand_company_obj = (cenriched.get("all_employers") or cenriched.get("employer") or [{}])
        cand_company = ""
        if isinstance(cand_company_obj, list) and cand_company_obj:
            first_emp = cand_company_obj[0]
            if isinstance(first_emp, dict):
                cand_company = first_emp.get("company_name") or first_emp.get("name") or ""
        elif isinstance(cand_company_obj, dict):
            cand_company = cand_company_obj.get("company_name") or cand_company_obj.get("name") or ""

        if mutual_engagers:
            b = mutual_engagers[0]
            bridge_name = b.get("name") or "Shared connection"
            warm_path = {
                "type": "bridge",
                "description": f"{bridge_name} engages with both of you",
                "steps": [
                    {"node": user_data.get("name") or "You", "label": "you"},
                    {"node": bridge_name, "label": f"both liked by {bridge_name}"},
                    {"node": cand_name, "label": "target"},
                ],
            }
            bridges = [
                {
                    "name": b2.get("name"),
                    "title": b2.get("title"),
                    "company": (b2.get("employer") or [{}])[0].get("name") if isinstance(b2.get("employer"), list) else b2.get("company"),
                }
                for b2 in mutual_engagers
            ]
        elif shared_schools:
            warm_path = {
                "type": "school",
                "description": f"Shared alumni: {shared_schools[0]}",
                "steps": [
                    {"node": user_data.get("name") or "You", "label": "you"},
                    {"node": shared_schools[0], "label": "alumni"},
                    {"node": cand_name, "label": "target"},
                ],
            }
            bridges = []
        elif shared_employers:
            warm_path = {
                "type": "employer",
                "description": f"Both worked at {shared_employers[0]}",
                "steps": [
                    {"node": user_data.get("name") or "You", "label": "you"},
                    {"node": shared_employers[0], "label": "ex-colleagues"},
                    {"node": cand_name, "label": "target"},
                ],
            }
            bridges = []
        else:
            warm_path = {
                "type": "cold",
                "description": "No warm path found — cold outreach",
                "steps": [
                    {"node": user_data.get("name") or "You", "label": "you"},
                    {"node": cand_name, "label": "target"},
                ],
            }
            bridges = []

        based_on = []
        if shared_schools:
            based_on.append(f"Shared school: {shared_schools[0]}")
        if shared_employers:
            based_on.append(f"Shared employer: {shared_employers[0]}")
        if mutual_engagers:
            based_on.append(f"{len(mutual_engagers)} mutual engagers")
        if cpost and cpost.get("text"):
            based_on.append("Referenced recent post")

        prepped.append({
            "c": c, "cenriched": cenriched, "cpost": cpost,
            "cand_name": cand_name, "cand_title": cand_title, "cand_company": cand_company,
            "cand_schools": cand_schools, "cand_employers": cand_employers,
            "shared_schools": shared_schools, "shared_employers": shared_employers,
            "mutual_engagers": mutual_engagers, "score": sc,
            "warm_path": warm_path, "bridges": bridges, "based_on": based_on,
        })

    # Parallelize message drafting
    msg_tasks = [
        draft_approach(
            user={"name": user_data.get("name"), "title": user_data.get("title")},
            cand={"name": p["cand_name"], "title": p["cand_title"], "company": p["cand_company"]},
            warm_path=p["warm_path"],
            post=p["cpost"],
            personality=req.personality,
        )
        for p in prepped
    ]
    message_bodies = await asyncio.gather(*msg_tasks, return_exceptions=True) if msg_tasks else []
    message_bodies = ["" if isinstance(b, BaseException) else b for b in message_bodies]

    # Personality inference (only when founder provided traits)
    if req.personality and prepped:
        pers_tasks = [
            infer_personality(
                cand_data=enrich_results[i] if i < len(enrich_results) else {},
                posts=[(p["cpost"] or {}).get("text", "")],
                personality_traits=req.personality,
            )
            for i, p in enumerate(prepped)
        ]
        pers_results = await asyncio.gather(*pers_tasks, return_exceptions=True)
        pers_results = [
            {"personality_score": None, "inferred_traits": [], "personality_reasoning": []}
            if isinstance(x, BaseException) else x
            for x in pers_results
        ]
    else:
        pers_results = [
            {"personality_score": None, "inferred_traits": [], "personality_reasoning": []}
            for _ in prepped
        ]

    candidates_out = []
    for i, p in enumerate(prepped):
        candidates_out.append(
            {
                "profile": {
                    "name": p["cand_name"],
                    "title": p["cand_title"],
                    "company": p["cand_company"],
                    "photo": p["cenriched"].get("profile_picture_url") or p["c"].get("profile_picture_url"),
                    "linkedin_url": cand_urls[i] if i < len(cand_urls) else "",
                    "email": p["cenriched"].get("email") or p["c"].get("email"),
                    "schools": p["cand_schools"][:5],
                    "employers": p["cand_employers"][:5],
                },
                "score": p["score"],
                "personality_score": pers_results[i]["personality_score"],
                "inferred_traits": pers_results[i]["inferred_traits"],
                "personality_reasoning": pers_results[i]["personality_reasoning"],
                "bridges": p["bridges"],
                "shared_schools": p["shared_schools"],
                "shared_employers": p["shared_employers"],
                "mutual_engager_count": len(p["mutual_engagers"]),
                "recent_post": p["cpost"],
                "warm_path": p["warm_path"],
                "message": {
                    "body": message_bodies[i] if i < len(message_bodies) else "",
                    "based_on": p["based_on"],
                    "verified": bool(p["cpost"] and p["cpost"].get("text")),
                },
            }
        )

    # Sort by score desc
    candidates_out.sort(key=lambda x: x["score"], reverse=True)

    # Persist search for audit
    try:
        await db.searches.insert_one(
            {
                "mode": req.mode,
                "linkedin_url": req.linkedin_url,
                "role": req.role,
                "location": req.location,
                "product": req.product,
                "ts": datetime.now(timezone.utc).isoformat(),
                "num_candidates": len(candidates_out),
            }
        )
    except Exception as e:
        logger.warning(f"searches insert failed: {e}")

    return {
        "user": {
            "name": user_data.get("name"),
            "title": user_data.get("title"),
            "photo": user_data.get("profile_picture_url"),
            "linkedin_url": req.linkedin_url,
            "schools": user_schools[:5],
            "employers": user_employers[:5],
        },
        "filters": filters,
        "candidates": candidates_out,
    }


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
