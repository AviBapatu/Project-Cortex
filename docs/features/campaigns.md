# Campaign Generation & State Machine

## Context Window Protection
If a segment contains 5,000 shoppers, feeding all their data to an LLM to write an email will cause "Lost in the Middle" hallucination and exceed token limits. 
Cortex protects the context window by slicing the `audience` array. It only passes the **Top 50** Digital Twin summaries to the LLM to generate Variants A, B, and C.

## The State Machine
Campaigns follow a strict, enforced lifecycle:
1. **DRAFT:** Variants are generated, but no database writes occur until explicitly saved.
2. **EXECUTING:** The MAB engine takes over. The campaign is locked and cannot be edited.
3. **COMPLETED:** The webhook queue finishes draining, and final revenue attribution is locked.

## Variant Governance
The `CampaignSchema` enforces strict enums (`variantId: 'A' | 'B' | 'C'`). If the LLM hallucinates a "Variant D", the database rejects the save, preventing execution crashes.
