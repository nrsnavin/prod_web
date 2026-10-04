import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useRouteError } from "react-router-dom";

// ══════════════════════════════════════════════════════════════════
//  KEEPING ONE FAILURE TO ONE PART OF THE SCREEN
//
//  A render error used to take the whole app with it: one bad record in
//  one dashboard card, and React Router replaced everything — menus,
//  bottom bar, the lot — with its own developer error page. Now a crash
//  stays where it happened:
//
//    • "section" — one card or panel says it couldn't be shown, with
//      Try again; the rest of the page works.
//    • "page"    — one screen fails inside the app shell; the menus stay,
//      so the way out is where it always is. Navigating away clears it.
//    • "screen"  — the last resort around the whole app.
//
//  And one failure that is not a bug at all: after a deploy, a tab that
//  was already open asks for a page file that no longer exists. That
//  reads as "Failed to fetch dynamically imported module", and the fix
//  is a reload, so that is what these offer.
// ══════════════════════════════════════════════════════════════════

/** The app was updated under an open tab: the screen's code file is gone. */
export function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(
    msg
  );
}

/**
 * `hint`: an optional aid inside a form (an expected figure beside a
 * field). If it fails, it disappears and the form carries on: there is
 * nothing for the person to retry and nothing they lose.
 */
type Variant = "screen" | "page" | "section" | "hint";

interface Props {
  children: ReactNode;
  variant?: Variant;
  /** What failed, in the reader's words: "Attendance today". Sections only. */
  label?: string;
  /** A change of this value clears the error (a new record, a new page). */
  resetKey?: unknown;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Still visible to whoever opens the console; the screen stays usable.
    console.error(`[${this.props.variant ?? "screen"}${this.props.label ? `: ${this.props.label}` : ""}]`, error);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  private retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const variant = this.props.variant ?? "screen";
    if (variant === "hint") return null;
    if (variant === "section") return <SectionFallback label={this.props.label} error={error} onRetry={this.retry} />;
    if (variant === "page") return <PageFallback error={error} onRetry={this.retry} />;
    return <ScreenFallback error={error} />;
  }
}

const reload = () => window.location.reload();

function SectionFallback({ label, error, onRetry }: { label?: string; error: Error; onRetry: () => void }) {
  const updated = isChunkLoadError(error);
  return (
    <div role="alert" className="rounded-card border border-ink-200 bg-surface p-4 text-sm">
      <p className="flex items-center gap-2 font-medium text-ink-900">
        <AlertTriangle className="h-4 w-4 shrink-0 text-status-warning" aria-hidden />
        {label ? `${label} couldn't be shown.` : "This part couldn't be shown."}
      </p>
      <p className="mt-1 text-ink-500">
        {updated ? "The app was updated. Reload to get the new version." : "The rest of the page still works."}
      </p>
      <button
        type="button"
        onClick={updated ? reload : onRetry}
        className="mt-2 inline-flex items-center gap-1.5 font-medium text-brand-600 hover:text-brand-700"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden /> {updated ? "Reload" : "Try again"}
      </button>
    </div>
  );
}

function PageFallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const updated = isChunkLoadError(error);
  return (
    <div role="alert" className="mx-auto mt-10 max-w-md rounded-card border border-ink-200 bg-surface p-6 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-status-warning" aria-hidden />
      <h1 className="mt-3 text-lg font-bold">
        {updated ? "The app has been updated" : "This page couldn't be shown"}
      </h1>
      <p className="mt-1 text-sm text-ink-600">
        {updated
          ? "Reload to get the new version. Nothing you saved is lost."
          : "Something on it failed to display. The rest of the app still works; use the menu to carry on, or try again."}
      </p>
      {!updated && error.message && <p className="mt-2 break-words text-xs text-ink-400">{error.message}</p>}
      <button
        type="button"
        onClick={updated ? reload : onRetry}
        className="mt-4 h-10 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
      >
        {updated ? "Reload" : "Try again"}
      </button>
    </div>
  );
}

function ScreenFallback({ error }: { error: unknown }) {
  const updated = isChunkLoadError(error);
  const message = error instanceof Error ? error.message : null;
  return (
    <div role="alert" className="grid min-h-screen place-items-center bg-canvas p-6">
      <div className="max-w-md text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-status-warning" aria-hidden />
        <h1 className="mt-3 text-lg font-bold">{updated ? "The app has been updated" : "Something went wrong"}</h1>
        <p className="mt-1 text-sm text-ink-600">
          {updated ? "Reload to get the new version. Nothing you saved is lost." : message ?? "An unexpected error stopped this screen."}
        </p>
        <button
          type="button"
          onClick={() => (updated ? reload() : window.location.assign("/"))}
          className="mt-4 h-10 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
        >
          {updated ? "Reload" : "Back to the start"}
        </button>
      </div>
    </div>
  );
}

/**
 * The router's own error screen (`errorElement`), for what fails outside
 * a page: the app shell, a route's lazy load. Replaces React Router's
 * built-in developer page, which is not meant for people using the app.
 */
export function RouteError() {
  const error = useRouteError();
  console.error("[route]", error);
  return <ScreenFallback error={error} />;
}
