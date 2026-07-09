# Jarvis ERP Web — UX Audit

Usability audit of the web frontend. Findings come from driving every
screen in a real browser (login, all list/detail pages, forms, modals,
print previews, mobile viewport) plus a code-level review of the
interaction components. Ordered by user impact.

## What already works well

- Consistent mental model: every module is list → detail → actions, with
  the same chips, filters, and cards, so learning one module teaches all.
- Status is always visible and color-coded with text (never color alone).
- Confirmation dialogs guard every destructive/irreversible action, with
  consequence text ("stock will be deducted"), not just "Are you sure?".
- Skeleton loading everywhere — no blank white pages; empty states explain
  what the screen is for and how to fill it.
- Print previews show exactly what will be on paper before printing.

## High-impact issues

### 1. Keyboard users cannot open table rows  🔴 a11y
Clickable rows are `<tr onClick>` with no `tabIndex`, `role="button"` or
Enter/Space handling — the core navigation of every list page is
mouse/touch-only.
**Fix:** in `DataTable`, when `onRowClick` exists add `tabIndex={0}`,
`onKeyDown` (Enter/Space), and a visible focus ring.

### 2. Modals don't manage focus  🔴 a11y
Focus stays behind the dialog: no focus trap, no auto-focus of the first
field (except login/search), no focus restore on close. Screen-reader and
keyboard users get lost; Tab walks the page under the overlay.
**Fix:** trap focus inside `Modal`, focus first focusable on open, return
focus to the trigger on close. Toasts also need `role="status"`/
`aria-live="polite"` so they are announced.

### 3. A stray click can wipe a half-filled form  🟠 data loss
Modals close on backdrop mousedown. A long PO or elastic form dies with
one mis-click, with no warning.
**Fix:** for form modals, ignore backdrop clicks when the form is dirty
(or confirm before discarding). Same for Esc.

### 4. Session expiry silently dumps you to login  🟠
On any 401 the session clears and the router bounces to /login with no
explanation; in-progress form input is gone and the user doesn't know why.
**Fix:** show "Session expired — sign in again" on the login page (pass a
reason in route state) and return the user to the page they were on after
re-login (the `from` plumbing already exists).

### 5. Long dropdowns don't scale  🟠 ease of use
Customer/elastic/material selects are native `<select>`s. At 200+
customers, picking one becomes scroll-hunting; the Flutter app already
solved this with searchable pickers.
**Fix:** one searchable combobox component (type-to-filter, keyboard
navigable) reused in Order, PO, Elastic, DC, and Packing forms. This is
the single biggest daily-use improvement for data entry.

## Medium-impact issues

6. **Raw enum text leaks into the UI** — chips show `PENDING_VERIFICATION`,
   `half_day`, `in_progress`. Humanize once in `StatusChip` (replace
   underscores, sentence case) so no screen ever shows machine strings.
7. **Tables can't sort and don't say how many rows** — add per-column sort
   where it matters (stock, net pay, total) and "Showing 1–20 of 143" next
   to the pager; sticky header on long lists.
8. **Number inputs pre-filled with 0** — users must select-and-delete the 0
   before typing in every qty/price field. Use empty string + placeholder.
9. **Stale-while-refetching is invisible** — after changing a filter the
   old rows linger with no indication until the new data lands. Dim the
   table or show a thin progress bar while `isFetching`.
10. **Global search stops at pages** — ⌘K should also find entities
    ("1042" → Job J-1042, "Page App…" → customer) using the existing
    search endpoints; today users must navigate then search again.
11. **Number formatting is locale-of-the-browser** — use `en-IN`
    explicitly so lakhs/crores group consistently (₹1,28,400 not
    ₹128,400) across every machine.
12. **Errors offer no retry** — banners state the failure but the only
    recovery is a full reload. Add a Retry button wired to `refetch`.

## Lower-impact / strategic

13. **No dark mode** — night-shift supervisors will use this at 2 AM on
    the floor; the token system makes a dark palette a contained change.
14. **Mobile tables** — horizontal scroll works but a card layout under
    `sm:` for the busiest lists (orders, jobs) would beat side-scrolling.
15. **No "recently viewed"** — a small recent-items row on the dashboard
    (last 5 jobs/orders opened) matches how admins actually work: they
    return to the same 3 jobs all day.
16. **Sidebar can't collapse on desktop** — an icon-rail mode frees ~200px
    for wide tables on 13" laptops.
17. **Breadcrumb depth** — detail pages have a single back link; for
    cross-links (job → order → DC) a 2-level breadcrumb keeps users
    oriented after hopping.

## Suggested order of work

**Sprint 1 (a11y + safety):** DataTable keyboard rows, Modal focus trap +
dirty-form guard, toast aria-live, session-expired message, humanized
status chips. Small, contained, mostly in 3 shared components.

**Sprint 2 (data-entry speed):** searchable combobox everywhere, empty
number inputs, row counts + sorting, error retry, en-IN formatting.

**Sprint 3 (delight):** entity search in ⌘K, dark mode, recent items,
collapsible sidebar, mobile card views.

Because every list uses `DataTable`, every dialog uses `Modal`, and every
dropdown uses `Select`, almost all of Sprint 1–2 lands by editing those
three shared components — the SOLID structure pays off here.
