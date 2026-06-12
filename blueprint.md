# Project Cortex — AI-Native CRM: Micro-Level Build Blueprint

> Hybrid Search (RFM + RAG) · Algorithmic Queue Backpressure · Real-Time Multi-Armed Bandit (MAB)

---

## 0. High-Level System Map (ASCII)

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

---

## 1. Repo / Folder Structure (Micro-Level)

```
project-cortex/
├── service-a-crm/                     # PORT 4000 — Core CRM, RAG, MAB, RFM
│   ├── src/
│   │   ├── server.js                  # Express entrypoint
│   │   ├── config/
│   │   │   ├── db.js                  # Mongoose connection
│   │   │   ├── redis.js               # ioredis client (shared instance)
│   │   │   └── env.js                 # dotenv loader + validation
│   │   ├── models/
│   │   │   ├── Shopper.js             # ShopperSchema
│   │   │   ├── Campaign.js            # CampaignSchema
│   │   │   ├── Opportunity.js         # OpportunitySchema
│   │   │   └── Order.js               # Raw transaction history
│   │   ├── routes/
│   │   │   ├── shoppers.routes.js
│   │   │   ├── campaigns.routes.js    # POST /campaigns (backpressure check here)
│   │   │   ├── opportunities.routes.js
│   │   │   └── webhooks.routes.js     # POST /webhooks/:provider
│   │   ├── controllers/
│   │   │   ├── campaign.controller.js
│   │   │   ├── opportunity.controller.js
│   │   │   └── webhook.controller.js
│   │   ├── services/
│   │   │   ├── rfm.service.js         # Deterministic RFM math
│   │   │   ├── embedding.service.js   # Calls Google embedding-001
│   │   │   ├── rag.service.js         # Vector search + LLM template gen
│   │   │   ├── bandit.service.js      # ArgMax / epsilon logic
│   │   │   └── digitalTwin.service.js # Summarizes order history → text
│   │   ├── queues/
│   │   │   ├── queues.js              # Queue + QueueEvents instances (registry)
│   │   │   ├── dispatch.queue.js      # dispatch_queue producer helpers
│   │   │   ├── webhook.queue.js       # webhook_queue producer helpers
│   │   │   └── embeddingRefresh.queue.js
│   │   ├── workers/
│   │   │   ├── dispatch.worker.js     # Consumes dispatch_queue (concurrency 50)
│   │   │   ├── webhook.worker.js      # Consumes webhook_queue (concurrency 100)
│   │   │   ├── embeddingRefresh.worker.js
│   │   │   └── banditFlush.worker.js  # Flushes Redis stats → Mongo on completion
│   │   ├── cron/
│   │   │   └── opportunityEngine.cron.js   # Runs nightly @ 02:00
│   │   ├── middleware/
│   │   │   ├── backpressure.middleware.js  # checks dispatchQueue.getJobCounts()
│   │   │   └── errorHandler.js
│   │   └── utils/
│   │       ├── logger.js
│   │       └── promptTemplates.js     # LLM prompt strings (RAG + Opportunity)
│   ├── workers.entry.js               # Separate process entrypoint: starts all workers
│   ├── .env
│   ├── package.json
│   └── Dockerfile
│
├── service-b-channel-stub/            # PORT 5000 — Mock SMS/Email/WhatsApp gateway
│   ├── src/
│   │   ├── server.js
│   │   ├── routes/send.routes.js      # POST /send  → simulates delay + fires webhook
│   │   └── utils/fireWebhook.js       # Calls back Service A /webhooks/:provider
│   ├── .env
│   └── package.json
│
├── client/                            # PORT 3000 — Dashboard (React/Next)
│   └── ... (standard SPA structure)
│
└── docker-compose.yml                 # mongo (atlas, so skip), redis:6379, service-a, service-b, client
```

---

## 2. Ports & Processes Table

| Component | Port | Process | Notes |
|---|---|---|---|
| Client (React/Next dashboard) | 3000 | `npm run dev` | Talks to Service A REST API |
| Service A — CRM Core API | 4000 | `node src/server.js` | Express + Mongoose + Routes |
| Service A — Workers | (none, internal) | `node workers.entry.js` | **Separate process** from API — critical for Failure Isolation |
| Service B — Channel Stub | 5000 | `node src/server.js` | Fires webhooks back to `:4000/webhooks/:provider` |
| Redis | 6379 | `redis-server` | BullMQ queues, locks, bandit counters (HINCRBY) |
| MongoDB Atlas | 27017 (cloud) | — | Source of Truth + Vector Search Index |

