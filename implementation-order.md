# 🛠️ Project Cortex — Step-by-Step Implementation Order

A linear build path. Each phase produces something *runnable/testable* before moving to the next — no big-bang integration at the end.

---

## Phase 0 — Repo & Folder Skeleton

```bash
mkdir project-cortex && cd project-cortex
mkdir -p service-a-crm/src/{config,models,routes,controllers,services,queues,workers,cron,middleware,utils}
mkdir -p service-b-channel-stub/src/{routes,utils}
mkdir -p client
git init
touch docker-compose.yml README.md
```

Create `.env` files (empty, fill later) in `service-a-crm/` and `service-b-channel-stub/`.

Add a root `.gitignore`:
```
node_modules/
.env
dist/
```

✅ **Checkpoint:** Folder structure matches the blueprint. Commit as "scaffold".

---

## Phase 1 — Service A: Boot the API Shell

1. `cd service-a-crm && npm init -y`
2. Install core deps:
   ```bash
   npm install express mongoose dotenv ioredis cors morgan
   npm install -D nodemon
   ```
3. Build:
   - `src/config/env.js` — loads & validates `.env`
   - `src/config/db.js` — Mongoose connection to Atlas
   - `src/config/redis.js` — single shared ioredis client
   - `src/server.js` — Express app, connects DB + Redis, health check route `GET /health`
4. Add `package.json` scripts:
   ```json
   "scripts": {
     "start:api": "node src/server.js",
     "dev:api": "nodemon src/server.js"
   }
   ```

✅ **Checkpoint:** `npm run dev:api` → `GET /health` returns 200, Mongo + Redis connected.

---

## Phase 2 — Schemas First (Before Any Logic)

Build all 4 models in `src/models/`:
- `Shopper.js` (with `{ timestamps: true }`, RFM block, AI block, indexes)
- `Campaign.js` (variants with enum `variantId`, default-zero stats, status enum)
- `Opportunity.js`
- `Order.js`

✅ **Checkpoint:** Write a tiny `src/scripts/testModels.js` that creates one doc per model and logs it. Run once, confirm in Atlas/Compass, then delete the test docs.

---

## Phase 3 — Seed Data

1. `npm install @faker-js/faker`
2. `src/scripts/seed.js`:
   - Generate ~200 `Shopper` docs (no RFM/embedding yet — just profile fields)
   - Generate 1–10 `Order` docs per shopper with realistic `purchasedAt` dates and amounts
3. Run: `node src/scripts/seed.js`

✅ **Checkpoint:** Atlas shows ~200 shoppers and ~1000 orders.

---

## Phase 4 — Deterministic RFM Engine (No AI Yet)

1. Build `src/services/rfm.service.js`:
   - `calculateRFM(customerId)` — pulls `Order` docs, computes recency/frequency/monetary quintile scores, `totalLifetimeValue`, `daysSinceLastPurchase`, `totalOrders`
   - Writes results into `Shopper.rfm`
2. `src/scripts/runRfmBatch.js` — loops all shoppers, calls `calculateRFM`

✅ **Checkpoint:** Run the batch script. Confirm `rfm` fields populated in Atlas. This is **pure math** — no API keys needed yet, so test it thoroughly now.

---

## Phase 5 — Digital Twin + Embeddings (First AI Integration)

1. Get a Google AI API key, add `GOOGLE_API_KEY` + `EMBEDDING_MODEL=embedding-001` to `.env`
2. Build `src/services/digitalTwin.service.js`:
   - `generateSummary(customerId)` — aggregates `Order` history into a plain-text summary
