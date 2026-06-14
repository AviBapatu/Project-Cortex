# Cortana: AI Assistant & Tool Calling

## The Autonomous Co-Pilot
Cortex includes an embedded AI assistant powered by Groq (`llama-3.3-70b-versatile`). It acts as a conversational interface over the entire database via strictly defined tool-calling.

## Available Tools
- `query_audience`: Executes the Hybrid RAG pipeline to size audiences via natural language.
- `get_analytics`: Fetches real-time MAB telemetry.
- `create_campaign`: Drafts variants and prepares a campaign launch payload.

## Human-in-the-Loop (HITL) Security Boundary
**The AI has zero direct write access to MongoDB.** If the LLM decides to use `create_campaign`, it is strictly configured as a "staging" tool. 
1. The AI outputs a specialized tag: `[CAMPAIGN_PROPOSAL: { payload } ]`.
2. The React frontend intercepts this tag via Regex and renders an interactive Rich Component.
3. The database mutation ONLY occurs if the human clicks "Approve & Save". 
This protects the enterprise database from LLM hallucinations while maintaining high-speed orchestration.
