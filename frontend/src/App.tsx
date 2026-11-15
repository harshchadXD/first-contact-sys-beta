import { Component, lazy, Suspense } from "react";
import type { ReactNode } from "react";
const Explorer = lazy(() => import("./RegionWorkspace"));
class ExplorerBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="startup">
        <h1>The explorer couldn’t load.</h1>
        <p>
          Your calculation runs locally. Reload to retry the application files.
        </p>
        <button className="solid-button" onClick={() => location.reload()}>
          Reload explorer
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <ExplorerBoundary>
      <Suspense
        fallback={
          <main className="startup">
            <div className="startup-mark" aria-hidden="true" />
            <h1>
              FIRST CONTACT<span>.sys</span>
            </h1>
            <p role="status">Preparing your view of the Moon…</p>
          </main>
        }
      >
        <Explorer />
      </Suspense>
    </ExplorerBoundary>
  );
}
