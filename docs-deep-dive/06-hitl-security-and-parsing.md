# AI Safety, UI Firewalls, & HITL Parsing

## 1. The Vulnerability
Agentic LLMs operating with tools often hallucinate conversational text around their JSON payloads (e.g., *"Here is the campaign you requested: \`\`\`json { ... } \`\`\`"*). If the frontend blindly attempts to parse the entire response, the application will fatally crash.

## 2. The Regex Trap
The React Chatbot component implements a strict UI firewall. It scans the incoming LLM text for a highly specific tag:

```javascript
// Matches [CAMPAIGN_PROPOSAL: { ... }] regardless of newlines or internal spacing
const proposalRegex = /\[CAMPAIGN_PROPOSAL:\s*(\{[\s\S]*?\})\s*\]/;
const match = message.content.match(proposalRegex);
```

## 3. Parsing & Fallback Mechanics

If the regex matches, the UI extracts capture group [1] and attempts `JSON.parse()`.
```javascript
try {
  const proposalData = JSON.parse(match[1]);
  // Render the Safe Rich UI Component
  return <CampaignProposalCard data={proposalData} onApprove={...} />
} catch (e) {
  // The LLM hallucinated malformed JSON (e.g., missing a trailing quote).
  // Fallback UI prevents a white-screen crash.
  return <ErrorCard message="Agent payload corrupted. Please try generating again." />
}
```

## 4. The Execution Boundary

The `CampaignProposalCard` isolates the data. It requires the human to physically click "Approve & Save". Only this explicit interaction fires the `POST /api/campaigns` request. The LLM is structurally incapable of writing to the DB directly.
