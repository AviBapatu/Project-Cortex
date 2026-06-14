# Multi-Armed Bandit (MAB) Queue Orchestration

## 1. Campaign State Machine
A Campaign enforces strict immutability through three states:
`DRAFT` (Mutable) -> `EXECUTING` (Locked, workers active) -> `COMPLETED` (Terminal, final ROI locked).

## 2. Queue Architecture
We separate dispatch and telemetry to prevent IO blocking:
- **`dispatch_queue`**: Fires HTTP POST payloads to the Channel Stub.
- **`webhook_queue`**: Absorbs asynchronous callbacks (clicks/opens) from the Stub.

## 3. The 15% Exploration Concurrency Fix
When a campaign launches, it only enqueues 15% of the total audience. The variants (A, B, C) are distributed evenly.

As webhooks hit the server, workers execute atomic Redis increments:
`HINCRBY bandit:campaign_123:clicks A 1`

### The Race Condition
100 webhook workers might simultaneously realize that the 15% threshold of responses has been reached. Without a lock, all 100 workers would calculate the winner and push the remaining 85% of traffic into the dispatch queue, resulting in an 8500% traffic spam.

### The Distributed Lock Solution
We use MongoDB's atomic `findOneAndUpdate` as a strict mutex lock.
```javascript
// In webhook.worker.ts
if (totalResponses >= threshold_15_percent) {
  // Attempt to acquire the execution lock
  const lock = await Campaign.findOneAndUpdate(
    { _id: campaignId, status: 'EXECUTING' },
    { $set: { status: 'OPTIMIZING' } }, // State change acts as the lock
    { new: true }
  );

  if (lock) {
    // ONLY the single worker that successfully flipped the state 
    // to OPTIMIZING will calculate the winner and dispatch the 85%.
    const winner = calculateWinner(redisStats);
    await enqueueRemaining85Percent(campaignId, winner);
  }
}
```

**CTR Math:** The winner is chosen via absolute Click-Through Rate: `CTR = Sent_Variant / Clicks_Variant`.
