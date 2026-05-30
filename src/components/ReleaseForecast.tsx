import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  GitBranch,
  GitPullRequest,
  Gauge,
  LockKeyhole,
  Rocket,
  ShieldAlert,
} from "lucide-react";
import { getPrIntelligence } from "../lib/insights";
import {
  BranchSummary,
  PullRequestSummary,
  ReleaseForecastSnapshot,
  ReviewMemoryByPr,
} from "../types";
import { CiBadge, CodexBadge, formatRelativeTime, StatusPill } from "./ui";

interface ReleaseForecastProps {
  repo: string;
  pullRequests: PullRequestSummary[];
  branches: BranchSummary[];
  reviewMemory: ReviewMemoryByPr;
  forecast?: ReleaseForecastSnapshot;
  selectedId?: string;
  onCommitForecast: (forecast: ReleaseForecastSnapshot) => void;
  onCopyForecast: (text: string, readyCount: number) => void;
  onSelectPullRequest: (id: string) => void;
  onSmartMerge: (id: string) => void;
}

type ForecastPhase = "ready" | "review" | "blocked";

interface ForecastItem {
  pr: PullRequestSummary;
  phase: ForecastPhase;
  readiness: string;
  etaMinutes: number;
  blockers: string[];
  branchDrift: string;
  risk: "low" | "medium" | "high";
}

interface ForecastModel {
  items: ForecastItem[];
  ready: ForecastItem[];
  blocked: ForecastItem[];
  review: ForecastItem[];
  etaMinutes: number;
  confidence: number;
  headline: string;
  nextReady?: ForecastItem;
  savedAge?: string;
}

export function ReleaseForecast({
  repo,
  pullRequests,
  branches,
  reviewMemory,
  forecast,
  selectedId,
  onCommitForecast,
  onCopyForecast,
  onSelectPullRequest,
  onSmartMerge,
}: ReleaseForecastProps) {
  const model = buildForecastModel(repo, pullRequests, branches, reviewMemory, forecast);
  const snapshot = makeSnapshot(repo, model);
  const planText = formatForecastPlan(repo, model);

  return (
    <section className="release-forecast" data-testid="release-forecast">
      <div className="forecast-head">
        <div>
          <span>Release forecast</span>
          <h2>{model.headline}</h2>
          <p>Predicts what can ship next using branch drift, CI, Codex signal, review memory, and stack readiness.</p>
        </div>
        <div className="forecast-actions">
          <button type="button" onClick={() => onCommitForecast(snapshot)} data-testid="commit-release-forecast">
            <LockKeyhole size={14} />
            Commit forecast
          </button>
          <button type="button" onClick={() => onCopyForecast(planText, model.ready.length)} data-testid="copy-release-forecast">
            <Copy size={14} />
            Copy plan
          </button>
          <button
            type="button"
            className="forecast-primary"
            disabled={!model.nextReady}
            onClick={() => model.nextReady && onSmartMerge(model.nextReady.pr.id)}
            data-testid="forecast-queue-first"
          >
            <Rocket size={14} />
            Queue first
          </button>
        </div>
      </div>

      <div className="forecast-metric-strip" aria-label="Release forecast summary">
        <ForecastMetric label="Confidence" value={`${model.confidence}%`} tone={model.confidence > 82 ? "green" : model.confidence > 60 ? "amber" : "red"} />
        <ForecastMetric label="ETA" value={formatEta(model.etaMinutes)} tone={model.blocked.length ? "amber" : "green"} />
        <ForecastMetric label="Ready" value={model.ready.length} tone={model.ready.length ? "green" : "amber"} />
        <ForecastMetric label="Blockers" value={model.blocked.length} tone={model.blocked.length ? "red" : "green"} />
      </div>

      <div className="forecast-body">
        <div className="forecast-lane">
          <div className="forecast-section-title">
            <CalendarClock size={15} />
            <strong>Ship timeline</strong>
            <span>{model.items.length} active PRs</span>
          </div>
          <div className="forecast-item-list">
            {model.items.map((item, index) => (
              <button
                type="button"
                className={`forecast-row phase-${item.phase} ${item.pr.id === selectedId ? "selected" : ""}`}
                key={item.pr.id}
                onClick={() => onSelectPullRequest(item.pr.id)}
              >
                <b>{index + 1}</b>
                <span className="forecast-row-copy">
                  <strong>#{item.pr.number} {item.pr.title.replace(/^feat: |^fix: |^chore: |^docs: /, "")}</strong>
                  <small>{item.phase === "ready" ? "Ready lane" : item.blockers.join(", ") || "Waiting on review signal"}</small>
                </span>
                <span className="forecast-row-meta">
                  <em>{item.readiness}</em>
                  <CodexBadge reaction={item.pr.codex.reaction} compact />
                  <StatusPill state={item.pr.state} />
                  <CiBadge state={item.pr.ci} />
                </span>
              </button>
            ))}
          </div>
        </div>

        <aside className="forecast-blockers">
          <div className="forecast-section-title">
            <ShieldAlert size={15} />
            <strong>Blocker map</strong>
            <span>{model.blocked.length} blocked</span>
          </div>
          <div className="forecast-blocker-list">
            {model.blocked.map((item) => (
              <button type="button" className="forecast-blocker-row" onClick={() => onSelectPullRequest(item.pr.id)} key={item.pr.id}>
                <span>{iconForBlocker(item)}</span>
                <strong>#{item.pr.number}</strong>
                <em>{item.blockers[0] ?? "Needs attention"}</em>
              </button>
            ))}
            {!model.blocked.length && (
              <div className="forecast-empty">
                <CheckCircle2 size={15} />
                No hard blockers in this forecast.
              </div>
            )}
          </div>
        </aside>

        <aside className="forecast-control">
          <div className="forecast-section-title">
            <Gauge size={15} />
            <strong>Forecast control</strong>
          </div>
          <div className="forecast-control-card">
            <span>Committed forecast</span>
            <strong>{forecast ? forecast.headline : "No committed snapshot"}</strong>
            <p>{forecast ? `${forecast.readyPrIds.length} ready, ${forecast.blockerPrIds.length} blocked · saved ${model.savedAge}` : "Commit this forecast to freeze the current release expectation."}</p>
          </div>
          <div className="forecast-policy-grid">
            <PolicyMetric label="Review lane" value={`${model.review.length} waiting`} />
            <PolicyMetric label="Branch drift" value={`${model.items.filter((item) => item.branchDrift !== "clean").length} drifting`} />
            <PolicyMetric label="Risk" value={`${model.items.filter((item) => item.risk === "high").length} high`} />
          </div>
        </aside>
      </div>
    </section>
  );
}

function ForecastMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "green" | "amber" | "red";
}) {
  return (
    <div className={`forecast-metric metric-${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function PolicyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildForecastModel(
  repo: string,
  pullRequests: PullRequestSummary[],
  branches: BranchSummary[],
  reviewMemory: ReviewMemoryByPr,
  forecast?: ReleaseForecastSnapshot,
): ForecastModel {
  const branchByName = new Map(branches.map((branch) => [branch.name, branch]));
  const active = pullRequests.filter((pr) => pr.state !== "merged");
  const items = active
    .map<ForecastItem>((pr, index) => buildForecastItem(pr, index, branchByName, reviewMemory))
    .sort((a, b) => phaseWeight(a.phase) - phaseWeight(b.phase) || a.etaMinutes - b.etaMinutes || a.pr.number - b.pr.number);
  const ready = items.filter((item) => item.phase === "ready");
  const blocked = items.filter((item) => item.phase === "blocked");
  const review = items.filter((item) => item.phase === "review");
  const driftCount = items.filter((item) => item.branchDrift !== "clean").length;
  const highRisk = items.filter((item) => item.risk === "high").length;
  const etaMinutes = Math.max(
    4,
    ready.reduce((sum, item) => sum + item.etaMinutes, 0) +
      review.length * 9 +
      blocked.length * 18 +
      driftCount * 6,
  );
  const confidence = Math.max(
    5,
    Math.min(99, 94 + ready.length * 3 - blocked.length * 13 - review.length * 5 - driftCount * 4 - highRisk * 8),
  );
  const headline =
    !items.length
      ? `No active release work in ${repo}`
      : blocked.length
        ? `${blocked.length} ${pluralize("blocker", blocked.length)} before release`
        : ready.length
          ? `${ready.length} ${pluralize("PR", ready.length)} ready to ship in ${formatEta(etaMinutes)}`
          : "Release is waiting on review signal";

  return {
    items,
    ready,
    blocked,
    review,
    etaMinutes,
    confidence,
    headline,
    nextReady: ready[0],
    savedAge: forecast ? formatRelativeTime(forecast.committedAt) : undefined,
  };
}

function buildForecastItem(
  pr: PullRequestSummary,
  index: number,
  branchByName: Map<string, BranchSummary>,
  reviewMemory: ReviewMemoryByPr,
): ForecastItem {
  const intel = getPrIntelligence(pr, index);
  const memory = reviewMemory[pr.id];
  const branch = branchByName.get(pr.branch);
  const blockers = blockersForPr(pr, branch, memory?.decision);
  const ready =
    !blockers.length &&
    !pr.isDraft &&
    pr.ci === "success" &&
    (pr.state === "approved" || memory?.decision === "ready" || intel.readiness >= intel.readinessTotal - 1) &&
    (pr.codex.reaction === "thumbs_up" || pr.codex.reaction === "changed");
  const phase: ForecastPhase = ready ? "ready" : blockers.length ? "blocked" : "review";

  return {
    pr,
    phase,
    readiness: `${intel.readiness}/${intel.readinessTotal}`,
    etaMinutes: Math.max(3, parseQueueEstimate(intel.queueEstimate)),
    blockers,
    branchDrift: branch && (branch.behind > 0 || branch.health === "diverged" || branch.health === "behind") ? `${branch.behind} behind` : "clean",
    risk: intel.risk,
  };
}

function blockersForPr(
  pr: PullRequestSummary,
  branch: BranchSummary | undefined,
  decision: string | undefined,
) {
  return [
    pr.isDraft ? "Draft still open" : "",
    pr.ci === "failure" ? "Failing CI" : "",
    pr.state === "changes_requested" ? "Changes requested" : "",
    decision === "blocked" ? "Manual block" : "",
    !pr.codex.exists || pr.codex.reaction === "eyes" ? "Codex signal not approved" : "",
    branch && (branch.behind > 0 || branch.health === "behind" || branch.health === "diverged") ? "Branch drift" : "",
  ].filter(Boolean);
}

function makeSnapshot(repo: string, model: ForecastModel): ReleaseForecastSnapshot {
  return {
    id: `${repo}:forecast:${Date.now()}`,
    repo,
    committedAt: new Date().toISOString(),
    etaMinutes: model.etaMinutes,
    confidence: model.confidence,
    readyPrIds: model.ready.map((item) => item.pr.id),
    blockerPrIds: model.blocked.map((item) => item.pr.id),
    headline: model.headline,
  };
}

function formatForecastPlan(repo: string, model: ForecastModel) {
  return [
    `Release forecast · ${repo}`,
    `Headline: ${model.headline}`,
    `Confidence: ${model.confidence}%`,
    `ETA: ${formatEta(model.etaMinutes)}`,
    "",
    "Ready lane:",
    ...(model.ready.length
      ? model.ready.map((item) => `- #${item.pr.number} ${item.pr.title} (${item.readiness})`)
      : ["- Nothing ready yet."]),
    "",
    "Blockers:",
    ...(model.blocked.length
      ? model.blocked.map((item) => `- #${item.pr.number}: ${item.blockers.join(", ")}`)
      : ["- No hard blockers."]),
  ].join("\n");
}

function iconForBlocker(item: ForecastItem) {
  if (item.blockers.some((blocker) => blocker.includes("CI"))) return <AlertTriangle size={14} />;
  if (item.blockers.some((blocker) => blocker.includes("Branch"))) return <GitBranch size={14} />;
  if (item.blockers.some((blocker) => blocker.includes("Codex"))) return <ClipboardCheck size={14} />;
  return <GitPullRequest size={14} />;
}

function parseQueueEstimate(value: string) {
  const minutes = Number(value.match(/\d+/)?.[0] ?? 8);
  return Number.isFinite(minutes) ? minutes : 8;
}

function phaseWeight(phase: ForecastPhase) {
  if (phase === "ready") return 0;
  if (phase === "review") return 1;
  return 2;
}

function formatEta(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function pluralize(label: string, count: number) {
  return count === 1 ? label : `${label}s`;
}
