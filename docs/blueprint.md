# Project Cortex: System Blueprint

## The AI-Native Revenue Engine
Project Cortex is not a passive CRM; it is an active revenue engine. It combines deterministic database logic with semantic AI to form a continuous loop: **Understand → Discover → Execute → Learn**.

## High-Level Architecture
The system is a decoupled monorepo consisting of:
- **Frontend:** React + Vite, serving as the visual command center and telemetry dashboard.
- **Backend:** Node.js + Express, handling REST APIs, Agentic tool-calling, and database mutations.
- **Database:** MongoDB Atlas, acting as both the document store (Golden Records) and the Vector Database (384-dimension local embeddings).
- **Execution Engine:** Redis + BullMQ, orchestrating highly concurrent webhook processing and Multi-Armed Bandit (MAB) optimization.
- **External Stub:** A lightweight Express simulator that mimics email/SMS channel interactions and rigged click probabilities.

## Core Data Philosophy
We reject raw, messy event data. All ingestion runs through a **Translation Layer** that calculates deterministic heuristics (RFM - Recency, Frequency, Monetary) and generates an LLM-summarized "Digital Twin Persona". This ensures the Vector Search operates on meaning, not noise.
