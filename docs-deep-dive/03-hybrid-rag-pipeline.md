# The Hybrid Discovery Pipeline

## 1. The Intent Parser (`search.controller.ts`)
When a user inputs a natural language query: *"Find impulsive hikers who spent over $1000"*, the system does not execute a blind vector search. 

The LLM Intent Parser extracts two distinct payloads:
1. **Semantic Vibe:** `"impulsive hikers"` -> Sent to local embedder -> `[0.012, -0.045, ...]`
2. **Deterministic Math:** `{"rfm.totalLifetimeValue": {"$gte": 1000}}`

## 2. MongoDB `$vectorSearch` Aggregation
We use the mathematical payload as a pre-filter to reduce the vector search space, saving immense compute power.

```javascript
const pipeline = [
  {
    $vectorSearch: {
      index: "vector_index", // Must be configured for 384 dims, Cosine similarity
      path: "embeddingVector",
      queryVector: embeddedQuery,
      numCandidates: 200,
      limit: 1000,
      filter: intentMath // e.g. { "rfm.monetary": { $gte: 1000 } }
    }
  },
  {
    $project: { embeddingVector: 0 } // Drop the heavy array from network transit
  }
];
```

## 3. Context Window Protection Strategy

If the `$vectorSearch` returns 1,000 Golden Records, piping them into an LLM to generate Campaign Variants will trigger a Context Window Overflow or "Lost in the Middle" hallucination.
**The Fix:** We execute an array slice (`audience.slice(0, 50)`). We only pass the Top 50 most semantically relevant Digital Twin summaries into the Variant Generator. This ensures latency remains under 4 seconds and the generated variants are hyper-targeted.
