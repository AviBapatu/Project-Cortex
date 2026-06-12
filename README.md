# 🚀 Project Cortex — AI-Native CRM

> A decoupled, AI-native marketing execution engine featuring **Hybrid Search (RFM + RAG)**, **Algorithmic Queue Backpressure**, and **Real-Time Multi-Armed Bandit (MAB) optimization**.

---

## 📐 Architecture Overview

```
                                ┌─────────────────────────────────────────────┐
                                │                CLIENT (Web)                  │
                                │   React/Next.js Dashboard  :3000             │
                                └───────────────┬───────────────────────────────┘
                                                │ HTTPS REST
                                ┌───────────────▼───────────────────────────────┐
                                │            SERVICE A — CRM CORE  :4000         │
                                │  Express API + Mongoose + RAG + Cron + MAB     │
                                │                                                 │
                                │  ┌───────────┐  ┌──────────────┐  ┌─────────┐  │
                                │  │ REST API  │  │ Cron Jobs     │  │ Workers │  │
                                │  │ Layer     │  │ (node-cron)   │  │ (BullMQ)│  │
                                │  └─────┬─────┘  └──────┬───────┘  └────┬────┘  │
                                └────────┼───────────────┼───────────────┼───────┘
                                         │               │               │
                       ┌─────────────────┴───┐   ┌───────┴──────┐   ┌────┴──────────────┐
                       │   MongoDB Atlas      │   │  Google       │   │  Redis (BullMQ)   │
                       │   (Source of Truth)  │   │  Gemini /     │   │  :6379            │
                       │   + Vector Index     │   │  embedding-001│   │  Queues + Locks   │
                       └───────────────────────┘   └───────────────┘   └────┬──────────────┘
                                                                              │
                                                                ┌─────────────▼─────────────┐
                                                                │  SERVICE B — CHANNEL STUB  │
                                                                │  Express Mock :5000        │
                                                                │  (SMS/Email/WhatsApp sim)  │
                                                                │  Sends webhook callbacks → │
                                                                │  Service A /webhook_queue  │
                                                                └─────────────────────────────┘
```

### Core Engineering Principles

- **Async First** — anything taking longer than 50ms goes to BullMQ, never the main thread.
- **AI as Enhancement, Not Authority** — deterministic RFM math identifies segments; the LLM only translates/personalizes copy. It never invents data.
- **MongoDB as Single Source of Truth** — a fully denormalized "Golden Record." Redis is a volatile, high-throughput runtime cache only.
- **Late Personalization** — AI templates are generated once per campaign; PII (e.g. `firstName`) is injected at the millisecond of dispatch.
- **Failure Isolation** — if the Channel Stub (Service B) crashes, it never blocks Service A's RAG pipelines or APIs.

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| API Framework | Express.js |
| ODM | Mongoose |
| Database | MongoDB Atlas (+ Atlas Vector Search) |
| Cache / Queue Broker | Redis + BullMQ |
| Embeddings | Google `embedding-001` (768-dim, cosine) |
| LLM | Google Gemini (template + opportunity generation) |
| Cron | `node-cron` |
| Channel Simulation | Service B — standalone Express stub |
| Frontend | React / Next.js |

---

## 📁 Project Structure

```
project-cortex/
├── service-a-crm/                     # PORT 4000 — Core CRM, RAG, MAB, RFM
│   ├── src/
│   │   ├── server.js                  # Express entrypoint
│   │   ├── config/                    # db.js, redis.js, env.js
│   │   ├── models/                    # Shopper, Campaign, Opportunity, Order
│   │   ├── routes/                    # shoppers, campaigns, opportunities, webhooks
│   │   ├── controllers/
│   │   ├── services/                  # rfm, embedding, rag, bandit, digitalTwin
│   │   ├── queues/                    # dispatch, webhook, embeddingRefresh, banditFlush
│   │   ├── workers/                   # dispatch, webhook, embeddingRefresh, banditFlush
│   │   ├── cron/                      # opportunityEngine.cron.js (nightly @ 02:00)
│   │   ├── middleware/                # backpressure, errorHandler
│   │   └── utils/                     # logger, promptTemplates
│   ├── workers.entry.js               # Separate process — runs all BullMQ workers
│   └── Dockerfile
│
├── service-b-channel-stub/            # PORT 5000 — Mock SMS/Email/WhatsApp gateway
│   └── src/
│       ├── server.js
│       ├── routes/send.routes.js
│       └── utils/fireWebhook.js
│
├── client/                            # PORT 3000 — Dashboard (React/Next)
└── docker-compose.yml
```

