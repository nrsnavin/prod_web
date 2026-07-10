# AI Implementation Plan — Jarvis ERP

Companion to `AI_AUTOMATION_REPORT.md`. That doc scoped *what* to build and
*why*; this one tracks *what's shipped* and gives a concrete build plan for
*what's left*, grounded in the actual codebase (endpoints, models, feature
folders, and the guardrail pattern we've been using).

Last updated: 2026-07-10.

---

## 1. Progress — what's already implemented

The entire **NOW** tier is shipped, on top of the pre-existing AI foundation.

### Shipped this program (NOW tier)

| # | Feature | Backend | Frontend | Real Claude? |
|---|---------|---------|----------|--------------|
| 3 | **Predictive-maintenance health score** | `GET /machine/predictive-health`, `GET /machine/health-advice/:id` (`api/machine.js`) | `MachineHealth.tsx` — list banner + detail card + on-demand AI diagnosis | Yes — AI diagnosis narrative; score itself is deterministic |
| 6 | **Proactive delivery-risk alerts** | `GET /order/eta-risks` (`api/order.js`) | `DeliveryRiskAlerts.tsx` in the forecast panel — WhatsApp/Copy, "AI" badge | Yes — AI rewrites the customer message; ETA math is deterministic |
| 5 | **Wastage root-cause insights** | `GET /wastage/root-cause` (`api/wastage.js`) | Wastage page "Root cause" tab — totals, hotspots, insights, AI analysis | Yes — AI root-cause + preventive actions; aggregations are deterministic |

### Pre-existing AI foundation (reused, not rebuilt)

| Capability | Where |
|---|---|
| Bayesian per-(elastic, machine) rate posterior | `EtaRatePosterior`, `utils/etaPosterior.js` |
| Order ETA + machines-vs-date what-if engine | `utils/orderEta.js`, `runningOrderEta.js`; `_computeRunningEtaForOrder` |
| Production anomalies + posterior drift | `api/production.js` + digest |
| Claude vision OCR (shift sheets) | `utils/shiftSheetOcr.js` — stage → verify → apply |
| Claude advisor briefing (`POST`) | `api/advisor.js` |
| Machine issue-frequency anomaly | machine-issue anomalies endpoint |
| Reorder suggestion (`suggestedQty`) | `api/rawMaterial.js` |
| QC record capture | `models/QcRecord.js`, `api/qc.js` (**backend only — no UI yet**) |

**Established pattern (keep for everything below):**
- Numbers stay **deterministic** (scores, ETA, optimizer objective); Claude
  only writes **narrative / messages / recommendations**.
- Every Claude call is wrapped in try/catch with a **rule-based fallback**, so
  features never break without an API key (shared `utils/anthropicClient.js`).
- **Human-in-the-loop** for anything that writes production numbers, messages a
  customer, or spends money: automate the *proposal*, keep the *approval* —
  same as OCR's stage → verify → apply.
- On-demand LLM calls (button-triggered) for cost control where possible.

---

## 2. Remaining features — build plan

Three **NEXT** features (flagship value) and four **LATER** features
(compounding). Each block below is scoped to our stack so it can be picked up
directly.

---

### NEXT-A · Autonomous production planning v1  🚩 flagship

**Automates:** manual job creation + machine/head assignment + sequencing.

**Approach (v1, greedy + local search — no OR-Tools dependency):**
1. Gather open order lines (Approved/InProgress) with `supplyDate`, quantities.
2. For each (elastic → candidate machine) pull the rate from `EtaRatePosterior`
   (reuse `utils/etaPosterior.js`), filtered by `Machine.elastics` head
   compatibility and current `Machine.status`.
3. Greedy assign by earliest due date; local-search swaps to (a) hit due dates,
   (b) balance machine load, (c) minimize elastic changeovers on a machine.
4. Output a proposed plan; **admin reviews and one-click accepts** (creates the
   JobOrders / shift-plan rows). Never auto-commits.

**Backend:** new `api/planner.js`
- `GET /planner/suggest-plan?horizonDays=` → `{ assignments[], unplaceable[], objective, assumptions[] }`. Deterministic optimizer.
- `POST /planner/accept` → materializes accepted assignments into JobOrders / shift plan (human-approved).
- Optional Claude: one call to write a plain-English **plan rationale** ("why this sequence") — narrative only.

**Frontend:** `features/planning/`
- "Generate plan" action on the Shift Plans / Orders screen → review table
  (elastic → machine/heads → start order → projected finish vs due), with
  changeover and load indicators; per-row accept/edit, then "Accept plan".
- Reuse `AsyncCombobox` for any overrides; reuse ETA panel styling.

**Guardrails:** show objective + assumptions + per-assignment confidence; edits
are captured as labels (see §3). Effort: **M–L**. Impact: **very high**.

**Acceptance:** given seeded orders + rates, suggest-plan returns a feasible
assignment set that respects head compatibility and beats naive FIFO on total
lateness; accept creates the correct JobOrders.

---

### NEXT-B · Vision QC v1 (defect capture + flywheel)

**Automates:** manual QC capture and defect judgement. **Note:** `QcRecord` +
`api/qc.js` exist but there is **no QC UI yet** — this ships the surface *and*
the vision assist together.

**Approach:** phone/line photo → Claude **vision** (zero-shot) classifies tape
defects (weave fault, width out-of-spec, color, missing spandex ends) against
the `Elastic` spec (ends/pick/width) → pre-fills a `QcRecord` draft
(`checks[]`, `result`, `defectCode`, `rejectedMeters`, confidence). **Inspector
verifies/overrides and saves** (stage → verify → apply, exactly like OCR).