> ⚠️ **Why a separate `workers.entry.js` process?** If Service B crashes and the webhook worker throws unhandled errors, it should NOT take down the Express API process. Run `npm run start:api` and `npm run start:workers` as two PM2/Docker processes.

---

## 3. Queue Inventory (Exact Count: 3)

| # | Queue Name | Concurrency | Purpose | Producer | Consumer (Worker) |
|---|---|---|---|---|---|
| 1 | `dispatch_queue` | 50 | Send campaign messages to Service B | `campaign.controller.js` (on EXECUTING/OPTIMIZING) | `dispatch.worker.js` |
| 2 | `webhook_queue` | 100 | Process inbound delivery/open/click events from Service B | `webhook.controller.js` | `webhook.worker.js` |
| 3 | `embeddingRefreshQueue` | (e.g. 5, low priority) | Retry failed Google embedding calls | `embedding.service.js` (on 429/500) | `embeddingRefresh.worker.js` |

> Note: a 4th implicit "queue" exists conceptually — the **Bandit Flush** — but it can be implemented either as its own tiny queue (`bandit_flush_queue`) or as a final job step inside `dispatch.worker.js` when `processed === audienceSize`. Recommended: **own queue** for clean separation → total **4 BullMQ queues**.

```
REDIS KEY NAMESPACE MAP
├── bull:dispatch_queue:*
├── bull:webhook_queue:*
├── bull:embeddingRefreshQueue:*
├── bull:bandit_flush_queue:*
├── webhook:<messageId>            → idempotency lock, EX 86400, NX
└── bandit:<campaignId>:<variant>  → HINCRBY counters {sent, opens, clicks}
```

---

## 4. Mongoose Schemas (Micro-Level Field Definitions)

### 4.1 `ShopperSchema` (Golden Record)

```javascript
const ShopperSchema = new Schema({
  customerId:        { type: String, required: true, unique: true, index: true },
  firstName:         String,
  lastName:          String,
  email:             String,
  phone:             String,

  rfm: {
    recencyScore:           Number,   // 1-5
    frequencyScore:         Number,   // 1-5
    monetaryScore:          Number,   // 1-5
    totalLifetimeValue:     { type: Number, index: true },
    daysSinceLastPurchase:  { type: Number, index: true },
    totalOrders:            Number,
  },

  ai: {
    digitalTwinSummary:  String,        // text summary of order history
    embeddingVector:     { type: [Number], default: null }, // 768-dim, null on failure
    embeddingModel:      { type: String, default: 'embedding-001' },
    lastEmbeddedAt:      Date,
  },

  status: {
    type: String,
    enum: ['ACTIVE', 'EMBEDDING_PENDING', 'INACTIVE'],
    default: 'ACTIVE',
  },
}, { timestamps: true }); // Pro-Tip: auto-manages createdAt & updatedAt

// Indexes
ShopperSchema.index({ customerId: 1 });                       // exact match / dedup
ShopperSchema.index({ "rfm.totalLifetimeValue": 1 });         // hybrid pre-filter
ShopperSchema.index({ "rfm.daysSinceLastPurchase": 1 });      // hybrid pre-filter
// Vector index 'ai.embeddingVector' — configured manually in Atlas UI (see §6)
```

### 4.2 `CampaignSchema`

```javascript
const CampaignSchema = new Schema({
  campaignId:   { type: String, required: true, unique: true, index: true },
  name:         String,
  goal:         String,           // natural-language goal from marketer

  segmentQuery: Schema.Types.Mixed,  // the Mongo filter used (RFM pre-filter + vector params)
  audienceSize: Number,

  variants: [{
    variantId: { type: String, enum: ['A', 'B', 'C'] }, // Pro-Tip: DB-level guard against bad LLM output
    template:  String,            // contains {{firstName}} placeholders
    stats: {
      sent:   { type: Number, default: 0 },
      opens:  { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
    },
  }],

  status: {
    type: String,
    enum: ['DRAFT', 'QUEUED', 'EXECUTING', 'OPTIMIZING', 'COMPLETED', 'FAILED'],
    default: 'DRAFT',
    index: true,
  },

  winnerVariant: { type: String, default: null }, // set after 15% optimization

  processed: { type: Number, default: 0 },
  failed:    { type: Number, default: 0 },
}, { timestamps: true }); // Pro-Tip: auto-manages createdAt & updatedAt

CampaignSchema.index({ campaignId: 1 }); // webhook → campaign routing
```

### 4.3 `OpportunitySchema`

