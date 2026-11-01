# zelosify-assignment

Production-Grade Multi-Tenant Contract Hiring Platform featuring an Autonomous LLM Tool-Calling Agent, Deterministic Matching Engine, Strict RBAC, and Latency SLAs.

---

## 🎯 Architecture Overview

```text
Controller
   ↓
Recommendation Service
   ↓
Agent Orchestrator
   ↓
LLM Core (Tool-Calling Enabled: Gemini / Groq / Autonomous Engine)
   ↓
Tool Registry
   • Resume Parsing Tool (S3 retrieval, PDF/PPTX parser, Prompt Injection Mitigation)
   • Feature Extraction Tool
   • Skill Normalization Tool
   • Deterministic Matching Engine
   • Scoring Engine Tool: (0.5 * skill) + (0.3 * experience) + (0.2 * location)
   ↓
Schema Validator (Strict Ajv / JSON validation)
   ↓
Decision Policy (≥0.75 Recommended | 0.50-0.74 Borderline | <0.50 Not Recommended)
   ↓
ACID Persistence (Prisma Transaction)
```

---

## 👥 Personas & Capabilities

### 1. IT Vendor Persona (`IT_VENDOR`)
* **Contract Openings Directory**: Browse tenant-isolated contract positions with pagination, search, and status filters.
* **Opening Details**: Review requirements and view submitted profiles for this vendor (AI recommendation fields are strictly omitted per RBAC).
* **Direct S3 Upload**: Presigned S3 upload URLs under `<tenantId>/<openingId>/<timestamp>_<filename>` (PDF and PPTX supported).
* **Atomic Submission**: Submission handled inside a Prisma transaction, automatically triggering async AI candidate evaluation.
* **Profile Management**: Secure file preview via backend and soft deletion (`isDeleted = true`).

### 2. Hiring Manager Persona (`HIRING_MANAGER`)
* **My Openings**: View openings owned exclusively by the manager (`opening.hiringManagerId === loggedInUser.id`).
* **AI Evaluation Dashboard**: Review candidate profiles with:
  * Recommendation Badge (`Recommended`, `Borderline`, `Not Recommended`)
  * Match Score % & Confidence %
  * Processing Latency (ms)
  * Explainable AI Reasoning summary
* **Actions**: 1-click **Shortlist** and **Reject** buttons with transactional DB updates and file preview.
* **Performance & UX**: Table virtualization (>50 records windowing), skeleton loaders, dark/light theme, and error boundary.

---

## 🤖 AI Recommendation Agent Specification

* **Model Support**: Google Gemini 1.5 Flash (`GEMINI_API_KEY`), Groq LLaMA 3.3 70B (`GROQ_API_KEY`), or autonomous tool-calling engine for local execution.
* **Deterministic Scoring Formula (Invoked as Tool)**:
  $$\text{FinalScore} = (0.5 \times \text{skillMatch}) + (0.3 \times \text{experienceMatch}) + (0.2 \times \text{locationMatch})$$
* **Security**: Resume text sanitization mitigating prompt injection prior to LLM reasoning.
* **Observability**: Structured JSON logs tracking prompt/completion tokens, tool durations, latency, and reasoning turns.
* **Performance**: Sub-second execution meeting the P95 < 2000ms SLA.

---

## 🚀 Quick Start Guide

### 1. Start Docker Stack
```bash
cd Zelosify-Backend/Server
docker compose up -d
```

### 2. Run Database Migrations & Seed Openings
```bash
npm run prisma:migrate
npm run seed:openings
```
* Seeds tenant **"Bruce Wayne Corp"**, hiring manager **"Lucius Fox"**, and **14 distinct contract openings**.

### 3. Start Backend Server (Port 5000)
```bash
npm run dev
```

### 4. Start Frontend Portal (Port 5173)
```bash
cd ../../Zelosify-Frontend
npm run dev
```

---

## 🧪 Running Automated Tests

Run the full test suite in `Zelosify-Backend/Server`:
```bash
cd Zelosify-Backend/Server
npm test
```
* **27 tests across 5 test suites**:
  * Unit tests: experience boundaries, skill overlap normalization, location logic, formula correctness, RBAC & tenant isolation.
  * Integration tests: full flow (Upload → Submit → AI Recommendation → Shortlist).
  * Performance test: 100-profile simulation verifying P95 < 2000ms.


