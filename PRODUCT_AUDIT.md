# Jarvis ERP — Product Audit

An audit of the full system (backend `prod`, admin app `flu`, employee app
`emp_prod`, web app `prod_web`) against what a manufacturing ERP of this
scope is expected to do. Findings are grounded in the actual code, not
assumptions.

**Verdict in one line:** the production core (order → job → warping/covering
→ weaving → checking → packing → dispatch, with shift verification and
cascading quantities) is genuinely strong and better-instrumented than most
small-factory systems. The biggest value gaps are **money** (no pricing,
invoicing, or receivables), **traceability of physical material** (no
lots/batches/barcodes), and **planning** (MRP reports shortages but nothing
acts on them).

---

## 1. What is already good

- Clean status machines everywhere (order, job, warping, covering, DC,
  payroll) with server-side side effects (machine release, stock cascade,
  order auto-completion).
- Shift verification with admin sign-off before numbers cascade — a real
  internal control most systems lack.
- Stock movement ledger on raw materials; reservation handling on DC
  creation/cancel is transactional and restores correctly.
- Audit fingerprints on jobs and DCs; audit fields (createdBy/updatedBy)
  stamped globally via a mongoose plugin.
- Production analytics with anomaly detection, consistency scores, and a
  maintenance-due signal is unusually good for this size of system.

---

## 2. Critical gaps (revenue & control)

### 2.1 No money in the order-to-cash flow  🔴 highest impact
- `Order` has **no price, rate, or amount fields** — you cannot answer
  "what is this order worth?" or "what margin did we make?"
- The DC explicitly says *not a tax invoice* and nothing else issues one:
  **no GST invoice, no invoice numbering, no e-invoice/e-way bill**, no
  receivables ledger, no payment recording, no overdue tracking.
- Elastic costing (cost/m) exists but is never compared to a selling rate.

**Recommendation:** add `rate` to `elasticOrdered` lines (defaulted from a
customer-specific price list), an Invoice entity generated from a DC
(GST fields already exist on Customer), and a simple payments-received
screen. Even without full accounting integration, order value + invoice +
outstanding balance per customer transforms the business value of the app.
Margin per order then falls out for free from existing costing.

### 2.2 Single role = no segregation of duties  🔴
- Every protected route is `isAdmin('admin')`. The person who creates a PO
  can receive it, approve their own order, verify shifts, and run payroll.
- The web app already ships `RequireRole` and role-aware navigation —
  unused because the backend has only one meaningful role.

**Recommendation:** introduce 3–4 roles server-side (e.g. `sales`,
`stores`, `production`, `accounts`, `admin`) and map route gates to them.
Highest-risk pairs to separate first: PO creation vs goods inward; payroll
generation vs advance approval.

### 2.3 No lot/batch traceability  🟠
- Material inwards carry lot numbers only as free-text remarks; consumption
  is quantity-only. Rubber/latex ages — a bad lot cannot be traced to the
  jobs, boxes, and customers it reached, and a customer complaint cannot be
  traced back to a supplier lot.
- Labels (beam, covering, packing) carry no barcode/QR, so nothing scans.

**Recommendation:** add a Lot entity created at inward (supplier, lot no,
qty), consume by lot in jobs, and print a QR on every label (`lot`, `job`,
`box` ids). Scanning a box QR at DC creation removes the biggest data-entry
error source in dispatch.

---

## 3. Major gaps (planning & quality)

### 3.1 MRP reports but never acts  🟠
- The MRP sheet flags shortages, and low-stock is on the dashboard, but
  there is no bridge to procurement: no "raise PO for shortfall" action, no
  suggested order quantities from min-stock breaches, no supplier lead
  times to say *when* to order.

**Recommendation:** one-click "raise PO from shortfall" on the MRP sheet
and a reorder-suggestion list (`stock < minStock` × default supplier ×
lead time). The `raise-po` endpoint already exists — this is mostly UI.

### 3.2 No capacity planning / promise dates  🟠
- `supplyDate` is entered on the order but nothing checks whether machines
  can actually deliver by then. Machine assignment is first-free-machine.
- A simple machine-load calendar (jobs × expected days from avg m/shift,
  which analytics already computes) would make supply dates honest and
  surface bottlenecks before customers feel them.

### 3.3 Quality control is a status, not data  🟠
- `checking` is just a pipeline stage. `Elastic.testingParameters` exists
  in the model but **no flow ever records test results against it**.
- No defect codes, no rejection quantities (wastage is the only proxy), no
  certificate of analysis for customers who ask.

**Recommendation:** a QC entry at the checking stage (measured values vs
`testingParameters`, pass/fail, defect code) feeding a printable COA. This
reuses the packing-slip pattern exactly.

---

## 4. Moderate gaps

| Area | Gap | Suggestion |
|---|---|---|
| Inventory valuation | Price history exists but consumption isn't valued; stock has no ₹ value | Weighted-average valuation on movements; stock value on dashboard |
| Stock-take | `bulk-adjust-stock` is the only correction path | Guided cycle-count flow (count sheet → variance → approve adjustments) |
| Maintenance | Service logs + due dates, but no recurring schedules or spare-parts stock | Auto-create next preventive task on log entry; treat spares as a material category (machine-part DCs already exist outbound) |
| Wastage penalties | Recorded on wastage but payroll deducts only absence penalties | Either flow wastage penalties into payroll deductions or drop the field to avoid false expectations |
| Customer docs | No order confirmation or DC/invoice sharing | PDF order confirmation; WhatsApp/email the DC (notification plumbing already exists) |
| On-time delivery | `dcDelayedDelivery` notification exists but no OTD metric | Add OTD % to analytics (supplyDate vs dispatchDate is already stored) |
| OEE | Utilization is computed; quality/performance factors are not | Combine utilization × (1 − wastage%) × output vs standard into an OEE tile per machine |
| Employee app parity | Advances can be requested by workers, approved by admin — good; leave balances are not tracked | Annual leave entitlement + balance so approvals aren't blind |
| i18n | Employee app has translations; web app is English-only | Add i18n scaffolding if supervisors will use the web app |
| Global search | Web ⌘K searches pages only | Index orders/jobs/customers via existing search endpoints |

---

## 5. Technical/operational risks

1. **HTTPS is mandatory in production** (secure cookies) — deploy web+API
   behind one TLS reverse proxy. Currently the API is served on plain HTTP.
2. **Backups:** no visible backup/restore story for MongoDB. A nightly dump
   with retention is the single cheapest insurance available.
3. **Secrets:** JWT secret and OpenAI key handling have been improved but
   should be audited once more before exposing the API to the internet.
4. **Auth routes:** API docs note many routes had auth middleware commented
   out historically; verify every mount is behind the gate in production.
5. **No rate/pagination caps on a few list endpoints** (employees,
   machines) — fine today, worth capping before data grows.

---

## 6. Suggested roadmap

**Phase 1 — Money (highest ROI, ~small)**
Order line pricing + order value → invoice from DC → payments & outstanding
per customer → margin per order (uses existing costing).

**Phase 2 — Control**
Roles/permissions server-side; QC capture at checking + COA; wastage-penalty
policy decision.

**Phase 3 — Material truth**
Lots at inward → lot consumption → QR on labels → scan-to-dispatch;
valuation + cycle counts.

**Phase 4 — Planning**
Reorder suggestions + PO-from-MRP; machine-load calendar and promise-date
check; OTD and OEE metrics.

Each phase is independently shippable and none requires reworking the
existing production core — the foundations (ledgers, status machines,
costing, notifications) are already in place to build on.
