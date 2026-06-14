# Frontend Telemetry & Dynamic ROI Dashboard

## 1. Dynamic ROI Calculation
To achieve a 60 FPS dashboard without database blocking, the React frontend calculates ROI projections client-side entirely via local state variables.

**The Formula:**
$$Revenue = Audience\_Size \times Expected\_CTR \times Assumed\_AOV$$
$$COGS = Revenue \times 0.40$$
$$Net\_Income = Revenue - COGS - Marketing\_Spend - AI\_Overhead$$

*Note: `Assumed_AOV` is heuristically mapped on the frontend based on the Persona cluster identified in the search.*

## 2. Unified Command Center UI Logic
The UI implements an IDE-style 3-pane layout using CSS Grid and dynamic template columns.
```css
.campaign-workspace {
  display: grid;
  grid-template-columns: var(--left-width) var(--middle-width) var(--right-width);
  transition: grid-template-columns 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

State transitions trigger CSS class changes (not unmounting) to slide panes into view.

## 3. Live Polling Mechanism

During the `EXECUTING` phase, the frontend utilizes a `useEffect` hook with a `setInterval` of 1500ms to hit `GET /api/campaigns/:id/stats`. This fetches the Redis counters and visually animates the Variant Leaderboard, giving the user physical visual feedback of the Bandit routing traffic.