```javascript
const OpportunitySchema = new Schema({
  opportunityId: { type: String, required: true, unique: true },
  segmentRuleId: String,             // e.g. 'CHURN_RISK_HIGH_LTV'
  ruleDefinition: Schema.Types.Mixed, // { daysSinceLastPurchase: { $gt: 90 }, totalLifetimeValue: { $gt: 1000 } }
  audienceMatchCount: Number,
  llmTitle:       String,            // "Churn risk for high-value customers"
  llmDescription: String,
  status: { type: String, enum: ['NEW', 'CONVERTED_TO_CAMPAIGN', 'DISMISSED'], default: 'NEW', index: true },
}, { timestamps: true });

OpportunitySchema.index({ status: 1 }); // dashboard fetching
```

### 4.4 `OrderSchema` (raw transactions feeding Digital Twin)

```javascript
const OrderSchema = new Schema({
  customerId: { type: String, index: true },
  items: [{ sku: String, name: String, qty: Number, price: Number }],
  totalAmount: Number,
  purchasedAt: Date,
}, { timestamps: true });
```

---

## 5. Service A — Module-by-Module Build Spec

### 5.1 `server.js`
- Boot Express, connect Mongo (`config/db.js`), connect Redis (`config/redis.js`).
- Mount routes: `/api/shoppers`, `/api/campaigns`, `/api/opportunities`, `/webhooks/:provider`.
- Start `cron/opportunityEngine.cron.js` (only in API process, NOT worker process — or vice versa, pick one owner to avoid double-firing).
- Global error handler last.

### 5.2 `middleware/backpressure.middleware.js`
Applied only to `POST /api/campaigns/:id/launch`:
```javascript
const queueMetrics = await dispatchQueue.getJobCounts();
if (queueMetrics.waiting > 10000) {
  await Campaign.updateOne({ _id: id }, { status: 'QUEUED' });
  return res.status(429).json({ error: "System at capacity. Campaign queued." });
}
next();
```

### 5.3 `services/rfm.service.js`
- `calculateRFM(customerId)`: pulls `Order` docs, computes recency/frequency/monetary scores (quintile binning), writes to `Shopper.rfm`.
- Pure math, **no AI**. Run as part of onboarding/sync job or nightly batch.

### 5.4 `services/digitalTwin.service.js`
- `generateSummary(customerId)`: aggregates `Order` history → plain-text summary (e.g. "Customer frequently buys running shoes, avg order $85, last purchase 45 days ago").
- Called **once** per shopper (or rarely refreshed) — feeds embedding.

### 5.5 `services/embedding.service.js`
```javascript
async function embedShopper(shopper) {
  try {
    const vector = await callGoogleEmbeddingAPI(shopper.ai.digitalTwinSummary); // 768-dim
    shopper.ai.embeddingVector = vector;
    shopper.status = 'ACTIVE';
  } catch (err) {
    if (err.status === 429 || err.status === 500) {
      shopper.ai.embeddingVector = null;
      shopper.status = 'EMBEDDING_PENDING';
      await embeddingRefreshQueue.add('retry_embed', { customerId: shopper.customerId });
    } else throw err;
  }
  await shopper.save();
}
```

### 5.6 `services/rag.service.js`
- `hybridSearch({ rfmFilters, queryText })`:
  1. **Pre-filter** (deterministic): Mongo query using `rfm.totalLifetimeValue`, `rfm.daysSinceLastPurchase` indexes.
  2. **Vector search**: `$vectorSearch` aggregation stage on `ai.embeddingVector`, restricted to the pre-filtered IDs (or combine via `$search` compound).
  3. Return matched shopper docs (the "micro-segment").
- `generateCampaignVariants(segmentDescription)`:
  - Calls Gemini once → returns exactly **3 variants** (A/B/C), each a template string with `{{firstName}}` placeholder.
  - **AI Authority Boundary**: prompt explicitly forbids inventing new segment criteria — only style/copy variation.

### 5.7 `services/bandit.service.js`
```javascript
// Called by dispatch.worker after dispatching each message
async function recordSent(campaignId, variantId) {
  await redis.hincrby(`bandit:${campaignId}:${variantId}`, 'sent', 1);
}

// Called by webhook.worker on open/click events
async function recordEvent(campaignId, variantId, eventType) {
  await redis.hincrby(`bandit:${campaignId}:${variantId}`, eventType, 1); // 'opens' | 'clicks'
}

// Called when 15% threshold reached
async function pickWinner(campaignId) {
  const variants = ['A', 'B', 'C'];
  const stats = await Promise.all(variants.map(v => redis.hgetall(`bandit:${campaignId}:${v}`)));

  const ctr = stats.map(s => (s.clicks || 0) / (s.sent || 1));
  if (ctr.every(c => c === 0)) {
    const opens = stats.map(s => Number(s.opens || 0));
    if (opens.every(o => o === opens[0])) return 'C'; // forced control default
    return variants[opens.indexOf(Math.max(...opens))];
  }
  return variants[ctr.indexOf(Math.max(...ctr))];
}
```

