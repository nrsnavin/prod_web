# Jarvis ERP — Web

React + Vite web version of the mobile-first Flutter ERP for the elastic
manufacturing company. Consumes the existing Node/Express backend
(`nrsnavin/prod`, `/api/v2`).

- **Plan & stages:** see [PLAN.md](./PLAN.md)
- **Architecture (SOLID):** see [ARCHITECTURE.md](./ARCHITECTURE.md)

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173 — /api proxied to the backend
```

In dev, Vite proxies `/api` to `VITE_PROXY_TARGET` (defaults to the
production backend IP) so the app runs same-origin and the httpOnly auth
cookie works without CORS. Copy `.env.example` to `.env` to override.

```bash
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build locally
```

## Production deployment notes

- Set `VITE_API_BASE_URL` to the backend's public URL at build time, **or**
  serve the app behind the same reverse proxy as the API (recommended —
  keeps everything same-origin).
- The backend sets its auth cookie with `secure: true` + `sameSite: none`,
  so the site **must be served over HTTPS** in production for login to work
  (localhost is exempt during development).
- Add the web app's origin to the backend's CORS allow-list if it's served
  from a different domain.
