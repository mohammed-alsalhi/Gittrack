import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clipboard,
  GitMerge,
  GitPullRequest,
  Layers3,
  RadioTower,
  ShieldAlert,
  Sparkles,
  Target,
  TimerReset,
  type LucideIcon,
} from "lucide-react";
import { getPrIntelligence } from "../lib/insights";
import type {
  BranchSummary,
  DecisionScenarioMemory,
  DecisionScenarioMode,
  PullRequestSummary,
  RepoSummary,
  ReviewMemoryByPr,
} from "../types";
import { CiBadge, formatRelativeTime, StatusPill } from "./ui";

interface PortfolioDecisionSimulatorProps {
  repos: RepoSummary[];
  pullRequests: PullRequestSummary[];
  branches: BranchSummary[];
  reviewMemory: ReviewMemoryByPr;
  scenario: DecisionScenarioMemory;
  selectedPrId?: string;
  onScenarioChange: (mode: DecisionScenarioMode, selectedPrIds?: string[]) => void;
  onOpenPullRequest: (repo: string, id: string) => void;
  onApplyPlan: (mode: DecisionScenarioMode, selectedPrIds: string[]) => void;
  onCopyPlan: (text: string, count: number) => void;
}

type DecisionTone = "blue" | "green" | "amber" | "red" | "purple";

interface DecisionCandidate {
  pr: PullRequestSummary;
  mode: DecisionScenarioMode;
  tone: DecisionTone;
  icon: LucideIcon;
  title: string;
  detail: string;
  action: string;
  score: number;
  minutes: number;
  riskDelta: number;
}

interface DecisionModel {
  candidates: DecisionCandidate[];
  visible: DecisionCandidate[];
  selected: DecisionCandidate[];
  recommendedIds: string[];
  counts: Record<DecisionScenarioMode, number>;
  queueBefore: number;
  queueAfter: number;
  riskBefore: number;
  riskAfter: number;
  aiBefore: number;
  aiAfter: number;
  reviewBefore: number;
  reviewAfter: number;
  confidence: number;
  headline: string;
  planSteps: string[];
}

const scenarioCopy: Record<
  DecisionScenarioMode,
  {
    label: string;
    detail: string;
    action: string;
    icon: LucideIcon;
    tone: DecisionTone;
  }
> = {
  ship: {
    label: "Ship train",
    detail: "Queue clean PRs in the safest landing order.",
    action: "Ready selected",
    icon: GitMerge,
    tone: "green",
  },
  unblock: {
    label: "Unblock lane",
    detail: "Pull failing checks and requested changes to the top.",
    action: "Track blockers",
    icon: ShieldAlert,
    tone: "red",
  },
  ai: {
    label: "AI sweep",
    detail: "Close missing Codex coverage and eyes-only reviews.",
    action: "Promote AI",
    icon: Bot,
    tone: "purple",
  },
  review: {
    label: "Review rally",
    detail: "Pin waiting reviews and draft-ready work into focus.",
    action: "Pin reviews",
    icon: TimerReset,
    tone: "amber",
  },
};

