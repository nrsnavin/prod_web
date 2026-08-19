# Deploying the web app

## The failure this document exists to prevent

A change is merged to `main`, the tests are green, the build is clean —
and the feature is not on the site. Nothing is broken and nothing
reports an error. The browser is simply still running the bundle it was
given last time.

This has already happened once: machine editing and the machine-list
sort were both on `main` and both compiled into `dist/`, and neither was
visible in the running app, because nothing had rebuilt it.

**There is no automatic deploy. Merging to `main` publishes nothing.**

---

## The whole procedure

```bash
git pull origin main
npm ci                 # not `npm install` — lockfile exactly
npm run build          # typecheck + production build into dist/
# then publish dist/ to wherever the site is served from
```

`npm run build` runs `tsc -b` first, so a type error stops the deploy
rather than shipping a broken bundle. It is the check that matters —
`npx tsc --noEmit` uses a different project config and can pass where
the build fails.

---

## Two things to check when a change "did not appear"

Work through these before assuming the code is wrong. Both produce the
same symptom: an old app with no error anywhere.

### 1. Was `dist/` actually republished?

```bash
grep -rl "<a phrase from the new feature>" dist/assets/*.js
```

If the phrase is in `dist/` but not in the browser, the files were built
but never copied to the server.

### 2. Is `index.html` being cached?

This is the one that catches people. Vite fingerprints every asset
(`MachineListPage-DBdu7wbc.js`), so the asset files are safe to cache
forever — but `index.html` is what *names* them. If the reverse proxy
caches `index.html`, browsers keep asking for last week's chunk names
and every new deploy is invisible until the cache expires.

```
location = /index.html {
    add_header Cache-Control "no-cache, must-revalidate";
}
location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
}
```

Hashed assets immutable, `index.html` never cached. Getting this
backwards produces a site that updates days late, or not at all.

---

## The API and the app deploy separately

A release that adds a screen calling a **new** endpoint needs both
sides, and the app half is useless without the server half. Deploy the
API first: an old app against a new API is merely missing a feature,
while a new app against an old API shows the feature and fails when
somebody uses it.

Recent examples, both requiring an API deploy before the web one:

| Screen | Needs |
|---|---|
| Edit machine details | `PATCH /machine/update-details` |
| Machine head count | `PATCH /machine/update-heads` |
| Complaints | `/api/v2/complaint` |

See `deploy/API_DEPLOY.md` in the `prod` repo — and note that it has its
own equivalent trap: migrations do not run on boot, so
`/api/v2/health/build` reports `migrations.pending` and it is worth
checking after every API deploy.

---

## Verifying a deploy actually landed

Load the site with the network tab open and confirm the JS filenames
differ from the previous release. The hashes change whenever the code
does; identical filenames mean identical code, whatever `git log` says.