### 5.8 `cron/opportunityEngine.cron.js`
- `node-cron` schedule: `0 2 * * *` (2:00 AM daily).
- Steps:
  1. Run deterministic Mongo query: `{ "rfm.daysSinceLastPurchase": { $gt: 90 }, "rfm.totalLifetimeValue": { $gt: 1000 } }`.
  2. `audienceMatchCount = matches.length`.
  3. If `> 0` and no existing `NEW` opportunity for this `segmentRuleId`: call LLM **once** with strict prompt: *"Reformulate this rule in natural language, do not invent new criteria"* → `llmTitle`, `llmDescription`.
  4. Upsert `Opportunity` doc.

### 5.9 Workers (each its own file, run via `workers.entry.js`)

**`dispatch.worker.js`**
```javascript
new Worker('dispatch_queue', async (job) => {
  const { campaignId, variantId, customerId } = job.data;
  const shopper = await Shopper.findOne({ customerId });
  const variant = campaign.variants.find(v => v.variantId === variantId);
  const personalized = variant.template.replace('{{firstName}}', shopper.firstName); // LATE PERSONALIZATION

  await callServiceB({ to: shopper.phone, body: personalized, messageId: job.id, campaignId, variantId });

  await bandit.recordSent(campaignId, variantId);
  await Campaign.updateOne({ campaignId }, { $inc: { processed: 1 } });

  // State machine checks
  const camp = await Campaign.findOne({ campaignId });
  if (camp.processed === camp.audienceSize) {
    await Campaign.updateOne({ campaignId }, { status: 'COMPLETED' });
    await banditFlushQueue.add('flush', { campaignId });
  }
  if (camp.failed / camp.audienceSize > 0.2) {
    await Campaign.updateOne({ campaignId }, { status: 'FAILED' });
  }
}, { connection: redis, concurrency: 50 });
```

**`webhook.worker.js`**
```javascript
new Worker('webhook_queue', async (job) => {
  const { messageId, campaignId, variantId, eventType } = job.data; // eventType: 'delivered'|'opened'|'clicked'|'failed'

  if (eventType === 'opened' || eventType === 'clicked') {
    await bandit.recordEvent(campaignId, variantId, eventType === 'opened' ? 'opens' : 'clicks');
  }
  if (eventType === 'failed') {
    await Campaign.updateOne({ campaignId }, { $inc: { failed: 1 } });
  }

  // Check if 15% delivered → trigger OPTIMIZING transition
  const camp = await Campaign.findOne({ campaignId });
  const deliveredPct = camp.processed / camp.audienceSize;
  if (camp.status === 'EXECUTING' && deliveredPct >= 0.15) {
    const winner = await bandit.pickWinner(campaignId);
    await Campaign.updateOne({ campaignId }, { status: 'OPTIMIZING', winnerVariant: winner });
    await enqueueRemaining85Percent(campaignId, winner); // adds remaining jobs to dispatch_queue
  }
}, { connection: redis, concurrency: 100 });
```

**Idempotency check happens BEFORE adding to queue**, in `webhook.controller.js`:
```javascript
const isNew = await redis.set(`webhook:${payload.messageId}`, "1", "EX", 86400, "NX");
if (!isNew) return res.sendStatus(200); // drop duplicate
await webhookQueue.add('process', payload);
return res.sendStatus(202);
```

**`embeddingRefresh.worker.js`**
- Low concurrency (3–5), retries embedding with backoff, sets `status: 'ACTIVE'` on success.

**`banditFlush.worker.js`**
- On `COMPLETED`, reads all `bandit:${campaignId}:*` Redis hashes, writes final `sent/opens/clicks` into `Campaign.variants[].stats`, then optionally `DEL`s the Redis keys.

---

## 6. MongoDB Atlas Vector Index (Manual Setup Steps)

```
Atlas UI → Database → Collection: shoppers → Search Indexes → Create Index
{
  "type": "vectorSearch",
  "fields": [
    {
      "type": "vector",
      "path": "ai.embeddingVector",
      "numDimensions": 768,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "rfm.totalLifetimeValue"
    },
    {
      "type": "filter",
      "path": "rfm.daysSinceLastPurchase"
    }
  ]
}
```
> Including the RFM fields as **filter** fields in the vector index lets you do the pre-filter and vector search in a **single** `$vectorSearch` stage with a `filter` clause — more efficient than two sequential queries.

---

## 7. Campaign State Machine (ASCII)

