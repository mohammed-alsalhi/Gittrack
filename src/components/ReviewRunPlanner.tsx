import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardList,
  Copy,
  GitPullRequest,
  Play,
  Rocket,
  Sparkles,
  TimerReset,
} from "lucide-react";
import { getPrIntelligence } from "../lib/insights";
import {
  PullRequestSummary,
  ReviewMemoryByPr,
  ReviewRunSnapshot,
} from "../types";
import { CiBadge, CodexBadge, StatusPill, formatRelativeTime } from "./ui";

type RunStepKind = "unblock" | "review" | "codex" | "merge" | "freshness";
type RunStepTone = "red" | "amber" | "green" | "blue";

export interface ReviewRunStep {
  id: string;
  kind: RunStepKind;
  tone: RunStepTone;
  pr: PullRequestSummary;
  title: string;
  detail: string;
  actionLabel: string;
  etaMinutes: number;
  command: string;
  priority: number;
}

interface ReviewRunPlannerProps {
  repo: string;
  pullRequests: PullRequestSummary[];
  reviewMemory: ReviewMemoryByPr;
  run?: ReviewRunSnapshot;
  selectedId?: string;
  onStartRun: (snapshot: ReviewRunSnapshot) => void;
  onToggleStep: (snapshot: ReviewRunSnapshot, stepId: string) => void;
  onCopyRun: (text: string, stepCount: number) => void;
  onSelectPullRequest: (id: string) => void;
  onSmartMerge: (id: string) => void;
  onPromoteCodex: (id: string) => void;
}

export function ReviewRunPlanner({
  repo,
  pullRequests,
  reviewMemory,
  run,
  selectedId,
  onStartRun,
  onToggleStep,
  onCopyRun,
  onSelectPullRequest,
  onSmartMerge,
  onPromoteCodex,
}: ReviewRunPlannerProps) {
  const steps = buildReviewRunSteps(pullRequests, reviewMemory);
  const seededRun = run ?? createRunSnapshot(repo, steps);
  const completed = new Set(seededRun.completedStepIds);
  const activeStep = steps.find((step) => step.id === seededRun.activeStepId && !completed.has(step.id)) ?? steps.find((step) => !completed.has(step.id));
  const totalMinutes = steps.reduce((sum, step) => sum + step.etaMinutes, 0);
  const completedCount = steps.filter((step) => completed.has(step.id)).length;
  const blockedCount = steps.filter((step) => step.tone === "red" && !completed.has(step.id)).length;
  const agendaText = formatRunAgenda(repo, steps, completed);

  return (
    <section className="review-run-planner" data-testid="review-run-planner">
      <div className="run-head">
        <div>
          <span>Review run</span>
          <h2>{activeStep ? activeStep.title : "Review run is clear"}</h2>
          <p>{run ? `Started ${formatRelativeTime(run.startedAt)} · ${completedCount}/${steps.length} steps done` : "Generate the shortest path from review debt to merge-ready."}</p>
        </div>
        <div className="run-actions">
          <button
            type="button"
            onClick={() => onStartRun(createRunSnapshot(repo, steps))}
            data-testid="start-review-run"
          >
            <Play size={14} />
            Start run
          </button>
          <button type="button" onClick={() => onCopyRun(agendaText, steps.length)} data-testid="copy-review-run">
            <Copy size={14} />
            Copy agenda
          </button>
          <button
            type="button"
            className="run-primary"
            disabled={!activeStep}
            onClick={() => activeStep && handlePrimaryAction(activeStep, onSmartMerge, onPromoteCodex, onSelectPullRequest)}
            data-testid="run-next-action"
          >
            <Sparkles size={14} />
            Next action
          </button>
        </div>
      </div>

      <div className="run-metric-strip" aria-label="Review run summary">
        <RunMetric label="Steps" value={steps.length} tone={steps.length ? "blue" : "green"} />
        <RunMetric label="Done" value={completedCount} tone="green" />
        <RunMetric label="Blocked" value={blockedCount} tone={blockedCount ? "red" : "green"} />
        <RunMetric label="ETA" value={`${totalMinutes}m`} tone={totalMinutes > 30 ? "amber" : "green"} />
      </div>

      <div className="run-body">
        <div className="run-sequence">
          <div className="run-section-title">
            <ClipboardList size={15} />
            <strong>Sequence</strong>
            <span>{steps.length} generated</span>
          </div>

          <div className="run-step-list">
            {steps.map((step, index) => (
              <div
                className={`run-step step-${step.tone} ${step.id === activeStep?.id ? "active" : ""} ${completed.has(step.id) ? "complete" : ""} ${step.pr.id === selectedId ? "selected" : ""}`}
                key={step.id}
              >
                <button type="button" className="run-step-main" onClick={() => onSelectPullRequest(step.pr.id)}>
                  <span className="run-step-index">{completed.has(step.id) ? <CheckCircle2 size={14} /> : index + 1}</span>
                  <span className="run-step-copy">
                    <strong>{step.title}</strong>
                    <small>{step.detail}</small>
                  </span>
                  <span className="run-step-meta">
                    <StatusPill state={step.pr.state} />
                    <CiBadge state={step.pr.ci} />
                    <CodexBadge reaction={step.pr.codex.reaction} compact />
                  </span>
                </button>
                <div className="run-step-foot">
                  <span>{step.etaMinutes}m</span>
                  <span>{labelForKind(step.kind)}</span>
                  <button type="button" onClick={() => onToggleStep(seededRun, step.id)} data-testid={`toggle-run-step-${step.pr.number}-${step.kind}`}>
                    <CheckCircle2 size={13} />
                    {completed.has(step.id) ? "Reopen" : "Done"}
                  </button>
                  <button type="button" onClick={() => handlePrimaryAction(step, onSmartMerge, onPromoteCodex, onSelectPullRequest)}>
                    {iconForKind(step.kind)}
                    {step.actionLabel}
                  </button>
                </div>
              </div>
            ))}

            {!steps.length && (
              <div className="run-empty">
                <CheckCircle2 size={16} />
                No review run needed for this repo.
              </div>
            )}
          </div>
        </div>

        <aside className="run-focus">
          <div className="run-section-title">
            <TimerReset size={15} />
            <strong>Current focus</strong>
          </div>
          {activeStep ? (
            <button type="button" className={`run-focus-card focus-${activeStep.tone}`} onClick={() => onSelectPullRequest(activeStep.pr.id)}>
              <span>{labelForKind(activeStep.kind)}</span>
              <strong>#{activeStep.pr.number} {cleanTitle(activeStep.pr.title)}</strong>
              <p>{activeStep.command}</p>
            </button>
          ) : (
            <div className="run-focus-card">
              <span>Clear</span>
              <strong>Nothing urgent</strong>
              <p>Review debt is under control for this repo.</p>
            </div>
          )}
          <div className="run-policy-grid">
            <PolicyItem label="Unblocks" value={`${steps.filter((step) => step.kind === "unblock").length} queued`} />
            <PolicyItem label="Reviews" value={`${steps.filter((step) => step.kind === "review").length} queued`} />
            <PolicyItem label="AI sweeps" value={`${steps.filter((step) => step.kind === "codex").length} queued`} />
          </div>
        </aside>
      </div>
    </section>
  );
}

function RunMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "blue" | "green" | "amber" | "red";
}) {
  return (
    <div className={`run-metric metric-${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function PolicyItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildReviewRunSteps(
  pullRequests: PullRequestSummary[],
  reviewMemory: ReviewMemoryByPr,
) {
  const referenceNow = getReferenceTime(pullRequests);
  const steps = pullRequests
    .filter((pr) => pr.state !== "merged")
    .flatMap((pr, index) => buildStepsForPullRequest(pr, index, reviewMemory, referenceNow))
    .sort((a, b) => b.priority - a.priority || a.etaMinutes - b.etaMinutes || a.pr.number - b.pr.number);

  return steps.slice(0, 5);
}

function buildStepsForPullRequest(
  pr: PullRequestSummary,
  index: number,
  reviewMemory: ReviewMemoryByPr,
  referenceNow: number,
): ReviewRunStep[] {
  const intel = getPrIntelligence(pr, index);
  const memory = reviewMemory[pr.id];
  const ageHours = Math.max(0, (referenceNow - new Date(pr.updatedAt).getTime()) / 36e5);
  const updatedLabel = formatRelativeFrom(pr.updatedAt, referenceNow);
  const steps: ReviewRunStep[] = [];

  if (pr.ci === "failure" || pr.state === "changes_requested") {
    steps.push(makeStep(pr, "unblock", "red", "Unblock returned work", pr.ci === "failure" ? pr.ciSummary : "Requested changes need a response.", "Open", 9, 120, `Fix the blocker on #${pr.number}, then update reviewers with exactly what changed.`));
  }

  if (pr.state === "waiting_review" || (!pr.isDraft && pr.reviewers.length === 0)) {
    steps.push(makeStep(pr, "review", ageHours > 4 ? "red" : "amber", "Move review forward", `${pr.reviewers.length || 0} human reviewers · updated ${updatedLabel}`, "Inspect", 7, 90 + ageHours, `Read #${pr.number}, decide whether to nudge reviewers or mark it ready.`));
  }

  if (!pr.codex.exists || pr.codex.reaction === "eyes") {
    steps.push(makeStep(pr, "codex", "blue", pr.codex.exists ? "Close AI review watch" : "Request AI sweep", pr.codex.statusText, "Promote", 4, 72, `Get Codex to a thumbs-up signal for #${pr.number} before it enters the merge lane.`));
  }

  if (
    !pr.isDraft &&
    pr.ci === "success" &&
    (pr.state === "approved" || memory?.decision === "ready" || intel.readiness >= intel.readinessTotal - 1)
  ) {
    steps.push(makeStep(pr, "merge", "green", "Queue merge candidate", `${intel.readiness}/${intel.readinessTotal} gates ready · ${intel.queueEstimate}`, "Queue", 5, 82 + intel.readiness, `Queue #${pr.number} after confirming Codex and branch drift are clean.`));
  }

  if (pr.isDraft && ageHours > 6) {
    steps.push(makeStep(pr, "freshness", "amber", "Refresh draft intent", `Draft idle ${updatedLabel}`, "Inspect", 6, 64 + ageHours, `Decide if #${pr.number} should stay draft, get reviewed, or be closed.`));
  }

  return steps;
}

function getReferenceTime(pullRequests: PullRequestSummary[]) {
  const latestPrUpdate = Math.max(
    0,
    ...pullRequests.map((pr) => new Date(pr.updatedAt).getTime()).filter(Number.isFinite),
  );

  return Math.max(Date.now(), latestPrUpdate);
}

function formatRelativeFrom(value: string, now: number) {
  const then = new Date(value).getTime();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}

function makeStep(
  pr: PullRequestSummary,
  kind: RunStepKind,
  tone: RunStepTone,
  title: string,
  detail: string,
  actionLabel: string,
  etaMinutes: number,
  priority: number,
  command: string,
): ReviewRunStep {
  return {
    id: `${pr.id}:${kind}`,
    kind,
    tone,
    pr,
    title: `#${pr.number} ${title}`,
    detail,
    actionLabel,
    etaMinutes,
    command,
    priority,
  };
}

function createRunSnapshot(repo: string, steps: ReviewRunStep[]): ReviewRunSnapshot {
  return {
    id: `${repo}:run:${Date.now()}`,
    repo,
    startedAt: new Date().toISOString(),
    activeStepId: steps[0]?.id,
    completedStepIds: [],
  };
}

function formatRunAgenda(repo: string, steps: ReviewRunStep[], completed: Set<string>) {
  return [
    `Review run · ${repo}`,
    `${steps.length} steps · ${steps.reduce((sum, step) => sum + step.etaMinutes, 0)}m`,
    "",
    ...steps.map((step, index) => `${completed.has(step.id) ? "[x]" : "[ ]"} ${index + 1}. ${step.title} - ${step.command}`),
  ].join("\n");
}

function handlePrimaryAction(
  step: ReviewRunStep,
  onSmartMerge: (id: string) => void,
  onPromoteCodex: (id: string) => void,
  onSelectPullRequest: (id: string) => void,
) {
  if (step.kind === "merge") {
    onSmartMerge(step.pr.id);
    return;
  }
  if (step.kind === "codex") {
    onPromoteCodex(step.pr.id);
    return;
  }
  onSelectPullRequest(step.pr.id);
}

function iconForKind(kind: RunStepKind) {
  if (kind === "unblock") return <AlertTriangle size={13} />;
  if (kind === "codex") return <Bot size={13} />;
  if (kind === "merge") return <Rocket size={13} />;
  return <GitPullRequest size={13} />;
}

function labelForKind(kind: RunStepKind) {
  if (kind === "unblock") return "Unblock";
  if (kind === "codex") return "AI signal";
  if (kind === "merge") return "Merge";
  if (kind === "freshness") return "Freshness";
  return "Review";
}

function cleanTitle(title: string) {
  return title.replace(/^feat: |^fix: |^chore: |^docs: /, "");
}
