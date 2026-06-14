# Shoppers & Hybrid Search Pipeline

## The Golden Record
Every `Shopper` in the database is a "Golden Record". It contains:
1. Standard PII (Name, Email).
2. Pre-calculated **RFM Math** (Lifetime Value, Order Count, Days Since Last Purchase).
3. A **Digital Twin Summary** (A dense English paragraph detailing their buying vibe).
4. An **Embedding Vector** (A 384-number array representing the semantic meaning of their twin summary).

## Local Embeddings via Transformers.js
To bypass API rate limits and costs during ingestion, Cortex runs `Xenova/all-MiniLM-L6-v2` locally via Hugging Face `Transformers.js`. This generates 384-dimensional vectors at zero cost with zero network latency.

## The Hybrid RAG Pipeline
When a marketer queries *"Find impulsive weekend hikers who spent over $5000"*:
1. **LLM Intent Parser:** An LLM extracts the deterministic math (`{ spent: { $gt: 5000 } }`) and the semantic vibe (`"impulsive weekend hikers"`).
2. **MongoDB Atlas `$vectorSearch`:** The database first runs a strict `$match` on the math (saving compute), then executes a Cosine Similarity vector search on the remaining subset.
3. **Result:** A highly accurate audience segment, retrieved in milliseconds.