```
        POST /campaigns (LLM generates 3 variants)
                    │
                    ▼
                ┌────────┐
                │ DRAFT  │
                └───┬────┘
                    │ marketer clicks "Launch"
                    │ (backpressure check)
              ┌─────▼──────┐      queue.waiting > 10000
              │  EXECUTING │◄────────────────┐
              │ (15% batch │                  │
              │  enqueued) │            ┌─────┴─────┐
              └─────┬──────┘            │  QUEUED   │ (retry later / manual relaunch)
                    │ 15% processed      └───────────┘
                    │ bandit.pickWinner()
              ┌─────▼──────────┐
              │  OPTIMIZING     │
              │ (85% remaining  │
              │  → winner only) │
              └─────┬───────────┘
                    │
        ┌───────────┴────────────┐
        │ processed === audience  │ failed/audience > 0.2
        ▼                          ▼
   ┌──────────┐              ┌─────────┐
   │COMPLETED │              │ FAILED  │
   └──────────┘              └─────────┘
```

---

## 8. End-to-End Request/Job Flow (ASCII Sequence)

```
Marketer ──POST /campaigns──► Service A API
                                   │ (Hybrid Search: RFM pre-filter + $vectorSearch)
                                   │ (Gemini: generate 3 variant templates, ONCE)
                                   ▼
                              Campaign saved (DRAFT)

Marketer ──POST /campaigns/:id/launch──► Service A API
                                   │ backpressure.middleware (dispatchQueue.getJobCounts)
                                   │  if waiting > 10000 → 429 + status QUEUED
                                   │  else → enqueue 15% of audience → status EXECUTING
                                   ▼
                          dispatch_queue (concurrency 50)
                                   │
                          dispatch.worker.js
                            ├─ fetch Shopper (firstName)
                            ├─ replace({{firstName}}) ── LATE PERSONALIZATION
                            ├─ POST → Service B /send
                            ├─ bandit.recordSent (Redis HINCRBY)
                            └─ Campaign.processed += 1

Service B ──simulated delay──► fires webhook ──► Service A POST /webhooks/:provider
                                   │
                          webhook.controller.js
                            ├─ Redis SET NX EX 86400 (idempotency)
                            └─ enqueue webhook_queue
                                   │
                          webhook_queue (concurrency 100)
                                   │
                          webhook.worker.js
                            ├─ bandit.recordEvent (opens/clicks)
                            ├─ on 'failed': Campaign.failed += 1
                            └─ if processed/audience >= 0.15 & status==EXECUTING:
                                  ├─ bandit.pickWinner() → ArgMax(CTR) / fallback OPEN / default 'C'
                                  ├─ Campaign.status = OPTIMIZING, winnerVariant = X
                                  └─ enqueue remaining 85% (winner template only) → dispatch_queue

... loop continues until processed === audienceSize ...
                                   │
                          dispatch.worker.js detects completion
                            ├─ Campaign.status = COMPLETED
                            └─ enqueue bandit_flush_queue
                                   │
                          banditFlush.worker.js
                            └─ Redis HGETALL bandit:* → write into Campaign.variants[].stats
```

---

## 9. Opportunity Engine Flow (ASCII)

```
node-cron @ 02:00 daily
        │
        ▼
Deterministic Mongo Query (RFM indexes):
  { daysSinceLastPurchase: { $gt: 90 }, totalLifetimeValue: { $gt: 1000 } }
        │
        ▼
matches.length > 0 ? ──No──► skip
        │ Yes
        ▼
LLM call (1x) — STRICT PROMPT:
  "Rephrase this exact rule in plain English.
   Do NOT invent new criteria or thresholds."
        │
        ▼
Opportunity { llmTitle: "Churn risk for high-value customers", ... status: NEW }
        │
        ▼
Dashboard shows card → Marketer clicks "Create Campaign from this"
        │
        ▼
Pre-fills POST /campaigns segmentQuery with the SAME ruleDefinition
```

---

## 10. Environment Variables (`.env`)