export function PortfolioDecisionSimulator({
  repos,
  pullRequests,
  branches,
  reviewMemory,
  scenario,
  selectedPrId,
  onScenarioChange,
  onOpenPullRequest,
  onApplyPlan,
  onCopyPlan,
}: PortfolioDecisionSimulatorProps) {
  const model = buildDecisionModel(pullRequests, branches, reviewMemory, scenario);
  const modeCopy = scenarioCopy[scenario.mode];
  const ModeIcon = modeCopy.icon;
  const selectedSet = new Set(model.selected.map((item) => item.pr.id));
  const planText = formatDecisionPlan(scenario.mode, model);

  const setMode = (mode: DecisionScenarioMode) => {
    const nextModel = buildDecisionModel(pullRequests, branches, reviewMemory, {
      mode,
      updatedAt: new Date().toISOString(),
    });
    onScenarioChange(mode, nextModel.recommendedIds);
  };

  const toggleCandidate = (candidate: DecisionCandidate) => {
    const next = new Set(selectedSet);
    if (next.has(candidate.pr.id)) {
      next.delete(candidate.pr.id);
    } else {
      next.add(candidate.pr.id);
    }
    onScenarioChange(scenario.mode, [...next]);
  };

  return (
    <section className="decision-simulator" id="decision-simulator" data-testid="decision-simulator">
      <div className="decision-head">
        <div className="decision-title">
          <span>Decision simulator</span>
          <h2>{model.headline}</h2>
          <p>
            Model queue time, blocker risk, Codex coverage, and review load across {repos.length} repos before you act.
          </p>
        </div>

        <div className="decision-actions">
          <button type="button" onClick={() => onScenarioChange(scenario.mode, model.recommendedIds)} data-testid="decision-recommended">
            <Sparkles size={14} />
            Best set
          </button>
          <button type="button" onClick={() => onScenarioChange(scenario.mode, [])}>
            <Target size={14} />
            Clear
          </button>
          <button type="button" onClick={() => onCopyPlan(planText, model.selected.length)} data-testid="decision-copy-plan">
            <Clipboard size={14} />
            Copy plan
          </button>
          <button
            type="button"
            className="decision-primary"
            disabled={!model.selected.length}
            onClick={() => onApplyPlan(scenario.mode, model.selected.map((item) => item.pr.id))}
            data-testid="decision-apply-plan"
          >
            <ModeIcon size={14} />
            {modeCopy.action}
          </button>
        </div>
      </div>

      <div className="decision-metrics" aria-label="Decision forecast">
        <DecisionMetric
          label="Queue"
          before={`${model.queueBefore}m`}
          after={`${model.queueAfter}m`}
          tone={model.queueAfter < model.queueBefore ? "green" : "amber"}
        />
        <DecisionMetric
          label="Risk"
          before={String(model.riskBefore)}
          after={String(model.riskAfter)}
          tone={model.riskAfter < model.riskBefore ? "green" : model.riskAfter > model.riskBefore ? "red" : "blue"}
        />
        <DecisionMetric
          label="AI cover"
          before={`${model.aiBefore}%`}
          after={`${model.aiAfter}%`}
          tone={model.aiAfter > model.aiBefore ? "purple" : "blue"}
        />
        <DecisionMetric
          label="Review load"
          before={String(model.reviewBefore)}
          after={String(model.reviewAfter)}
          tone={model.reviewAfter < model.reviewBefore ? "green" : "amber"}
        />
      </div>

      <div className="decision-body">
        <aside className="decision-presets">
          <div className="decision-section-title">
            <Layers3 size={15} />
            <strong>Scenario presets</strong>
          </div>
          <div className="decision-preset-list">
            {(["ship", "unblock", "ai", "review"] as const).map((mode) => {
              const preset = scenarioCopy[mode];
              const Icon = preset.icon;

              return (
                <button
                  type="button"
                  className={`decision-preset preset-${preset.tone} ${scenario.mode === mode ? "active" : ""}`}
                  key={mode}
                  onClick={() => setMode(mode)}
                  data-testid={`decision-mode-${mode}`}
                >
                  <span className="decision-preset-icon">
                    <Icon size={15} />
                  </span>
                  <span>
                    <strong>{preset.label}</strong>
                    <small>{preset.detail}</small>
                  </span>
                  <b>{model.counts[mode]}</b>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="decision-candidates">
          <div className="decision-section-title">
            <RadioTower size={15} />
            <strong>{modeCopy.label} candidates</strong>
            <span>{model.visible.length} ranked</span>
          </div>
          <div className="decision-candidate-list">
            {model.visible.map((candidate, index) => {
              const Icon = candidate.icon;
              const selected = selectedSet.has(candidate.pr.id);

              return (
                <article
                  className={`decision-row decision-${candidate.tone} ${selected ? "selected" : ""} ${candidate.pr.id === selectedPrId ? "focused" : ""}`}
                  key={`${candidate.mode}-${candidate.pr.id}`}
                >
                  <button
                    type="button"
                    className="decision-check"
                    onClick={() => toggleCandidate(candidate)}
                    aria-label={`${selected ? "Remove" : "Add"} #${candidate.pr.number} from decision plan`}
                    data-testid="decision-toggle"
                  >
                    {selected ? <CheckCircle2 size={15} /> : <GitPullRequest size={15} />}
                  </button>
                  <button
                    type="button"
                    className="decision-row-main"
                    onClick={() => onOpenPullRequest(candidate.pr.repo, candidate.pr.id)}
                  >
                    <span className="decision-rank">{index + 1}</span>
                    <span className="decision-row-icon">
                      <Icon size={15} />
                    </span>
                    <span className="decision-row-copy">
                      <strong>{candidate.title}</strong>
                      <small>{candidate.detail}</small>
                    </span>
                    <StatusPill state={candidate.pr.state} />
                    <CiBadge state={candidate.pr.ci} />
                  </button>
                  <div className="decision-row-meta">
                    <span>{candidate.pr.repo}</span>
                    <span>{candidate.action}</span>
                    <span>{candidate.minutes}m impact</span>
                    <span>{formatRelativeTime(candidate.pr.updatedAt)}</span>
                  </div>
                </article>
              );
            })}

            {!model.visible.length && (
              <div className="decision-empty">
                <CheckCircle2 size={17} />
                <strong>No candidates for this scenario.</strong>
                <span>Switch presets or refresh GitHub data to model another lane.</span>
              </div>
            )}
          </div>
        </div>

        <aside className="decision-forecast">
          <div className="decision-section-title">
            <AlertTriangle size={15} />
            <strong>Forecast</strong>
            <span>{model.confidence}% confidence</span>
          </div>

          <div className="decision-confidence">
            <span style={{ width: `${model.confidence}%` }} />
          </div>

          <div className="decision-plan-steps">
            {model.planSteps.map((step, index) => (
              <button type="button" key={`${step}-${index}`} onClick={() => model.selected[index] && onOpenPullRequest(model.selected[index].pr.repo, model.selected[index].pr.id)}>
                <b>{index + 1}</b>
                <span>{step}</span>
              </button>
            ))}
          </div>

          <div className="decision-footnote">
            <strong>{model.selected.length}</strong>
            <span>{model.selected.length === 1 ? "PR selected" : "PRs selected"}</span>
          </div>
        </aside>
      </div>
    </section>
  );
}

function DecisionMetric({
  label,
  before,
  after,
  tone,
}: {
  label: string;
  before: string;
  after: string;
  tone: DecisionTone;
}) {
  return (
    <div className={`decision-metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{after}</strong>
      <small>{before} before</small>
    </div>
  );
}

function buildDecisionModel(
  pullRequests: PullRequestSummary[],
  branches: BranchSummary[],
  reviewMemory: ReviewMemoryByPr,
  scenario: DecisionScenarioMemory,
): DecisionModel {
  const active = pullRequests.filter((pr) => pr.state !== "merged");
  const candidates = active.flatMap((pr, index) => buildCandidatesForPr(pr, index, reviewMemory));
  const counts = countByMode(candidates);
  const visible = candidates
    .filter((candidate) => candidate.mode === scenario.mode)
    .sort((a, b) => b.score - a.score || new Date(b.pr.updatedAt).getTime() - new Date(a.pr.updatedAt).getTime())
    .slice(0, 9);
  const recommendedIds = visible.slice(0, scenario.mode === "ship" ? 3 : 4).map((candidate) => candidate.pr.id);
  const selectedIds = new Set(scenario.selectedPrIds ?? recommendedIds);
  const selected = visible.filter((candidate) => selectedIds.has(candidate.pr.id));
  const baseQueue = Math.max(4, active.length * 3 + branches.filter((branch) => branch.health === "behind" || branch.health === "diverged").length * 4);
  const baseRisk = active.reduce((sum, pr, index) => sum + riskPointsForPr(pr, index, reviewMemory), 0);
  const aiCovered = active.filter((pr) => pr.codex.exists && pr.codex.reaction !== "eyes").length;
  const reviewLoad = active.filter((pr) => pr.state === "waiting_review" || pr.reviewers.length === 0 || pr.isDraft).length;
  const impactMinutes = selected.reduce((sum, candidate) => sum + candidate.minutes, 0);
  const riskDelta = selected.reduce((sum, candidate) => sum + candidate.riskDelta, 0);
  const aiLift = scenario.mode === "ai" ? selected.length : selected.filter((candidate) => candidate.pr.codex.exists).length * 0.5;
  const reviewLift = scenario.mode === "review" ? selected.length : scenario.mode === "ship" ? Math.ceil(selected.length / 2) : 0;
  const queueAfter = Math.max(1, baseQueue - impactMinutes);
  const riskAfter = Math.max(0, baseRisk - riskDelta);
  const aiBefore = active.length ? Math.round((aiCovered / active.length) * 100) : 100;
  const aiAfter = active.length ? Math.min(100, Math.round(((aiCovered + aiLift) / active.length) * 100)) : 100;
  const reviewAfter = Math.max(0, reviewLoad - reviewLift);
  const confidence = selected.length
    ? Math.max(42, Math.min(98, 92 - selected.filter((candidate) => candidate.tone === "red").length * 9 + selected.filter((candidate) => candidate.tone === "green").length * 2))
    : 0;
  const headline = buildHeadline(scenario.mode, selected.length, queueBeforeLabel(baseQueue, queueAfter), riskDelta);
  const planSteps = selected.length
    ? selected.slice(0, 5).map((candidate) => `#${candidate.pr.number} ${candidate.action}: ${candidate.title}`)
    : ["Select a candidate set to preview the operating plan."];

  return {
    candidates,
    visible,
    selected,
    recommendedIds,
    counts,
    queueBefore: baseQueue,
    queueAfter,
    riskBefore: baseRisk,
    riskAfter,
    aiBefore,
    aiAfter,
    reviewBefore: reviewLoad,
    reviewAfter,
    confidence,
    headline,
    planSteps,
  };
}

function buildCandidatesForPr(
  pr: PullRequestSummary,
  index: number,
  reviewMemory: ReviewMemoryByPr,
) {
  const memory = reviewMemory[pr.id];
  const intel = getPrIntelligence(pr, index);
  const candidates: DecisionCandidate[] = [];
  const ready =
    !pr.isDraft &&
    pr.ci === "success" &&
    pr.state !== "changes_requested" &&
    memory?.decision !== "blocked" &&
    (pr.state === "approved" || memory?.decision === "ready" || intel.readiness >= intel.readinessTotal - 1);
  const blocked = pr.ci === "failure" || pr.state === "changes_requested" || memory?.decision === "blocked";
  const aiGap = !pr.codex.exists || pr.codex.reaction === "eyes";
  const reviewGap = pr.state === "waiting_review" || pr.reviewers.length === 0 || (pr.isDraft && pr.ci === "success");
  const riskPoints = riskPointsForPr(pr, index, reviewMemory);

  if (ready) {
    candidates.push({
      pr,
      mode: "ship",
      tone: "green",
      icon: GitMerge,
      title: `Queue #${pr.number} for the merge train`,
      detail: `${pr.title} is ${intel.readiness}/${intel.readinessTotal} ready with ${pr.ciSummary.toLowerCase()}.`,
      action: "merge-ready",
      score: 86 + intel.readiness - (intel.risk === "high" ? 12 : 0),
      minutes: parseMinutes(intel.queueEstimate) + 4,
      riskDelta: Math.max(4, Math.round(riskPoints * 0.28)),
    });
  }

  if (blocked) {
    candidates.push({
      pr,
      mode: "unblock",
      tone: "red",
      icon: ShieldAlert,
      title: `Unblock #${pr.number}`,
      detail: `${pr.title} is holding the lane with ${pr.ciSummary.toLowerCase()} and ${pr.state.replace("_", " ")} state.`,
      action: "blocker plan",
      score: 92 + riskPoints,
      minutes: 8 + (pr.ci === "failure" ? 6 : 0),
      riskDelta: Math.max(12, Math.round(riskPoints * 0.62)),
    });
  }

  if (aiGap) {
    candidates.push({
      pr,
      mode: "ai",
      tone: pr.codex.reaction === "eyes" ? "purple" : "amber",
      icon: Bot,
      title: pr.codex.exists ? `Promote Codex signal on #${pr.number}` : `Request Codex coverage on #${pr.number}`,
      detail: pr.codex.statusText,
      action: "AI confidence",
      score: pr.codex.exists ? 76 : 70,
      minutes: 5,
      riskDelta: Math.max(3, Math.round(riskPoints * 0.18)),
    });
  }

  if (reviewGap) {
    candidates.push({
      pr,
      mode: "review",
      tone: pr.isDraft ? "blue" : "amber",
      icon: pr.isDraft ? GitPullRequest : TimerReset,
      title: pr.isDraft ? `Make #${pr.number} reviewable` : `Pull review forward on #${pr.number}`,
      detail: pr.reviewers.length ? `${pr.reviewers.length} reviewers assigned; updated ${formatRelativeTime(pr.updatedAt)}.` : "No reviewer assigned yet.",
      action: pr.isDraft ? "draft exit" : "review route",
      score: pr.isDraft ? 58 : 68 + (pr.reviewers.length ? 0 : 8),
      minutes: pr.isDraft ? 6 : 9,
      riskDelta: Math.max(2, Math.round(riskPoints * 0.2)),
    });
  }

  return candidates;
}

function countByMode(candidates: DecisionCandidate[]): Record<DecisionScenarioMode, number> {
  return candidates.reduce(
    (counts, candidate) => ({
      ...counts,
      [candidate.mode]: counts[candidate.mode] + 1,
    }),
    { ship: 0, unblock: 0, ai: 0, review: 0 },
  );
}

function riskPointsForPr(
  pr: PullRequestSummary,
  index: number,
  reviewMemory: ReviewMemoryByPr,
) {
  const intel = getPrIntelligence(pr, index);
  const memory = reviewMemory[pr.id];

  return (
    (intel.risk === "high" ? 28 : intel.risk === "medium" ? 15 : 6) +
    (pr.ci === "failure" ? 32 : pr.ci === "pending" ? 12 : 0) +
    (pr.state === "changes_requested" ? 24 : 0) +
    (pr.isDraft ? 10 : 0) +
    (memory?.decision === "blocked" ? 18 : 0) +
    (!pr.codex.exists ? 5 : pr.codex.reaction === "eyes" ? 3 : 0)
  );
}

function parseMinutes(value: string) {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 6;
}

function queueBeforeLabel(before: number, after: number) {
  const saved = Math.max(0, before - after);
  return saved ? `${saved}m saved` : `${before}m modeled`;
}

function buildHeadline(
  mode: DecisionScenarioMode,
  count: number,
  queueLabel: string,
  riskDelta: number,
) {
  const label = scenarioCopy[mode].label;
  if (!count) return `${label} is ready for a candidate set`;
  if (mode === "unblock") return `${count} ${pluralize("blocker", count)} can remove ${riskDelta} risk points`;
  if (mode === "ai") return `${count} AI ${pluralize("signal", count)} can raise confidence`;
  if (mode === "review") return `${count} ${pluralize("review", count)} can compress the waiting lane`;
  return `${count} ${pluralize("PR", count)} can move through the train with ${queueLabel}`;
}

function formatDecisionPlan(mode: DecisionScenarioMode, model: DecisionModel) {
  const copy = scenarioCopy[mode];

  return [
    `GitTrack decision plan: ${copy.label}`,
    `Confidence: ${model.confidence}%`,
    `Queue: ${model.queueBefore}m -> ${model.queueAfter}m`,
    `Risk: ${model.riskBefore} -> ${model.riskAfter}`,
    `AI coverage: ${model.aiBefore}% -> ${model.aiAfter}%`,
    "",
    "Selected PRs:",
    ...(model.selected.length
      ? model.selected.map((candidate, index) => `${index + 1}. #${candidate.pr.number} ${candidate.pr.title} - ${candidate.action}`)
      : ["No PRs selected."]),
    "",
    "Plan steps:",
    ...model.planSteps.map((step) => `- ${step}`),
  ].join("\n");
}

function pluralize(label: string, count: number) {
  return count === 1 ? label : `${label}s`;
}
