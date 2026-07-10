# AI Automation Report — Jarvis ERP (Elastic Manufacturing)

*Framed as a Lead AI Engineer would scope it: bias toward closed-loop
automation, computer vision, predictive control, and a data flywheel —
"the machine that runs the factory," not just dashboards.*

---

## TL;DR — the three bets that matter

1. **Autonomous production planning.** Today an admin hand-creates jobs and
   assigns machines. You already have the hard part — a Bayesian
   per-(elastic, machine) rate model (`EtaRatePosterior`) and a working
   ETA/what-if engine. Wrap it in an optimizer and the app can *propose the
   entire day's job plan* (which elastic on which machine/heads, sequenced
   to hit supply dates with minimum changeovers). This is the single
   highest-ROI automation. **Effort: M–L. Impact: very high.**

2. **Vision QC + document AI.** You've proven Claude vision works
   (shift-sheet OCR). Point the same capability at (a) **defect detection**
   on elastic tape (weave faults, width, missing spandex ends) feeding
   `QcRecord` automatically, and (b) **supplier invoices / DCs** auto-matched
   to POs and inward. **Effort: M. Impact: high.**

3. **Predictive maintenance (closed loop).** You already detect issue
   *frequency* anomalies and posterior *rate drift*. Combine drift + timer
   patterns + issue history to **predict a breakdown before it happens** and
   auto-schedule service. **Effort: S–M. Impact: high (protects throughput).**

---

## What's already AI — the foundation to build on

| Capability | Where | Extend it to… |
|---|---|---|
| Bayesian rate posterior per (elastic, machine) | `EtaRatePosterior`, `utils/etaPosterior.js` | Autonomous scheduling, yield prediction |
| Order ETA + machines-vs-date what-if | `utils/orderEta.js`, `runningOrderEta.js` | Auto-plan generation, proactive slip alerts |
| Production anomalies + posterior drift | `api/production.js`, digest | Predictive maintenance |
| Claude vision OCR (shift sheets) | `utils/shiftSheetOcr.js` | Defect vision, invoice/DC intake |
| Claude advisor briefing | `api/advisor.js` | Conversational ops assistant |
| Machine issue-frequency anomaly | `/machine-issue/anomalies` | Failure prediction |
| Projected stockouts, reorder (min/max) | `api/rawMaterial.js` | Demand-forecast replenishment |

**Read:** you are ~40% of the way to a self-driving factory app. Most of the
proposals below reuse data you *already capture in structured form* — the
expensive part (clean, labeled operational data) largely exists.

---

## The opportunity map

### 1. Autonomous production planning (the flagship)
- **Automates:** manual job creation + machine/head assignment + sequencing.
- **How:** constraint optimizer (OR-Tools / greedy+local-search) over the
  `EtaRatePosterior` rates. Inputs: open order lines + supply dates, machine
  head-elastic compatibility (`Machine.elastics`), current machine status,
  attendance momentum. Output: a proposed set of jobs (elastic→machine→heads,
  start order) that hits due dates, balances load, and minimizes elastic
  changeovers. Admin reviews & one-click accepts (human-in-loop, like OCR).
- **Data:** `Order`, `Elastic`, `Machine`, `ShiftDetail`, `EtaRatePosterior`.
- **Tesla lens:** this is "the machine that builds the machine" — the schedule
  writes itself and re-plans when reality drifts.

### 2. Computer-vision quality control
- **Automates:** manual QC capture and defect judgement.
- **How:** phone/line camera → vision model classifies tape defects (weave
  fault, width out-of-spec, color, missing spandex ends) and auto-creates a
  `QcRecord` with a photo + confidence. Start with Claude/GPT-vision zero-shot;
  graduate to a fine-tuned model once you've collected labeled images (the
  QC screen becomes your labeling tool — a **data flywheel**).
- **Data:** `QcRecord`, `Elastic` spec (ends/pick/width).

### 3. Predictive maintenance
- **Automates:** reactive breakdowns → planned service.
- **How:** per-machine health score from (a) posterior rate drift, (b) timer/
  downtime trend in `ShiftDetail`, (c) `MachineIssue` frequency/severity, (d)
  time since last `serviceLog`. Cross a threshold → auto-raise a "service due"
  issue and put it in the digest. Later: survival model for time-to-failure.
- **Data:** `ShiftDetail`, `MachineIssue`, `Machine.serviceLogs`.

### 4. Demand-forecast replenishment (closed-loop procurement)
- **Automates:** min/max reorder → proactive, order-driven purchasing.
- **How:** forecast raw-material consumption from the *approved order
  pipeline* (via `materialRequirement`) + historical `StockMovement`
  seasonality; when projected stock crosses lead-time horizon, **auto-draft a
  PO** to the default supplier (you already have one-click PO-from-suggestion;
  make it forecast-driven and auto-created for review).