**service-a-crm/.env**
```
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

**service-b-channel-stub/.env**
```
PORT=5000
SERVICE_A_WEBHOOK_URL=http://localhost:4000/webhooks/stub
SIMULATED_DELAY_MS=1000
SIMULATED_FAILURE_RATE=0.05
```

---

## 11. Build Order (Step-by-Step Checklist)

```
[ ] 1. Scaffold service-a-crm: Express + Mongoose connection to Atlas
[ ] 2. Define all 4 schemas (Shopper, Campaign, Opportunity, Order) + indexes
[ ] 3. Seed script: generate ~200 fake shoppers + orders (faker.js)
[ ] 4. rfm.service.js — compute & store RFM scores for all seeded shoppers
[ ] 5. digitalTwin.service.js — generate summaries
[ ] 6. embedding.service.js — embed all shoppers via Google embedding-001
[ ] 7. Atlas UI — create vectorSearch index (768 dims, cosine)
[ ] 8. rag.service.js — hybridSearch() + generateCampaignVariants()
[ ] 9. POST /campaigns route — DRAFT creation (test hybrid search + 3-variant gen)
[ ] 10. Set up Redis locally (docker run redis)
[ ] 11. queues.js — register dispatch_queue, webhook_queue, embeddingRefreshQueue, bandit_flush_queue
[ ] 12. backpressure.middleware.js on /campaigns/:id/launch
[ ] 13. service-b-channel-stub — minimal /send endpoint + delayed webhook firer
[ ] 14. dispatch.worker.js — full personalization + Service B call + bandit.recordSent
[ ] 15. webhook.controller.js — idempotency lock + enqueue
[ ] 16. webhook.worker.js — event recording + 15% optimization trigger
[ ] 17. bandit.service.js — pickWinner logic (test all 3 fallback branches)
[ ] 18. banditFlush.worker.js — final stats write on COMPLETED
[ ] 19. opportunityEngine.cron.js — nightly job (test by running manually first)
[ ] 20. workers.entry.js — separate process; verify Service A API survives if this crashes
[ ] 21. Dashboard: campaign list, opportunity cards, real-time variant stats
[ ] 22. Load test: fire 50 simultaneous campaign launches → verify 429 + QUEUED behavior
[ ] 23. Load test: replay duplicate webhooks → verify idempotency drop
```

---

## 12. Architectural Flaws, Gaps & Interview Pushback Questions

These are things a Principal Engineer **will** ask. Know the gap and the honest answer.

### 12.1 Single Points of Failure
- **Redis is a SPOF for the Bandit during the campaign window.** If Redis crashes mid-campaign before `banditFlush` runs, in-flight `sent/opens/clicks` counts for that campaign are **lost** (AOF helps on restart but only if persistence is enabled and not corrupted). *Mitigation*: periodic incremental flush (e.g. every 5% progress), not just at COMPLETED.
- **`workers.entry.js` is a single process for 4 different worker types.** If `dispatch.worker.js` has a memory leak or unhandled rejection, it can crash the whole process and take down `webhook.worker.js` too — re-introducing the coupling the architecture claims to avoid. *Better*: separate processes per worker type, or at minimum wrap each Worker in its own error boundary + `process.on('unhandledRejection')`.

### 12.2 The 15% Optimization Trigger Race Condition
- Multiple `webhook.worker.js` instances (concurrency 100) can simultaneously read `camp.processed/audienceSize >= 0.15` as true and **both** trigger `pickWinner()` + enqueue the remaining 85% — causing **double-dispatch** to the entire remaining audience.
- *Fix needed*: atomic check via a Redis flag (`SET campaign:${id}:optimized NX`) or a Mongo `findOneAndUpdate` with a status guard (`status: 'EXECUTING'` → `'OPTIMIZING'` atomically; only the worker that wins the CAS proceeds).

### 12.3 Idempotency Lock TTL vs. Campaign Duration
- The 24-hour Redis idempotency lock assumes webhook retries happen within 24h. For long-running campaigns (multi-day drips), a legitimate **new** event with a reused `messageId` (if the channel provider recycles IDs) could be incorrectly dropped. Edge case, but worth noting `messageId` uniqueness guarantees should be verified per-provider (Twilio SIDs are globally unique; some providers are not).

### 12.4 Vector Index Staleness
- "Embeddings generated once" — but shopper behavior changes over time. A shopper embedded as "bargain hunter" 6 months ago who has since become a "premium loyalist" will be mis-segmented indefinitely. *Question to expect*: "What's your re-embedding policy?" Honest answer: none specified — propose a periodic batch (e.g. quarterly) or trigger-based (after N new orders) re-embed.

### 12.5 LLM Template Generation — "Generated Once" Risk
- If the **single** Gemini call for 3 variants returns malformed JSON/templates (no `{{firstName}}` placeholder, or includes a 4th variant, or refuses), there's no documented fallback. *Need*: schema validation on LLM output before saving the Campaign as DRAFT; retry once with a stricter prompt or fall back to static templates.

### 12.6 Backpressure Threshold is Global, Not Per-Tenant
- `queueMetrics.waiting > 10000` is a single global gate. In a multi-tenant SaaS, one tenant launching a massive campaign can block **all other tenants** from launching anything, even small campaigns. *Question*: "How do you ensure fairness across tenants?" — Consider per-tenant rate limits or weighted fair queueing (BullMQ priority + tenant-scoped queues).

### 12.7 "Math First, AI Second" — Who Validates the LLM Didn't Drift?
- The Opportunity Engine prompt *instructs* the LLM not to invent criteria, but nothing **enforces** it programmatically. A model could still hallucinate a `llmDescription` referencing a threshold not in `ruleDefinition` (e.g. saying "over $5000" when the rule says `$gt: 1000`). *Mitigation*: post-generation regex/number-extraction check comparing mentioned figures against `ruleDefinition` values; reject/regenerate on mismatch.

### 12.8 Failure Threshold (`failed/audienceSize > 0.2`) Timing
- This check only makes sense once a meaningful sample has been dispatched. If 1 out of the first 3 messages fails (33%), the campaign could prematurely flip to `FAILED` even though Service B is just having a transient blip. *Fix*: gate the FAILED check behind a minimum sample size (e.g. only evaluate after `processed >= 0.15 * audienceSize`, same as the optimization gate).

### 12.9 Zero-Click Fallback Edge Case Not Fully Specified
- "If OPENs are identical, forcefully default to Variant C." But what if `sent` counts differ significantly between A/B/C at the 15% mark (e.g. due to queue processing order)? Comparing raw `opens` counts (not rates) across unequal sample sizes is statistically misleading. *Better*: compare **open rate** (`opens/sent`), not raw counts, even in the fallback.

### 12.10 Late Personalization & Missing Fields
- `template.replace('{{name}}', user.firstName)` — what happens if `firstName` is null/empty (common in real data)? Sends "Hi ," to the customer. *Need*: a fallback default (e.g. "there" or "Valued Customer") in the personalization step.

### 12.11 Embedding Dimension Lock-In
- Hard constraint of 768 dims tied to `embedding-001`. If Google deprecates this model or you switch providers (e.g. to a 1536-dim OpenAI embedding), the entire vector index and all 200+ stored vectors need regeneration — a non-trivial migration with no documented plan.

### 12.12 Cron Single-Instance Assumption
- `node-cron` running inside the API process (or worker process) means if you ever scale to **multiple replicas** of that service (horizontal scaling), the opportunity engine cron fires **once per replica** at 2 AM — N duplicate Opportunity docs / N LLM calls. *Fix*: use a distributed lock (Redis) around the cron job, or move to a dedicated single-instance scheduler service.

---

## 12B. Tier 1 — Code Patches (Demo Savers, fix these now)

### 1. `src/workers/webhook.worker.js` — Fix 12.2 (Atomic Optimization Lock)

```javascript
// ── FIX 12.2: Atomic MongoDB lock prevents double-dispatch of the 85% cohort ──
const camp = await Campaign.findOne({ campaignId });
const deliveredPct = camp.processed / camp.audienceSize;

