# 🧠 Project Cortex — Next-Generation AI CRM

Project Cortex is an intelligent, automated CRM engine that combines deterministic RFM mathematics with generative AI to identify opportunities and orchestrate A/B/C tested engagement campaigns.

## 🏗️ Architecture

Cortex is built on a distributed microservices architecture:
- **Service A (CRM Core)**: Express API handling models, RFM calculations, and campaign orchestration.
- **Service A (Workers)**: Isolated BullMQ workers processing the heavy lifting of campaign dispatch, webhook ingestion, and AI embeddings.
- **Service B (Channel Stub)**: Simulates an SMS/Email provider like Twilio/Sendgrid. Acknowledges dispatches and fires delivery/engagement webhooks back to Service A.
- **Frontend Dashboard**: A lightweight, modern vanilla JS single-page application connecting to the core API.
- **MongoDB Atlas**: Primary datastore + Vector Search.
- **Redis**: Queue backend (BullMQ), idempotency locks, distributed cron locks, and high-speed Multi-Armed Bandit counters.

## 🛡️ Tier-1 Production Defenses

This system includes 4 critical fixes to ensure it survives production loads:
1. **The 15% Race Condition Lock** (`webhook.worker.ts`): Uses atomic MongoDB `findOneAndUpdate` (CAS) to ensure only ONE worker transitions the campaign to `OPTIMIZING` and dispatches the remaining 85%, preventing double-sends.
2. **The Minimum-Volume Gate** (`dispatch.worker.ts`): Prevents campaigns from aborting prematurely due to early failure spikes by enforcing a 5% sample threshold before checking failure rates.
3. **Namespaced Idempotency** (`webhook.controller.ts`): Uses Redis `SET NX EX 86400` with keys like `webhook:provider:campaignId:messageId` to drop duplicate webhooks with a fast `200 OK`.
4. **Distributed Cron Locks** (`opportunityEngine.cron.ts`): Prevents the nightly Opportunity Engine from executing multiple times if Service A is horizontally scaled, using a 1-hour Redis TTL lock.

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- MongoDB Atlas cluster (with a `vectorSearch` index configured on `ai.embeddingVector` — see Phase 6 in docs)
- Redis server
- Google Gemini API Key

### Option 1: Native Run

1. Clone the repo and install dependencies:
   ```bash
   cd project-cortex
   cd service-a-crm && npm install
   cd ../service-b-channel-stub && npm install
   ```

2. Configure Environments:
   Add your keys to `service-a-crm/.env` and `service-b-channel-stub/.env`.

3. Start everything:
   ```bash
   # Terminal 1: Core API
   cd service-a-crm && npm run dev:api
   
   # Terminal 2: Workers
   cd service-a-crm && npm run dev:workers
   
   # Terminal 3: Service B Stub
   cd service-b-channel-stub && npm run dev
   ```

4. Open the frontend:
   Simply open `client/index.html` in your browser. No build required!

### Option 2: Docker Compose

You can boot the entire stack natively with Docker Compose. This automatically spins up a local Redis instance and links the services.

```bash
docker-compose up --build
```
*Note: Make sure `.env` files are populated first.*

## 🛣️ Known Architectural Debt

While Cortex is built for scale, these 4 areas are intentionally deferred and represent the next evolution:
1. **No Dead Letter Queues (DLQs)**: Failing jobs simply log errors. We need true DLQs and retry backoffs for resilient async processing.
2. **Vector DB Syncing**: Atlas syncs data seamlessly, but tightly coupling our CRM schema with dense vectors can get expensive. A dedicated external Vector DB (like Pinecone) might be better long-term.
3. **LLM Hallucination Monitoring**: We currently fallback to hardcoded templates if the LLM produces invalid JSON, but we have no semantic monitoring for bad marketing copy.
4. **Monolithic Repo**: `service-a-crm` houses both API and Workers. They are separate processes, but share the same codebase. A true microservice architecture would decouple them into separate deployment pipelines.