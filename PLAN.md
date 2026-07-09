# Jarvis ERP — Web App Development Plan (React + Vite)

Web version of the mobile-first Flutter ERP for the elastic manufacturing company.
Backend: existing Node/Express/MongoDB API at `/api/v2` (repo: `nrsnavin/prod`).

---

## 1. Design Direction (Zomato-inspired)

Principles borrowed from Zomato's design language, adapted for an industrial ERP:

- **One bold brand color, used sparingly.** A confident red/coral accent (`#E23744`-family) for primary actions, active nav, and key numbers — everything else stays neutral (warm greys, white cards on `#F8F8F8` canvas) so data reads first.
- **Card-first layouts.** Every entity (order, job, machine, employee) renders as a scannable card in lists and as a hero card on detail pages — the same mental model as Zomato's restaurant cards: image/avatar, title, meta row, status chip, primary action.
- **Strong typographic hierarchy.** Big numerals for KPIs, medium-weight titles, quiet captions. One typeface (Inter), 4-step scale, no decoration.
- **Semantic status chips.** Color-coded pill chips for every lifecycle state (Pending / In-Production / Packed / Delivered, shift verification, machine health) — instantly scannable like Zomato's "Promoted / Pro / Open now" tags.
- **Sticky search + filters.** Persistent top search (global ⌘K search like the Flutter app's global search sheet) and horizontally scrollable filter chips on list pages.
- **Skeleton loading & micro-interactions.** Shimmer skeletons, optimistic UI on quick actions, subtle hover elevation on cards. Never a blank spinner page.
- **Responsive, desktop-optimized.** Collapsible left sidebar + topbar shell on desktop; the same layout degrades to bottom-nav on small screens so factory tablets work too. Data-dense table view toggle on large screens (cards ↔ table).

## 1b. Engineering Principles — SOLID

All code follows SOLID (see `ARCHITECTURE.md` for the full mapping):

- **S** — one responsibility per module: transport (`core/http`), session (`core/auth`), presentation (`components/ui`), chrome (`components/layout`), business features (`features/*`).
- **O** — extend by configuration: nav/route/search derive from one `navigation.ts` config; resource services come from the `createCrudService` factory; UI primitives extend via variant maps and composition.
- **L** — every resource service implements the same `CrudService<T>` contract; `HttpClient` implementations are swappable.
- **I** — small focused interfaces: `AuthService` exposes only what auth consumers need; query hooks and mutation hooks are separate.
- **D** — features depend on the `HttpClient`/service abstractions, never axios; env access is confined to `app/config.ts`; the HTTP layer reports 401s through an injected handler instead of importing stores.

## 2. Tech Stack

| Concern | Choice |
|---|---|
| Build | Vite + React 18 + TypeScript |
| Routing | React Router v6 (nested layouts, route-based code splitting) |
| Server state | TanStack Query (caching, refetch, optimistic updates) |
| Client state | Zustand (auth/session, UI prefs) |
| Styling | Tailwind CSS + small design-token layer (colors, spacing, radii) |
| Forms | react-hook-form + zod validation |
| HTTP | Axios instance mirroring the Flutter `ApiClient` (JWT attached; base URL via `VITE_API_BASE_URL`) |
| Charts | Recharts (production analytics, dashboard) |
| PDF / labels | Print-optimized routes + browser print (DC, warping/covering labels, MRP sheet, payslips) |
| Tables | TanStack Table for dense list views |

## 3. Feature Inventory (from the Flutter app)

Auth & shell · Dashboard · Production analytics · Orders · Job orders (machine assign, MRP sheet, live status) · Delivery Challan (+PDF) · Customers · Suppliers & Purchase Orders · Raw materials (stock, adjust) · Elastic products (stock, stock map) · Machines (logs, maintenance due, issues) · Employees · Warping (plan, detail, label, PDF) · Covering (detail, label, PDF) · Packing (by job, overview, PDF) · Production / shift views · Shift plans & programs (+PDF) · Shift verification · Wastage (add, by job, summary) · Attendance · Payroll & Bonus (+payslip PDF) · Leave · Announcements · Feedback admin · Machine-issue admin · Notification settings · AI advisor settings · Data import/export.

## 4. Stages (approval gate after each)

### Stage 1 — Foundation & App Shell
Vite/React/TS scaffold in this repo, design tokens + base UI kit (Button, Card, Chip, Input, Modal, Table, Skeleton, Toast), axios API layer with auth interceptor, login page, auth gate + role handling, responsive sidebar/topbar shell with all nav sections stubbed, global ⌘K search scaffold.
**Demo:** log in against the real backend, navigate the shell.

### Stage 2 — Dashboard & Analytics
KPI dashboard (orders, production, machines, attendance snapshots), production analytics charts, announcements widget.

### Stage 3 — Masters
Customers, Suppliers + Purchase Orders, Raw Materials (stock adjust), Elastic products (stock + stock map), Machines (detail, logs, maintenance due), Employees. Full CRUD with card/table list views, filters, detail pages.

### Stage 4 — Order-to-Production Flow
Orders (create/detail/lifecycle), Job Orders (create, machine assignment, MRP sheet, live status), Delivery Challans (create, detail, PDF print).

### Stage 5 — Production Operations
Warping (plans, details, labels), Covering, Packing (by job + overview), Shift plans/programs + today view (+print), Production/shift views, Shift verification, Wastage entry + summaries.

### Stage 6 — HR & Payroll
Attendance (fingerprint timeline view), Payroll runs + payslip print, Bonus tab, Leave management.

### Stage 7 — Communications & Utilities
Announcements CRUD, Feedback admin, Machine-issue admin flow, Notification settings, AI advisor settings, Data import/export.

### Stage 8 — Polish & Production Readiness
Role-based route guards end-to-end, empty/error states, performance pass (code splitting, list virtualization), cross-browser/responsive QA, production build config + deployment notes.

---

**Current status:** All 8 stages built. The web app covers every module of the mobile ERP: dashboard, analytics, masters, order-to-production flow, floor operations, HR & payroll, communications and utilities, with role guards, error boundary, print/PDF outputs and per-module code splitting.
