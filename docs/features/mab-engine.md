# Multi-Armed Bandit (MAB) Queue Orchestration

This is the central execution engine of Project Cortex. It abandons traditional, slow A/B testing in favor of real-time exploitation.

## The Queue Architecture (BullMQ)
We explicitly rejected Kafka in favor of BullMQ. Kafka is for durable event streaming; Cortex requires robust **job orchestration** (retries, rate limiting, and exact worker execution).
- **`dispatch_queue`:** Pushes outgoing payloads to the Channel Stub.
- **`webhook_queue`:** Processes asynchronous incoming clicks from the Stub.

## The 15% Exploration Phase
1. Upon launch, Cortex only dispatches the campaign to **15%** of the selected audience.
2. It pauses dispatching and waits for the webhook callbacks.

## Redis Atomic Counters & The Shift
As webhooks hit the API, the workers increment atomic Redis counters (`INCR variant:A:clicks`). 
Once the `webhook_queue` detects that the 15% phase is complete, the Bandit evaluates the Redis keys, identifies the highest CTR, and dynamically injects the remaining **85%** of the audience back into the `dispatch_queue` using ONLY the winning variant.

## Distributed Locks
To prevent a race condition where 100 concurrent webhooks try to trigger the 85% dispatch simultaneously, Cortex utilizes MongoDB `findOneAndUpdate` as a distributed lock.