---

## 🔌 Ports & Processes

| Component | Port | Notes |
|---|---|---|
| Client (Dashboard) | `3000` | React/Next.js |
| Service A — API | `4000` | Express + Mongoose REST API |
| Service A — Workers | *(internal)* | Separate process (`workers.entry.js`) for failure isolation |
| Service B — Channel Stub | `5000` | Mock delivery gateway, fires webhooks back to `:4000` |
| Redis | `6379` | BullMQ queues, locks, bandit counters |
| MongoDB Atlas | `27017` (cloud) | Source of Truth + Vector Search |

---

## 📬 Queue Architecture

| Queue | Concurrency | Purpose |
|---|---|---|
| `dispatch_queue` | 50 | Sends campaign messages → Service B |
| `webhook_queue` | 100 | Processes inbound delivery/open/click events |
| `embeddingRefreshQueue` | 5 (low priority) | Retries failed/stale embedding generations |
| `bandit_flush_queue` | — | Flushes Redis bandit stats → MongoDB on completion |

**Idempotency:** inbound webhooks are deduped via a namespaced Redis lock —
`webhook:${provider}:${campaignId}:${messageId}` (24h TTL, `NX`).

---

## 🗄️ Data Model (Mongoose)

- **`Shopper`** — Golden Record: profile, RFM scores, AI digital twin summary + 768-dim embedding vector, status (`ACTIVE` / `EMBEDDING_PENDING` / `INACTIVE`). Uses `{ timestamps: true }`.
- **`Campaign`** — segment query, audience size, 3 A/B/C variants (enum-constrained `variantId`, default-zero stats), status state machine, processed/failed counters.
- **`Opportunity`** — deterministic segment rules reformulated by the LLM into human-readable opportunity cards.
- **`Order`** — raw transaction history feeding the Digital Twin summary.

**Atlas Vector Search Index** — `ai.embeddingVector`, 768 dimensions, cosine similarity, with `rfm.totalLifetimeValue` and `rfm.daysSinceLastPurchase` as filter fields (enables single-stage hybrid pre-filter + vector search).

---

## 🔄 Campaign State Machine

```
DRAFT → EXECUTING (15% batch dispatched)
      → OPTIMIZING (Bandit picks winner, dispatches remaining 85%)
      → COMPLETED (processed === audienceSize)
      → FAILED (failed/processed > 0.2, after minimum volume gate)
```

### Epsilon-First Bandit Strategy
- **15% exploration / 85% exploitation** — empirically chosen for short-lived retail flash sales.
- **Winner = ArgMax(CTR_A, CTR_B, CTR_C)**.
- **Fallback:** if all CTRs are 0, compare **Open Rate** (opens/sent); if rates are equal, default to **Variant C** (control).

---

## 🛡️ Production Hardening (Implemented)

The architecture was audited for race conditions, hallucination risks, and distributed-systems failure modes. The following fixes are implemented in code:

| # | Issue | Fix |
|---|---|---|
| 1 | **Optimization race condition** — concurrent webhook workers could double-trigger the 85% dispatch | Atomic `findOneAndUpdate({ status: 'EXECUTING' } → { status: 'OPTIMIZING' })` — only one worker wins the lock |
| 2 | **LLM malformed output** — Gemini could return invalid JSON or break the `{{firstName}}` placeholder | Schema validation on all 3 variants + hardcoded fallback templates |
| 3 | **Missing personalization fields** — null `firstName` produced "Hi ," | Coalescing fallback: `shopper.firstName \|\| "Valued Customer"` |
| 4 | **Cron duplication on horizontal scale** | Redis distributed lock (`SET NX EX 3600`) around the nightly Opportunity Engine |

