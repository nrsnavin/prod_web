import { Component, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface State {
  error: Error | null;
}

// Last-resort catch so a render crash in one page never white-screens
// the whole app.
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen grid place-items-center bg-canvas p-6">
          <div className="text-center max-w-md">
            <AlertTriangle className="h-10 w-10 text-status-warning mx-auto" />
            <h1 className="mt-3 text-lg font-bold">Something went wrong</h1>
            <p className="mt-1 text-sm text-ink-600">{this.state.error.message}</p>
            <button
              onClick={() => {
                this.setState({ error: null });
                window.location.href = "/";
              }}
              className="mt-4 h-10 px-4 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
