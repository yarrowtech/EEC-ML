# EEC — Pricing Model

**Product:** EEC (Electronic Educare) — multi-role school management SaaS + curriculum-grounded AI tutor
**Currency:** INR · **FX assumption:** ₹88 / USD
**Prepared:** 2026-09-08

---

## 1. Cost to serve (COGS) per student / month

| Line item | Low scale (<3,000 students) | At scale (>3,000, with cost discipline) |
|---|---:|---:|
| Infra — compute, MongoDB, Redis, storage, CDN | ₹12 | ₹8 |
| Push / email / SMS | ₹2 | ₹2 |
| AI API — text (RAG) + speech + vision, blended over all enrolled | ₹15 | ₹9 |
| Support / devops / updates / account management (people) | ₹18 | ₹10 |
| Payment gateway fee on subscription collection (~2%) | ₹3 | ₹2 |
| **Total COGS** | **~₹48** | **~₹29** |

### AI API cost detail (GPT-5.4 Nano @ $0.20/M in · $1.25/M out; Whisper API @ $0.006/min)

| Component | Light user | Moderate | Heavy |
|---|---:|---:|---:|
| RAG text generation (~₹0.20 / interaction) | ₹3 | ₹8 | ₹20 |
| Speech transcription (reading tasks + voice queries) | ₹4 | ₹11 | ₹22 |
| Vision (student photo → Q&A, ~₹0.30 / image) | ₹1 | ₹3 | ₹7 |
| Embeddings + ingestion vision (per-school, amortised) | ₹0.5 | ₹0.5 | ₹1 |
| +15% overhead (retries, failed calls) | ₹1.5 | ₹4 | ₹8 |
| **Per active user** | **~₹10** | **~₹27** | **~₹58** |

> Blended to ~₹15 / enrolled student assuming ~40% are active AI users.
> **Cost drivers to watch:** speech usage (biggest AI line item — keep the fair-use cap firm), USD/INR rate, support load.
> **Free lever:** use browser built-in TTS, not a paid TTS API (saves ₹10–20 / student / month).

---

## 2. Break-even pricing (no profit target — land-grab / early phase)

Price ≈ cost + thin variance buffer. Literal zero-margin (₹48) is too tight; ₹55 absorbs a bad support month or an FX spike.

| Tier | Price / student / mo | Annual / student | What it covers |
|---|---:|---:|---|
| Core (no AI) | **₹30** | ₹360 | Attendance, fees, timetable, exams/rubrics, parent portal, chat, notifications |
| **Standard (AI tutor + analytics)** ← lead | **₹55** | ₹660 | Core + AI tutor (all modes) + mastery/gap analytics |
| Premium (+ speech assessment) | **₹85** | ₹1,020 | Standard + reading/writing speech assessment + AI narrative reports + priority support |

**Result at Standard:** revenue ₹55 − COGS ~₹48 = **~₹7 buffer (≈13%)** — effectively break-even.

### Guardrails (mandatory at break-even)

- **Minimum per school:** 300 students billed, **OR** a ₹18,000 / month floor — whichever is higher. Protects against money-losing small deployments.
- **Founding-school rate, renews higher:** contractually ₹55 for years 1–2, then steps to **₹95**. Get the step-up signed upfront.
- **Billed annually, in advance.**
- **One-time onboarding fee:** ₹30,000 (data migration + staff training). Waivable for whole-school deals.
- **AI fair use:** 50 tutor interactions + 10 speech assessments / student / month included; beyond that throttled or billed.
- **Payment gateway fees on fee collection:** paid by parents or the school — never by us.

---

## 3. Profit pricing (sustainable / target-state)

For schools that will pay for the outcome, and once scale brings COGS toward ₹29.

| Tier | Price / student / mo | Annual / student | COGS | Gross profit | **Margin** |
|---|---:|---:|---:|---:|---:|
| Core (no AI) | ₹40 | ₹480 | ~₹16 | ₹24 | **60%** |
| **Standard (AI tutor + analytics)** ← lead | **₹80** | ₹960 | ~₹29 | ₹51 | **64%** |
| Premium (+ speech assessment) | ₹120 | ₹1,440 | ~₹42 | ₹78 | **65%** |
| Standard — whole-school discount | ₹120 total? see note | ₹1,440 | — | — | — |

> **Whole-school / 3-year commitment:** ₹65 / student / month, price locked → ~55% margin at scale.
> **Absolute floor (large multi-school deals only):** ₹55 → ~50% margin at scale, break-even at low scale. Do not go below.

### Premium-market pricing (elite metro schools, fees ₹1.5L+/yr)

| Tier | Price / student / mo | Annual / student | Margin |
|---|---:|---:|---:|
| Standard | ₹150 | ₹1,800 | ~68% |
| Premium | ₹250 | ₹3,000 | ~69% |

Only viable where the school already pays a premium for everything. Benchmark: plain school ERPs sell at ₹300–600 / student / **year**; the AI tutor justifies a 3–4× multiple, not more.

---

## 4. Alternative model — parent-paid

Easier "yes" because the school's budget is never touched. This is how most Indian ed-tech actually monetises.

| Who pays | Amount | Notes |
|---|---|---|
| Parent (app + AI access fee) | ₹75–100 / month (₹900–1,200 / year) | Folded into annual school fees |
| School (platform license) | ₹0–20 / student / month | Or nothing, on a pure parent-paid deal |

Break-even equivalent: parent fee ₹660–800 / year with school paying ₹0.

---

## 5. Recommendation

| Scenario | Lead price (Standard tier) | Rationale |
|---|---|---|
| **Early phase / land grab** (chosen) | **₹55 / student / month** (₹660 / yr) | Break-even + thin buffer; founding rate renews to ₹95 after year 2 |
| Mass market, sustainable | ₹80 / student / month (₹960 / yr) | ~1.5–2× plain ERP; ~64% margin at scale, ~40% at low scale |
| Premium metro schools | ₹150 / student / month (₹1,800 / yr) | ~68% margin; only where the school pays premium for everything |
| Can't move the principal's budget | Parent-paid ₹900 / year | School pays little or nothing |

**Decision for current pipeline:** Standard **₹55 / student / month (₹660 / year)**, Core **₹30**, Premium **₹85**.
Minimum 300 students or ₹18,000 / school / month. Annual prepay. ₹30,000 onboarding. Founding rate renews to ₹95 after year 2.

### Break-even sanity check

- Per-school revenue at 300 students × ₹55 = **₹16,500 / month** (₹1.98L / year) — clears the ₹18k floor only just; enforce the floor.
- Per-school revenue at 500 students × ₹55 = **₹27,500 / month** (₹3.3L / year) — comfortable.
- Push whole-school and multi-school deals; avoid discounted sub-300-student deployments — they lose money.
