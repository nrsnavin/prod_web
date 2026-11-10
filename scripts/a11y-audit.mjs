// ══════════════════════════════════════════════════════════════════
//  ACCESSIBILITY AUDIT IN A REAL BROWSER
//
//  Runs axe-core (WCAG 2.1 A and AA) over the app's main screens, light
//  and dark, with Playwright's Chromium. The unit suite's a11y test runs
//  the same rules in jsdom, which cannot measure colour, so contrast is
//  checked here.
//
//    A11Y_EMAIL=… A11Y_PASSWORD=… node scripts/a11y-audit.mjs [base-url]
//
//  Needs the app running (vite with VITE_PROXY_TARGET at an API). Exits
//  non-zero when a serious or critical rule fails.
// ══════════════════════════════════════════════════════════════════
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const BASE = process.argv[2] || "http://localhost:5173";
const EMAIL = process.env.A11Y_EMAIL;
const PASSWORD = process.env.A11Y_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error("Set A11Y_EMAIL and A11Y_PASSWORD for a login on that app.");
  process.exit(2);
}

const STATIC = ["/", "/orders", "/jobs", "/invoices", "/accounts", "/accounts/close", "/materials", "/machines", "/customers", "/shift-verification", "/payroll", "/order-pnl", "/stock-counts"];

async function firstId(ctx, api, pick) {
  try {
    const r = await (await ctx.request.get(`${BASE}/api/v2${api}`)).json();
    return pick(r);
  } catch {
    return undefined;
  }
}

async function audit(page, url) {
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => ({ target: n.target.join(" "), html: n.html.slice(0, 160), why: (n.failureSummary || "").split("\n").slice(1, 2).join(" ") })) }));
  });
}

const browser = await chromium.launch();
let failed = 0;
for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
  // Signed out first: the sign-in page.
  const out = await ctx.newPage();
  const signin = await audit(out, "/login");
  await out.close();
  await ctx.request.post(`${BASE}/api/v2/user/login-user`, { data: { email: EMAIL, password: PASSWORD } });
  const me = await (await ctx.request.get(`${BASE}/api/v2/user/me`)).json();
  await ctx.addInitScript((u) => localStorage.setItem("jarvis-session", JSON.stringify({ state: { user: u }, version: 0 })), me.user || me.data || me);
  const order = await firstId(ctx, "/order/list?status=InProgress&limit=1", (r) => r.orders?.[0]?._id);
  const invoice = await firstId(ctx, "/invoice/list?limit=1", (r) => r.invoices?.[0]?._id);
  const job = await firstId(ctx, "/job/jobs?limit=1", (r) => r.jobs?.[0]?._id);
  const routes = [...STATIC, order && `/orders/${order}`, invoice && `/invoices/${invoice}`, job && `/jobs/${job}`].filter(Boolean);
  const results = [["/login", signin]];
  for (const url of routes) {
    const p = await ctx.newPage();
    results.push([url, await audit(p, url)]);
    await p.close();
  }
  for (const [url, violations] of results) {
    const bad = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    failed += bad.length;
    const line = violations.length ? violations.map((v) => `${v.id}(${v.impact}, ${v.nodes})`).join(" ") : "clean";
    console.log(`${scheme.padEnd(5)} ${url.padEnd(36)} ${line}`);
    for (const v of bad) for (const s of v.sample) console.log(`        ${v.id}: ${s.target} :: ${s.why} :: ${s.html}`);
  }
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