if (camp.status === 'EXECUTING' && deliveredPct >= 0.15) {
  const lockedCamp = await Campaign.findOneAndUpdate(
    { campaignId, status: 'EXECUTING' },   // only matches if still EXECUTING
    { $set: { status: 'OPTIMIZING' } },
    { new: true }
  );

  // If lockedCamp is null, another worker already won this race — do nothing
  if (lockedCamp) {
    const winner = await bandit.pickWinner(campaignId);
    await Campaign.updateOne({ campaignId }, { winnerVariant: winner });
    await enqueueRemaining85Percent(campaignId, winner);
  }
}
```

### 2. `src/services/rag.service.js` — Fix 12.5 (LLM Output Validation + Fallback)

```javascript
async function generateCampaignVariants(segmentDescription) {
  const raw = await callGeminiForVariants(segmentDescription); // existing call

  let variants;
  try {
    variants = JSON.parse(raw); // strip ```json fences first if present
  } catch (err) {
    return getHardcodedFallbackVariants(segmentDescription);
  }

  // ── FIX 12.5: Schema + placeholder validation ──
  const isValid =
    Array.isArray(variants) &&
    variants.length === 3 &&
    variants.every(v =>
      v.variantId &&
      ['A', 'B', 'C'].includes(v.variantId) &&
      typeof v.template === 'string' &&
      v.template.includes('{{firstName}}')
    );

  if (!isValid) {
    return getHardcodedFallbackVariants(segmentDescription);
  }

  return variants;
}

// ── Hardcoded fallback so campaign creation never crashes ──
function getHardcodedFallbackVariants(segmentDescription) {
  return [
    {
      variantId: 'A',
      template: `Hi {{firstName}}, we noticed something special about your account — check out what's new for you!`,
    },
    {
      variantId: 'B',
      template: `Hey {{firstName}}! Based on your history, we think you'll love this offer — take a look.`,
    },
    {
      variantId: 'C',
      template: `{{firstName}}, here's a quick update we thought you'd want to see.`,
    },
  ];
}