---

## 🚧 Known Architectural Debt & Production Readiness

The following are identified, scoped, and intentionally deferred for the current build — representing the next layer of hardening for multi-tenant, long-running production scale:

### 1. Redis as a Bandit Stats SPOF
**Risk:** A Redis restart mid-campaign before `banditFlush` runs loses in-flight `sent/opens/clicks` counters.
**Planned Fix:** Micro-batch flushing — every `processed % 50 === 0`, async-flush Redis hash state into `Campaign.variants[].stats`.

### 2. Global Backpressure ("Noisy Neighbor")
**Risk:** A single `queueMetrics.waiting > 10000` gate means one tenant's large campaign can `429` every other tenant.
**Planned Fix:** Per-tenant Redis token buckets (`active_jobs:${tenantId}`, ceiling ~2,000), incremented on enqueue, decremented on worker completion.

### 3. Vector Embedding Staleness
**Risk:** One-time embeddings cause permanent mis-segmentation as shopper behavior drifts.
**Planned Fix:** Event-driven re-embedding — trigger on every 5th order or when `daysSinceLastEmbed > 90`, via a low-priority queue job.

### 4. Embedding Dimension Lock-In
**Risk:** The Atlas Vector Search index is hardcoded to 768 dims (`embedding-001`); switching models breaks the index.
**Planned Fix:** Vector schema versioning — add `embeddingVector_v2`, stand up a parallel index, backfill in the background, then flip a feature flag in `rag.service.js` with zero downtime.

---

## ⚙️ Environment Variables

**`service-a-crm/.env`**
```env
PORT=4000
MONGO_URI=mongodb+srv://...
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
GOOGLE_API_KEY=...
GEMINI_MODEL=gemini-1.5-flash
EMBEDDING_MODEL=embedding-001
SERVICE_B_URL=http://localhost:5000
DISPATCH_CONCURRENCY=50
WEBHOOK_CONCURRENCY=100
BACKPRESSURE_THRESHOLD=10000
OPTIMIZATION_THRESHOLD=0.15
FAILURE_THRESHOLD=0.2
```

**`service-b-channel-stub/.env`**
```env
PORT=5000
SERVICE_A_WEBHOOK_URL=http://localhost:4000/webhooks/stub
SIMULATED_DELAY_MS=1000
SIMULATED_FAILURE_RATE=0.05
```

---

## 🏃 Getting Started

```bash
# 1. Clone
git clone https://github.com/<your-username>/project-cortex.git
cd project-cortex

# 2. Install dependencies for each service
cd service-a-crm && npm install
cd ../service-b-channel-stub && npm install
cd ../client && npm install

# 3. Configure .env files (see Environment Variables above)

# 4. Start Redis locally
docker run -d -p 6379:6379 redis

# 5. Run Service A — API
cd service-a-crm && npm run start:api

# 6. Run Service A — Workers (separate process)
cd service-a-crm && npm run start:workers

# 7. Run Service B — Channel Stub
cd service-b-channel-stub && npm start

# 8. Run the dashboard
cd client && npm run dev
```

> ⚠️ Configure the MongoDB Atlas Vector Search index manually via the Atlas UI before running embedding/RAG flows (see **Data Model** section above for the index spec).

---

## 🧠 Why These Design Choices? (Interview Q&A)

**Q: Why use an LLM at all if you already have RFM filters?**
RFM tells you *who bought what*. RAG finds the *latent intent* — the "vibe" — enabling infinite personalization variance for micro-segments at near-zero marginal cost.

**Q: Which is the Source of Truth — Redis or MongoDB?**
MongoDB is the absolute Source of Truth. Redis is strictly a high-throughput runtime cache (AOF-backed); the Bandit Worker asynchronously flushes final variant stats to MongoDB on completion.

**Q: Why BullMQ instead of Kafka?**
Kafka is built for durable event streaming/log-replay at massive scale. This architecture is about job orchestration — BullMQ provides native retries, scheduling, delayed jobs, and rate limiting with far lower operational overhead for a dispatch-job workload.

---

## 📄 License

MIT