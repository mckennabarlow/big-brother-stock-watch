import {
  lazy,
  Suspense,
  useMemo,
  useRef,
  useState,
} from "react";
import clsx from "clsx";
import rawDataset from "../data/processed/bb28/dataset.json";
import SeasonDashboard, {
  type SeasonDashboardHandle,
} from "./components/SeasonDashboard";
import { seasonWeeks } from "./lib/metrics";
import type { Metric, StockWatchDataset } from "./types";

const dataset = rawDataset as StockWatchDataset;
const DraftDashboard = lazy(() => import("./components/DraftDashboard"));

export default function App() {
  const weeks = useMemo(() => seasonWeeks(dataset.summaries), []);
  const latestWeek = weeks.at(-1) ?? 1;
  const [metric, setMetric] = useState<Metric>("rating");
  const [draftMetric, setDraftMetric] = useState<Metric>("rating");
  const [selectedWeek, setSelectedWeek] = useState(latestWeek);
  const [activeView, setActiveView] = useState<"season" | "draft">("season");
  const seasonDashboardRef = useRef<SeasonDashboardHandle>(null);

  return (
    <div className="relative min-h-screen overflow-hidden bg-neutral-bg1 text-text-primary">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-32 top-12 hidden h-96 w-96 rounded-full bg-brand/15 blur-[120px] md:block" />
        <div className="absolute -right-24 top-80 hidden h-80 w-80 rounded-full bg-cyan-500/10 blur-[120px] md:block" />
      </div>

      <main className="relative mx-auto max-w-[1500px] px-4 py-6 pb-safe-bottom sm:px-6 lg:px-10 lg:py-10">
        <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-brand/30 bg-brand/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-brand-light">
                RHAP Roundtable
              </span>
              <span className="text-sm text-text-muted">
                Updated{" "}
                {new Date(dataset.metadata.extracted_at).toLocaleDateString()}
              </span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Big Brother{" "}
              <span className="bg-gradient-to-r from-brand-light to-cyan-300 bg-clip-text text-transparent">
                Stock Watch
              </span>
            </h1>
            <p className="mt-3 max-w-2xl text-base text-text-secondary">
              Follow every houseguest&apos;s weekly rating, momentum, and market
              value throughout {dataset.metadata.name}.
            </p>
          </div>

          <div
            className="grid w-full grid-cols-2 rounded-xl border border-border bg-neutral-bg2/80 p-1 sm:inline-flex sm:w-auto"
            role="group"
            aria-label={`${activeView === "season" ? "Season" : "Draft team"} metric`}
          >
            {(["rating", "price"] as Metric[]).map((option) => {
              const activeMetric =
                activeView === "season" ? metric : draftMetric;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    activeView === "season"
                      ? setMetric(option)
                      : setDraftMetric(option)
                  }
                  className={clsx(
                    "min-h-touch rounded-lg px-5 text-sm font-semibold transition-colors",
                    activeMetric === option
                      ? "bg-brand text-white shadow-glow"
                      : "text-text-secondary hover:bg-neutral-bg4 hover:text-white",
                  )}
                >
                  {option === "rating" ? "Ratings" : "Stock price"}
                </button>
              );
            })}
          </div>
        </header>

        <nav
          className="mb-6 grid grid-cols-2 rounded-xl border border-border bg-neutral-bg2 p-1"
          aria-label="Dashboard views"
        >
          {(
            [
              ["season", "Season Stock Watch"],
              ["draft", "Draft Teams"],
            ] as const
          ).map(([view, label]) => (
            <button
              type="button"
              key={view}
              onClick={() => setActiveView(view)}
              aria-current={activeView === view ? "page" : undefined}
              className={clsx(
                "min-h-touch rounded-lg px-3 text-sm font-bold transition-colors sm:text-base",
                activeView === view
                  ? "bg-brand text-white shadow-glow"
                  : "text-text-secondary hover:bg-neutral-bg4 hover:text-white",
              )}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className={activeView === "season" ? undefined : "hidden"}>
          <SeasonDashboard
            ref={seasonDashboardRef}
            dataset={dataset}
            weeks={weeks}
            selectedWeek={selectedWeek}
            onSelectWeek={setSelectedWeek}
            metric={metric}
          />
        </div>

        {activeView === "draft" && (
          <Suspense
            fallback={
              <div className="glass-card p-6 text-sm text-text-secondary">
                Loading draft teams…
              </div>
            }
          >
            <DraftDashboard
              dataset={dataset}
              weeks={weeks}
              selectedWeek={selectedWeek}
              metric={draftMetric}
              onSelectWeek={setSelectedWeek}
              onViewPlayer={(playerId) => {
                seasonDashboardRef.current?.focusPlayer(playerId);
                setActiveView("season");
              }}
            />
          </Suspense>
        )}

        <footer className="mt-8 flex flex-col gap-2 border-t border-border-subtle py-6 text-xs text-text-muted sm:flex-row sm:justify-between">
          <p>
            Ratings and prices sourced from{" "}
            <a
              className="text-text-secondary underline decoration-border-strong underline-offset-4 hover:text-white"
              href="https://realitystockwatch.com/trades"
              target="_blank"
              rel="noreferrer"
            >
              Reality Stock Watch
            </a>
            .
          </p>
          <p>Unofficial fan visualization. Not affiliated with CBS or RHAP.</p>
        </footer>
      </main>
    </div>
  );
}