3. Build `src/services/embedding.service.js`:
   - `embedShopper(shopper)` — calls Google embedding-001, handles 429/500 fallback (`embeddingVector = null`, `status = 'EMBEDDING_PENDING'`)
   - **At this stage**, just `console.log` the fallback instead of enqueueing (queues don't exist yet) — leave a `// TODO: enqueue embeddingRefreshQueue` comment
4. `src/scripts/runEmbeddingBatch.js` — loops all shoppers, generates summary + embedding

✅ **Checkpoint:** Run the batch. Confirm `ai.digitalTwinSummary` and `ai.embeddingVector` (768-length array) populated for most shoppers. A few may be `EMBEDDING_PENDING` — that's expected and fine.

---

## Phase 6 — Atlas Vector Search Index (Manual UI Step)

In MongoDB Atlas UI → your `shoppers` collection → Search Indexes → Create:
```json
{
  "type": "vectorSearch",
  "fields": [
    { "type": "vector", "path": "ai.embeddingVector", "numDimensions": 768, "similarity": "cosine" },
    { "type": "filter", "path": "rfm.totalLifetimeValue" },
    { "type": "filter", "path": "rfm.daysSinceLastPurchase" }
  ]
}
```

✅ **Checkpoint:** Index status shows "Active" in Atlas (can take a few minutes).

---

## Phase 7 — Hybrid Search + LLM Template Generation

1. Build `src/services/rag.service.js`:
   - `hybridSearch({ rfmFilters, queryText })` — `$vectorSearch` aggregation with `filter` clause on RFM fields
   - `generateCampaignVariants(segmentDescription)` — single Gemini call → 3 variants
   - **Build the Tier-1 fix (12.5) right here, not later**: JSON validation + `getHardcodedFallbackVariants()`
2. Write `src/scripts/testRag.js` — call `hybridSearch` with a sample query + `generateCampaignVariants` with a sample segment description, log results

✅ **Checkpoint:** `hybridSearch` returns a filtered shopper list; `generateCampaignVariants` returns exactly 3 valid `{ variantId, template }` objects (real or fallback). Test the fallback path deliberately by temporarily feeding garbage into the parser.

---

## Phase 8 — Campaign Creation API (DRAFT Status)

1. Build `src/models` already done — now `src/controllers/campaign.controller.js`:
   - `createCampaign` — runs `hybridSearch` + `generateCampaignVariants`, saves `Campaign` with `status: 'DRAFT'`, `audienceSize`, `segmentQuery`
   - `getCampaign`, `listCampaigns`
2. `src/routes/campaigns.routes.js` → `POST /api/campaigns`, `GET /api/campaigns`, `GET /api/campaigns/:id`
3. Mount routes in `server.js`

✅ **Checkpoint:** `POST /api/campaigns` with a sample goal/segment description returns a `DRAFT` campaign with 3 variants and a correct `audienceSize`. Test via Postman/curl.

---

## Phase 9 — Redis + BullMQ Queue Setup

1. Run Redis locally: `docker run -d -p 6379:6379 redis`
2. `npm install bullmq`
3. Build `src/queues/queues.js` — instantiate and export:
   - `dispatchQueue` (concurrency 50, used by workers not here)
   - `webhookQueue` (concurrency 100)
   - `embeddingRefreshQueue`
   - `banditFlushQueue`
4. Build producer helpers:
   - `src/queues/dispatch.queue.js` — `enqueueDispatchJob(...)`, `enqueueRemaining85Percent(...)`
   - `src/queues/webhook.queue.js` — `enqueueWebhookJob(...)`

✅ **Checkpoint:** Write `src/scripts/testQueue.js` — add a dummy job to `dispatchQueue`, confirm it appears in Redis (`redis-cli KEYS bull:*`).

---

## Phase 10 — Backpressure Middleware

1. Build `src/middleware/backpressure.middleware.js`:
   ```javascript
   const queueMetrics = await dispatchQueue.getJobCounts();
   if (queueMetrics.waiting > 10000) {
     await Campaign.updateOne({ _id: id }, { status: 'QUEUED' });
     return res.status(429).json({ error: "System at capacity. Campaign queued." });
   }
   next();
   ```
2. Add `POST /api/campaigns/:id/launch` route, apply middleware, then:
   - Set `status: 'EXECUTING'`
   - Enqueue 15% of audience to `dispatch_queue` (no worker consuming yet — jobs will just queue up)

✅ **Checkpoint:** Launching a campaign moves it to `EXECUTING` and `redis-cli` shows ~15% of audience-size jobs waiting in `dispatch_queue`.

---

## Phase 11 — Service B: Channel Stub (Build Now, Needed for Workers)

1. `cd service-b-channel-stub && npm init -y`
2. Install: `npm install express axios dotenv`
3. Build:
   - `src/server.js` — Express app on `:5000`
   - `src/routes/send.routes.js` — `POST /send` — accepts `{ to, body, messageId, campaignId, variantId }`, simulates delay (`SIMULATED_DELAY_MS`), simulates random failure (`SIMULATED_FAILURE_RATE`)
   - `src/utils/fireWebhook.js` — after delay, POSTs back to Service A:
     `POST http://localhost:4000/webhooks/stub` with `{ messageId, campaignId, variantId, eventType: 'delivered' | 'opened' | 'clicked' | 'failed' }`
     (randomize `opened`/`clicked` for realism)

✅ **Checkpoint:** `curl -X POST localhost:5000/send -d '{...}'` → after delay, your terminal (or a temporary log endpoint on Service A) shows the webhook callback arriving.

---

## Phase 12 — Webhook Ingestion + Idempotency

1. Build `src/controllers/webhook.controller.js`:
   - Idempotency check FIRST (Tier-1 fix 12.3 — namespaced):
     ```javascript
     const isNew = await redis.set(`webhook:${provider}:${campaignId}:${messageId}`, "1", "EX", 86400, "NX");
     if (!isNew) return res.sendStatus(200);
     await webhookQueue.add('process', payload);
     return res.sendStatus(202);
     ```
2. `src/routes/webhooks.routes.js` → `POST /webhooks/:provider`
3. Mount in `server.js`

✅ **Checkpoint:** Fire the same webhook payload twice (same `messageId`) → second call is dropped, only one job lands in `webhook_queue`.

---

## Phase 13 — Bandit Service

Build `src/services/bandit.service.js`:
- `recordSent(campaignId, variantId)` — `HINCRBY bandit:${campaignId}:${variantId} sent 1`
- `recordEvent(campaignId, variantId, eventType)` — increments `opens`/`clicks`
- `pickWinner(campaignId)` — ArgMax(CTR), fallback to Open Rate, fallback to `'C'`

✅ **Checkpoint:** `src/scripts/testBandit.js` — manually `HINCRBY` some fake stats via the service, then call `pickWinner` and verify each fallback branch (all CTR=0, all opens equal, etc.) by hand-crafting Redis state.

---

## Phase 14 — Workers (Build & Run as Separate Process)

1. Create `service-a-crm/workers.entry.js` — imports and starts all workers below
2. Add script: `"start:workers": "node workers.entry.js"`, `"dev:workers": "nodemon workers.entry.js"`

### 14a — `src/workers/dispatch.worker.js`
- Concurrency 50
- Fetch shopper + campaign + variant
- **Tier-1 fix 12.10**: `const safeName = shopper.firstName || "Valued Customer"`
- Late-personalize template, `axios.post` → Service B `/send`
- `bandit.recordSent(...)`, `Campaign.processed += 1`
- Check `COMPLETED` (`processed === audienceSize` → enqueue `bandit_flush_queue`)
- Check `FAILED` with **Tier-1 minimum-volume gate** (12.8): only evaluate `failed/processed > 0.2` once `processed > audienceSize * 0.05`

### 14b — `src/workers/webhook.worker.js`
- Concurrency 100
- On `opened`/`clicked` → `bandit.recordEvent`
- On `failed` → `Campaign.failed += 1`
- **Tier-1 fix 12.2**: atomic `findOneAndUpdate` lock for the 15% → OPTIMIZING transition, then `pickWinner` + `enqueueRemaining85Percent`

### 14c — `src/workers/embeddingRefresh.worker.js`
- Low concurrency (3–5)
- Retries `embedding.service.js` for `EMBEDDING_PENDING` shoppers

### 14d — `src/workers/banditFlush.worker.js`
- On trigger: `HGETALL bandit:${campaignId}:*` → write into `Campaign.variants[].stats`

✅ **Checkpoint — End-to-End Test:**
1. Run API (`npm run dev:api`), workers (`npm run dev:workers`), and Service B (`npm start`) simultaneously.
2. `POST /api/campaigns` → `POST /api/campaigns/:id/launch`
3. Watch logs: dispatch_queue jobs fire → Service B responds → webhooks return → bandit stats increment → at 15% the OPTIMIZING transition fires exactly once → remaining 85% dispatches the winner → campaign reaches `COMPLETED` → `Campaign.variants[].stats` populated.

This is the **core milestone** — if this loop works end-to-end, the hardest part is done.

---

## Phase 15 — Opportunity Engine (Cron)

1. `npm install node-cron`
2. Build `src/cron/opportunityEngine.logic.js`:
   - Deterministic Mongo query (e.g. `daysSinceLastPurchase > 90 AND totalLifetimeValue > 1000`)
   - If matches found, single Gemini call → `llmTitle`/`llmDescription`
   - Upsert `Opportunity` doc with `status: 'NEW'`
3. Build `src/cron/opportunityEngine.cron.js`:
   - **Tier-1 fix 12.12**: Redis `SET NX EX 3600` lock before running
   - Schedule `0 2 * * *`, but also export a manually-callable function for testing
4. Start cron from `workers.entry.js` (single owner — don't also start it in `server.js`)

✅ **Checkpoint:** Manually invoke the cron function (bypass schedule) → confirm an `Opportunity` doc is created with a sensible `llmTitle`. Run it twice quickly → second run is skipped due to the lock.

---

## Phase 16 — Opportunity & Campaign Read APIs for Dashboard

1. `src/controllers/opportunity.controller.js` + `src/routes/opportunities.routes.js`:
   - `GET /api/opportunities?status=NEW`
   - `POST /api/opportunities/:id/convert` → creates a `Campaign` (DRAFT) using the opportunity's `ruleDefinition` as `segmentQuery`
2. `src/controllers/shoppers.routes.js` — basic `GET /api/shoppers` (paginated, for debugging)

✅ **Checkpoint:** All REST endpoints listed in the blueprint respond correctly via Postman.

---

## Phase 17 — Frontend Dashboard

1. `cd client && npx create-next-app@latest .` (or Vite + React)
2. Pages/components:
   - Campaign list (status badges matching the state machine)
   - Campaign detail — live variant stats (poll `GET /api/campaigns/:id` every few seconds)
   - Opportunity cards — "Convert to Campaign" button
   - Campaign creation form (goal/segment description input)
3. Point all requests to `http://localhost:4000/api/...`

✅ **Checkpoint:** Full UI flow — create campaign → launch → watch status move EXECUTING → OPTIMIZING → COMPLETED with live stats.

---

## Phase 18 — Load/Edge Testing (Validate Tier-1 Fixes)

1. **Race condition test (12.2):** Fire 20+ webhook events in rapid parallel `Promise.all` right as a campaign crosses 15% — confirm only ONE `OPTIMIZING` transition and no double-dispatch (`processed` shouldn't exceed `audienceSize`).
2. **LLM fallback test (12.5):** Temporarily mock Gemini to return invalid JSON — confirm `getHardcodedFallbackVariants()` kicks in and campaign creation still succeeds.
3. **Null name test (12.10):** Manually set a shopper's `firstName` to `null`/empty — confirm dispatched message reads "Hi Valued Customer,".
4. **Backpressure test:** Temporarily lower `BACKPRESSURE_THRESHOLD` to a tiny number, launch a campaign, confirm `429` + `status: 'QUEUED'`.
5. **Idempotency test (12.3):** POST the same webhook payload twice → confirm only one job processed.

✅ **Checkpoint:** All 4 Tier-1 fixes verified under adversarial conditions.

---

## Phase 19 — Dockerize & Document

1. Write `Dockerfile` for `service-a-crm` and `service-b-channel-stub`
2. Write `docker-compose.yml` — `redis`, `service-a-api`, `service-a-workers`, `service-b`, `client`
3. Finalize `README.md` (architecture diagram, setup instructions, known debt section — already drafted)
4. `docker-compose up` → confirm everything boots together

✅ **Checkpoint:** Fresh clone + `docker-compose up` + seed script = working demo.

---

## Phase 20 — Record Walkthrough Video

Script order matches the build order above. Highlight, in this sequence:
1. Architecture diagram + 5 core principles
2. Live demo: create → launch → 15% bandit decision → 85% winner dispatch → COMPLETED
3. Opportunity Engine cron output
4. **Explicitly call out the 4 Tier-1 production fixes** (race condition lock, LLM validation fallback, name coalescing, cron distributed lock) — show the code
5. Known Architectural Debt section — explain the 4 deferred items and your scaling plan for each

---

## 📋 Summary Checklist

```
[ ] Phase 0  — Folder structure + git init
[ ] Phase 1  — Service A API shell (health check)
[ ] Phase 2  — 4 Mongoose schemas
[ ] Phase 3  — Seed ~200 shoppers + orders
[ ] Phase 4  — RFM batch calculation (pure math)
[ ] Phase 5  — Digital twin + embeddings (first AI call)
[ ] Phase 6  — Atlas Vector Search index (manual UI)
[ ] Phase 7  — Hybrid search + LLM variant generation + fallback
[ ] Phase 8  — POST /api/campaigns (DRAFT)
[ ] Phase 9  — Redis + BullMQ queue registry
[ ] Phase 10 — Backpressure middleware + launch endpoint
[ ] Phase 11 — Service B channel stub
[ ] Phase 12 — Webhook ingestion + idempotency
[ ] Phase 13 — Bandit service + pickWinner
[ ] Phase 14 — All 4 workers (dispatch, webhook, embeddingRefresh, banditFlush) — CORE MILESTONE
[ ] Phase 15 — Opportunity engine cron + distributed lock
[ ] Phase 16 — Remaining read APIs
[ ] Phase 17 — Frontend dashboard
[ ] Phase 18 — Adversarial testing of Tier-1 fixes
[ ] Phase 19 — Docker + final README
[ ] Phase 20 — Walkthrough video
```
