# Data Ingestion, RFM Mathematics, & The Golden Record

## 1. The Ingestion Pipeline (`seed.ts` & `ingestData.ts`)
Raw relational data (CSV/SQL) is toxic to semantic vector searches. Cortex relies on a **Translation Layer** to convert tabular MQL (Marketing Qualified Lead) rows into vectorized "Golden Records".

### Step 1: RFM Calculation (Deterministic Math)
For every raw shopper, we aggregate their order history using the standard RFM heuristic:
- **Recency ($R$):** $Days\_Since\_Max(Order\_Dates)$
- **Frequency ($F$):** $Count(Orders)$
- **Monetary ($M$):** $\sum (Order\_Totals)$

### Step 2: The Translation Layer (Tabular to Lexical)
We map the raw MQL data into an intermediate "Fact String":
> *"Shopper ID 8472 has an LTV of $4,200 across 12 orders. Their last purchase was 8 days ago. They primarily buy carabiners, climbing rope, and freeze-dried meals."*

### Step 3: Digital Twin Synthesis
The Fact String is sent to the LLM (Groq) with a strict system prompt to generate the `digitalTwinSummary`:
> *"This is a high-frequency, low-AOV impulsive weekend hiker who optimizes for utility and survival gear. They respond well to urgency and technical specs."*

### Step 4: Local Vectorization
The `digitalTwinSummary` string is passed through `Transformers.js` (`Xenova/all-MiniLM-L6-v2`), outputting a `Float32Array(384)`. Both the RFM Math object and the 384D Vector are saved to the MongoDB `Shopper` Document, creating the **Golden Record**.
