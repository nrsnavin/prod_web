# Architecture — SOLID Principles

How each SOLID principle maps onto this codebase. All new code in later
stages must follow these conventions.

## S — Single Responsibility

Each module has one reason to change:

- `src/core/http/` — transport only (axios wrapper, error normalization, 401 reporting). Knows nothing about auth stores or routing.
- `src/core/auth/` — session concerns split further: `authService` (API calls), `authStore` (state persistence), `useAuth` (React binding).
- `src/components/ui/` — purely presentational primitives; zero data fetching, zero routing.
- `src/components/layout/` — app chrome (shell, sidebar, topbar); no business logic.
- `src/features/<name>/` — one folder per business feature: `api/` (service), `hooks/` (queries/mutations), `components/`, `pages/`.

## O — Open/Closed

Extend by configuration/composition, not modification:

- `src/app/navigation.ts` — adding a feature = adding one config entry; sidebar, global search, and route stubs all derive from it.
- `createCrudService()` — new backend resources get a typed service via configuration; non-REST endpoints override individual paths.
- UI primitives expose `variant`/`tone`/`size` maps and accept composition (`children`, `actions`), so new looks don't edit component internals.

## L — Liskov Substitution

- Every resource service implements the `CrudService<T>` interface, so generic list/detail/mutation hooks work against any resource interchangeably (and mock services can substitute real ones in tests).
- `HttpClient` implementations are swappable (axios today; fetch or a test double tomorrow) without breaking any consumer.

## I — Interface Segregation

- Small focused contracts: `AuthService` exposes only login/logout/fetchCurrentUser; the store exposes only session state.
- Component props interfaces stay minimal — pages pass only what a primitive needs, never whole entities into generic UI.
- Read hooks (queries) and write hooks (mutations) are defined separately per feature so consumers depend only on what they use.

## D — Dependency Inversion

- Feature code depends on the `HttpClient` interface, never on axios; the concrete `AxiosHttpClient` is instantiated once in `core/http`.
- `import.meta.env` is read only in `src/app/config.ts` — everything else depends on the `config` abstraction.
- The HTTP layer signals 401s through a registered handler (`setUnauthorizedHandler`) instead of importing the auth store — low-level modules never depend on high-level ones.

## Directory Layout

```
src/
  app/          # composition root: App, router, guards, navigation, config
  core/         # framework-agnostic: http, api types, services, auth
  components/
    ui/         # presentational primitives (Button, Card, Chip, Modal, …)
    layout/     # AppShell, Sidebar, Topbar, GlobalSearch, PageHeader
  features/     # one folder per business feature
```

## Conventions for later stages

- A feature's data layer: `features/<name>/api.ts` built on `createCrudService` + custom endpoints; TanStack Query hooks in `features/<name>/hooks.ts` with query keys namespaced by feature.
- Pages compose UI primitives; any element reused across two features graduates to `components/ui`.
- Role gating uses `RequireRole` (routes) and `roles` in nav config (visibility) — never inline role checks in components.