- **Data:** `RawMaterial`, `StockMovement`, `MaterialInward`, `Order`.

### 5. Wastage root-cause & prevention
- **Automates:** wastage stays descriptive → becomes predictive.
- **How:** NLP-cluster the free-text `Wastage.reason`, correlate with
  (machine, operator, elastic, shift, weekday). Surface systemic drivers
  ("LOOM-02 + Jacquard 40mm = 3× wastage") and **flag high-risk runs before
  they start** on the suggested plan.
- **Data:** `Wastage`, `ShiftDetail`.

### 6. Proactive delivery-risk comms (closed loop on ETA)
- **Automates:** manual customer chasing.
- **How:** when running-ETA slips past the promised `supplyDate`, auto-draft a
  customer WhatsApp/email (you already have Twilio WhatsApp + the ETA), and an
  internal escalation. Human approves the send.
- **Data:** `Order`, running-ETA, `NotificationSettings`.

### 7. Document AI everywhere (extend the OCR win)
- **Automates:** paper intake beyond shift sheets.
- **How:** same vision pipeline for **supplier invoices** (auto-match to PO,
  create inward), **warping program sheets**, and **signed DCs**. Everything
  paper becomes structured, verified data.
- **Data:** `PurchaseOrder`, `MaterialInward`, `Warping`, `DeliveryChallan`.

### 8. Conversational ops assistant
- **Automates:** hunting through screens for answers.
- **How:** a chat over your live aggregations ("which orders are at risk this
  week?", "why is COV-01 wasting so much?", "draft a PO for low latex"). RAG
  over the analytics/breakdown/ETA endpoints; the `advisor` is the seed.
- **Data:** all of the above via existing read APIs.

### 9. Operator AI coaching (extend gamification)
- **Automates:** generic performance reviews.
- **How:** per-operator natural-language coaching from their production/wastage
  patterns and the XP/level system you already compute.
- **Data:** `ShiftDetail`, `Employee`, `Wastage`.

### 10. Warping/covering layout optimization
- **Automates:** manual beam section planning.
- **How:** optimize `WarpingPlan` beam/section/ends layout to minimize yarn
  waste and setup changeovers for a batch of jobs.
- **Data:** `Warping`, `WarpingPlan`, `Elastic`.

---

## Ranked roadmap (impact × effort)

**NOW (weeks, high ROI, data already there):**
- Predictive maintenance health score (#3) — extends existing anomaly/drift.
- Proactive delivery-risk comms (#6) — ETA + WhatsApp already exist.
- Wastage root-cause insights (#5) — one more analytics view.

**NEXT (1–2 months, flagship value):**
- Autonomous production planning v1 (#1) — optimizer over existing rates,
  human-approved. Ship as "Generate plan" on the shift-plan / order screens.
- Vision QC v1 (#2) — zero-shot defect capture into `QcRecord`; start the
  labeling flywheel.
- Forecast-driven auto-PO (#4).

**LATER (quarter+, compounding):**
- Fine-tuned defect model once labeled data accrues.
- Conversational ops assistant (#8).
- Warping optimization (#10), operator coaching (#9), full document AI (#7).

---

## The data engine (prerequisites & flywheel)

- **You already capture structured operational data** — the moat. Keep every
  human correction (OCR edits, QC overrides, accepted/edited plans) as
  **labels**; each becomes training data. That's the Tesla data-engine loop:
  deploy → humans correct → model learns → less correction next time.
- **Add:** an image store for QC/defect photos; an events log of
  plan-accept/edit and ETA actual-vs-predicted for continuous evaluation.
- **Model strategy:** start with hosted LLM/vision (Claude) zero-shot for
  speed; graduate the highest-volume tasks (defect vision, rate prediction) to
  small fine-tuned/on-device models to cut cost and latency.

## Guardrails (non-negotiable)

- **Human-in-the-loop by default** for anything that writes production numbers,
  sends to customers, or spends money — exactly the pattern already used for
  OCR (stage → verify → apply). Automate the *proposal*, keep the *approval*.
- **Confidence + explanations** on every AI output (you already show ETA
  assumptions and OCR confidence — keep that standard).
- **Cost caps** on LLM/vision usage; measure prediction accuracy continuously
  (ETA predicted-vs-actual is a free, honest scorecard you can start today).

---

*Net: the app is unusually well-positioned — rich structured data plus three
working AI subsystems. The fastest wins extend what exists (maintenance,
delivery-risk, wastage); the flagship is turning the existing ETA/rate model
into an optimizer that plans the factory autonomously with a human approving
the last click.*