**Backend:** extend `api/qc.js`
- `POST /qc/vision-draft` (multipart image) → returns a draft `QcRecord` +
  per-field confidence. Reuse the `VISION_MODEL` + image pipeline from
  `utils/shiftSheetOcr.js`.
- Existing QC create endpoint saves the verified record.
- Add an **image store** (S3/local `uploads`) — prerequisite; keep the photo on
  the record for the labeling flywheel.

**Frontend:** new `features/qc/`
- QC list + capture flow: upload/take photo → AI draft appears with confidence
  chips → inspector edits → save. Mirror the OCR review UI.

**Guardrails:** AI never final-saves; every override is a label. Effort: **M**.
Impact: **high** (and it starts the data flywheel for a future fine-tuned model).

**Acceptance:** uploading a defect photo returns a plausible pre-filled QcRecord
that a human can correct in ≤2 edits; saved record persists with the image.

---

### NEXT-C · Forecast-driven auto-PO (closed-loop procurement)

**Automates:** min/max reorder → proactive, order-pipeline-driven purchasing.

**Approach:** forecast raw-material consumption from the **approved order
pipeline** (`Order.rawMaterialRequired` / material requirement) + historical
`StockMovement` seasonality. When projected stock crosses the lead-time
horizon, **auto-draft a PO** to the default supplier for review (extends the
existing `suggestedQty` reorder logic from min/max to forecast-based).

**Backend:** extend `api/rawMaterial.js` / `api/supplier.js`
- `GET /materials/replenishment-forecast?horizonDays=` → per-material
  `{ onHand, projectedConsumption, projectedStockoutDate, suggestedQty, supplier }`. Deterministic.
- Reuse existing PO create for the human-approved draft (already wired from the
  reorder→PO flow; make it forecast-driven, pre-filled).
- Optional Claude: short narrative "why now / risk if skipped" per line.

**Frontend:** a "Replenishment forecast" panel on Raw Materials → review →
"Draft PO" (pre-fills PoCreatePage). Human approves and sends.

**Guardrails:** never auto-sends a PO; skips `suggestedQty ≤ 0` (bug already
fixed). Effort: **M**. Impact: **high**.

**Acceptance:** given a seeded order pipeline + stock, forecast flags the
correct materials before stockout and pre-fills a PO with positive quantities.

---

### LATER-D · Conversational ops assistant

Chat over live aggregations ("which orders are at risk this week?", "why is
COV-01 wasting so much?", "draft a PO for low latex"). RAG/tool-calling over the
existing read APIs (analytics/breakdown/ETA/eta-risks/root-cause); the
`advisor` endpoint is the seed. Backend: `api/assistant.js` with Claude
tool-use bound to whitelisted read endpoints (+ human-approved write actions).
Frontend: a chat drawer. Effort: **M–L**.

### LATER-E · Full document AI (extend the OCR win)

Same vision pipeline for **supplier invoices** (auto-match to PO → create
`MaterialInward`), **warping program sheets** (`WarpingPlan`), and **signed
DCs** (`DeliveryChallan`). Each: `POST /<area>/vision-draft` → staged draft →
human verify → apply. Effort: **M** per document type; reuses NEXT-B's image
store + review pattern.

### LATER-F · Warping/covering layout optimization

Optimize `WarpingPlan` beam/section/ends layout to minimize yarn waste and
setup changeovers across a batch. Deterministic optimizer (same engine family
as NEXT-A). Effort: **M–L**.

### LATER-G · Operator AI coaching

Per-operator natural-language coaching from production/wastage patterns + the
XP/level system. Extends gamification; Claude writes the coaching note from
deterministic per-operator stats. Effort: **S–M**.

### LATER-H · Fine-tuned defect model

Once NEXT-B's flywheel accrues labeled QC images, graduate the highest-volume
vision task from zero-shot Claude to a small fine-tuned/on-device model to cut
cost + latency. Effort: **L** (data-dependent — gated on NEXT-B volume).

---

## 3. Sequencing & cross-cutting

**Recommended order:**
1. **NEXT-C (auto-PO)** — smallest, extends existing reorder→PO; fast win.
2. **NEXT-B (Vision QC)** — ships the missing QC UI *and* starts the data
   flywheel; unblocks LATER-E (shared image store + review pattern) and
   LATER-H (labels).
3. **NEXT-A (autonomous planning)** — the flagship; most effort, most impact.
4. **LATER** tier as capacity allows (E and H both build on B).

**Data engine (build alongside):**
- Persist every human correction — OCR edits, QC overrides, accepted/edited
  plans, ETA predicted-vs-actual — as **labels**. That's the flywheel:
  deploy → humans correct → model learns → less correction next time.
- Add an **image store** (needed by NEXT-B, reused by LATER-E).
- Add an **events log** of plan-accept/edit and ETA actual-vs-predicted for
  continuous accuracy measurement (a free, honest scorecard).

**Guardrails (unchanged, non-negotiable):** human-in-the-loop for
production/customer/spend writes; confidence + explanations on every AI output;
cost caps on LLM/vision; measure accuracy continuously.

---

*Net: NOW tier done (3/3). Remaining = 3 NEXT + 4 LATER. Fastest path is
auto-PO → Vision QC (starts the flywheel) → autonomous planning (flagship),
each reusing the deterministic-core / LLM-narrative / human-approval pattern
already proven in the shipped features.*