module.exports = { generateCampaignVariants, getHardcodedFallbackVariants /* ...other exports */ };
```

### 3. `src/workers/dispatch.worker.js` — Fix 12.10 (Coalescing Name Fallback)

```javascript
// ── FIX 12.10: Coalescing fallback for missing firstName ──
const safeName = shopper.firstName || "Valued Customer";
const personalized = variant.template.replace('{{firstName}}', safeName);
```

### 4. `src/cron/opportunityEngine.cron.js` — Fix 12.12 (Distributed Cron Lock)

```javascript
const cron = require('node-cron');
const redis = require('../config/redis');
const { runOpportunityEngine } = require('./opportunityEngine.logic'); // your existing logic

cron.schedule('0 2 * * *', async () => {
  // ── FIX 12.12: Redis distributed lock prevents duplicate runs across replicas ──
  const lock = await redis.set('lock:opportunity_cron', '1', 'EX', 3600, 'NX');
  if (!lock) {
    logger.info('Opportunity cron skipped — lock held by another instance');
    return;
  }

  try {
    await runOpportunityEngine();
  } catch (err) {
    logger.error('Opportunity cron failed', err);
  }
});
```

---

## 12C. Tier 2 — README.md Section (paste as-is into project README)

```markdown
## Known Architectural Debt & Production Readiness

This system was built with a "Math First, AI Second" philosophy and includes
production-grade fixes for race conditions, hallucination guards, and
distributed locking (see Section 12 of the architecture blueprint for the
full audit). The following items are **identified, scoped, and intentionally
deferred** beyond the current build — they represent the next layer of
hardening required for multi-tenant, long-running production scale.

### 1. Redis as a Bandit Stats SPOF
**Risk:** If Redis restarts mid-campaign before the `banditFlush` worker runs,
in-flight `sent/opens/clicks` counters for that campaign are lost.

**Planned Fix:** Micro-batch flushing — every `processed % 50 === 0`, async-flush
the current Redis hash state into `Campaign.variants[].stats` in MongoDB,
rather than waiting for `COMPLETED`. This bounds data loss to at most 50
events per variant.

### 2. Global Backpressure ("Noisy Neighbor" Problem)
**Risk:** The current backpressure check (`queueMetrics.waiting > 10000`) is a
single global gate. One tenant launching a 15,000-person campaign can trigger
`429` responses for every other tenant, even for small campaigns.

**Planned Fix:** Per-tenant rate limiting via Redis token buckets —
`active_jobs:${tenantId}`, incremented on enqueue and decremented inside the
worker on job completion, with a per-tenant ceiling (e.g. 2,000 active jobs)
independent of global queue depth.

### 3. Vector Embedding Staleness
**Risk:** Embeddings are generated once per shopper. Behavioral drift (e.g. a
"bargain hunter" becoming a "premium loyalist") causes permanent
mis-segmentation in the RAG hybrid search over time.

**Planned Fix:** Event-driven re-embedding — trigger a low-priority job to
`embeddingRefreshQueue` when `totalOrders % 5 === 0` or when
`daysSinceLastEmbed > 90`, keeping the vector index continuously fresh
without nightly batch overhead.

### 4. Embedding Dimension Lock-In
**Risk:** The Atlas Vector Search index is hardcoded to 768 dimensions
(Google `embedding-001`). Switching providers or upgrading models (e.g. to a
1536-dim embedding) would require a breaking index rebuild.

**Planned Fix:** Vector schema versioning — add `embeddingVector_v2` alongside
the legacy field, stand up a parallel Atlas Vector Search index, backfill via
a background worker, then flip a feature flag in `rag.service.js` to route
queries to the new index with zero downtime. Drop the legacy field once
backfill reaches 100%.
```

---

## 13. Quick-Reference: "Why" Answers (from source doc, verbatim-preserved for interview prep)

| Question | One-Line Answer |
|---|---|
| Why LLM if RFM already filters? | RFM = who/what; RAG = latent intent ("vibe") for infinite micro-segment personalization at near-zero marginal cost |
| Redis vs MongoDB as source of truth? | Mongo = absolute truth; Redis = volatile runtime cache (AOF-backed), bandit stats async-flushed to Mongo on completion |
| Why BullMQ not Kafka? | Job orchestration (retries, scheduling, rate limits) > event sourcing/log-replay for this use case; lower ops complexity |

---

## 14. Tech Stack Summary

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
