# The Unified Command Center

## Design Philosophy
Traditional CRMs force users to open dozens of tabs. Cortex implements an IDE-style, three-pane horizontal layout to merge **Insight, Discovery, and Telemetry** into a single view.

## The ROI Projections Engine
To maintain a 60 FPS responsive UI without hammering the database, the Command Center runs a real-time heuristics engine.
When an audience is retrieved, it calculates:
- **Estimated Revenue:** `Audience Size × Expected Conversion Rate × Segment Average Order Value (AOV)`
- **COGS & Marketing Cost:** Deducts fixed AI overhead and variable channel costs.
- **Net Projected Income:** Displayed instantly to the marketer before they launch.

## State Transitions
The UI reacts natively to the Campaign state machine:
- `DRAFT`: Focuses on Audience sizing and AI Variant generation.
- `EXECUTING`: Auto-collapses the setup panes and expands the Live Telemetry Grid to visualize real-time BullMQ job dispatching.
