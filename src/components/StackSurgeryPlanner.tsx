import {
  Bot,
  Check,
  CheckCircle2,
  Circle,
  ClipboardList,
  Copy,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  GitPullRequest,
  RefreshCcw,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { getPrIntelligence } from "../lib/insights";
import {
  BranchSummary,
  PullRequestSummary,
  ReviewMemoryByPr,
  StackPlanSnapshot,
  StackPlanStep,
  StackPlanStepKind,
} from "../types";
import { BranchStatus, CiBadge, formatRelativeTime, StatusPill } from "./ui";

interface StackSurgeryPlannerProps {
  repo: string;
  branches: BranchSummary[];
  pullRequests: PullRequestSummary[];
  reviewMemory: ReviewMemoryByPr;
  plan?: StackPlanSnapshot;
  selectedId?: string;
  onSavePlan: (plan: StackPlanSnapshot) => void;
  onToggleStep: (plan: StackPlanSnapshot, stepId: string) => void;
  onCopyPlan: (plan: StackPlanSnapshot) => void;
  onSelectPullRequest: (id: string) => void;
  onSmartMerge: (id: string) => void;
}

export function StackSurgeryPlanner({
  repo,
  branches,
  pullRequests,
  reviewMemory,
  plan,
  selectedId,
  onSavePlan,
  onToggleStep,
  onCopyPlan,
  onSelectPullRequest,
  onSmartMerge,
}: StackSurgeryPlannerProps) {
  const snapshot = buildStackPlan(repo, branches, pullRequests, reviewMemory, plan);
  const openSteps = snapshot.steps.filter((step) => !step.done);
  const driftedBranches = branches.filter(isBranchDrifted).length;
  const blockedPrs = pullRequests.filter((pr) => {
    const memory = reviewMemory[pr.id];
    return pr.ci === "failure" || pr.state === "changes_requested" || memory?.decision === "blocked";
  }).length;
  const readyPrs = pullRequests.filter((pr, index) => isReadyForMerge(pr, index, reviewMemory));
  const completion = snapshot.steps.length
    ? Math.round(((snapshot.steps.length - openSteps.length) / snapshot.steps.length) * 100)
    : 100;
  const nextStep = openSteps[0];
  const linkedPullRequests = new Map(pullRequests.map((pr) => [pr.id, pr]));
  const stackBranches = branches.filter((branch) => branch.name !== "main").slice(0, 6);
  const firstReadyPr = readyPrs[0];

  return (
    <section className="stack-surgery-planner" data-testid="stack-surgery-planner">
      <div className="surgery-head">
        <div>
          <span>Stack surgery</span>
          <h2>{openSteps.length ? `${openSteps.length} operations before the stack can land` : "Stack is clear to land"}</h2>
          <p>Rebase drift, unblock reviews, close Codex sweeps, and stage the merge train for {repo}.</p>
        </div>
        <div className="surgery-actions">
          <button type="button" onClick={() => onCopyPlan(snapshot)}>
            <Copy size={14} />
            Copy plan
          </button>
          <button type="button" className="surgery-primary" onClick={() => onSavePlan(stampPlan(snapshot))} data-testid="save-stack-plan">
            <ClipboardList size={14} />
            Save plan
          </button>
        </div>
      </div>

      <div className="surgery-metric-strip" aria-label="Stack surgery summary">
        <SurgeryMetric label="Drift" value={driftedBranches} tone={driftedBranches ? "amber" : "green"} />
        <SurgeryMetric label="Blocked" value={blockedPrs} tone={blockedPrs ? "red" : "green"} />
        <SurgeryMetric label="Ready" value={readyPrs.length} tone="blue" />
        <SurgeryMetric label="Done" value={`${completion}%`} tone={completion === 100 ? "green" : "amber"} />
      </div>

      <div className="surgery-body">
        <div className="surgery-plan">
          <div className="surgery-section-title">
            <Wrench size={15} />
            <strong>Repair sequence</strong>
            <span>{snapshot.steps.length} steps</span>
          </div>

          <div className="surgery-step-list">
            {snapshot.steps.map((step, index) => {
              const targetPr = step.targetId ? linkedPullRequests.get(step.targetId) : undefined;
              return (
                <div className={`surgery-step step-${step.kind} ${step.done ? "done" : ""}`} key={step.id}>
                  <button
                    type="button"
                    className="surgery-step-toggle"
                    onClick={() => onToggleStep(snapshot, step.id)}
                    aria-label={`${step.done ? "Reopen" : "Complete"} ${step.title}`}
                    data-testid={index === 0 ? "stack-step-toggle" : undefined}
                  >
                    {step.done ? <Check size={14} /> : <Circle size={14} />}
                  </button>
                  <span className="surgery-step-icon">{iconForStep(step.kind)}</span>
                  <span className="surgery-step-copy">
                    <strong>{step.title}</strong>
                    <small>{step.detail}</small>
                  </span>
                  <span className="surgery-step-kind">{step.kind}</span>
                  {targetPr ? (
                    <button type="button" className="surgery-target" onClick={() => onSelectPullRequest(targetPr.id)}>
                      <GitPullRequest size={13} />
                      #{targetPr.number}
                    </button>
                  ) : (
                    <span className="surgery-target muted-target">{step.targetLabel ?? "branch"}</span>
                  )}
                  {step.kind === "merge" && targetPr && (
                    <button type="button" className="surgery-merge" onClick={() => onSmartMerge(targetPr.id)}>
                      <GitMerge size={13} />
                      Queue
                    </button>
                  )}
                </div>
              );
            })}

            {!snapshot.steps.length && (
              <div className="surgery-empty">
                <CheckCircle2 size={16} />
                No rebase or review repair steps are needed right now.
              </div>
            )}
          </div>
        </div>

        <aside className="surgery-stack-map">
          <div className="surgery-section-title">
            <GitCommitHorizontal size={15} />
            <strong>Stack map</strong>
            <span>{stackBranches.length} branches</span>
          </div>

          <div className="surgery-branch-list">
            {stackBranches.map((branch) => {
              const pr = pullRequests.find((item) => item.number === branch.pullRequestNumber);
              const selectable = Boolean(pr);
              return (
                <button
                  type="button"
                  className={`surgery-branch-row ${pr?.id === selectedId ? "selected" : ""}`}
                  key={branch.id}
                  onClick={() => pr && onSelectPullRequest(pr.id)}
                  disabled={!selectable}
                >
                  <span className="surgery-branch-name">
                    <GitBranch size={13} />
                    <strong>{branch.name}</strong>
                  </span>
                  <BranchStatus branch={branch.health} />
                  <span className="surgery-drift">
                    +{branch.ahead} / -{branch.behind}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <aside className="surgery-command-rail">
          <div className="surgery-section-title">
            <RefreshCcw size={15} />
            <strong>Autopilot</strong>
          </div>

          <div className="surgery-next-card">
            <span>Next best action</span>
            <strong>{nextStep?.title ?? "Run merge train"}</strong>
            <p>{nextStep?.detail ?? "All generated gates are clear. Queue the first ready PR or keep the plan saved as a handoff."}</p>
          </div>

          <div className="surgery-pr-list">
            {pullRequests.slice(0, 4).map((pr, index) => {
              const intel = getPrIntelligence(pr, index);
              return (
                <button
                  type="button"
                  className={`surgery-pr-mini ${pr.id === selectedId ? "selected" : ""}`}
                  key={pr.id}
                  onClick={() => onSelectPullRequest(pr.id)}
                >
                  <span>
                    <strong>#{pr.number}</strong>
                    <small>{intel.readiness}/{intel.readinessTotal} gates</small>
                  </span>
                  <StatusPill state={pr.state} />
                  <CiBadge state={pr.ci} />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="surgery-run-train"
            disabled={!firstReadyPr}
            onClick={() => firstReadyPr && onSmartMerge(firstReadyPr.id)}
          >
            <GitMerge size={14} />
            Queue first ready PR
          </button>
          <span className="surgery-saved-state">
            {plan ? `Saved ${formatRelativeTime(plan.createdAt)}` : "No saved stack plan yet"}
          </span>
        </aside>
      </div>
    </section>
  );
}

function SurgeryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "blue" | "green" | "amber" | "red";
}) {
  return (
    <div className={`surgery-metric metric-${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function buildStackPlan(
  repo: string,
  branches: BranchSummary[],
  pullRequests: PullRequestSummary[],
  reviewMemory: ReviewMemoryByPr,
  savedPlan?: StackPlanSnapshot,
): StackPlanSnapshot {
  const savedDone = new Map((savedPlan?.steps ?? []).map((step) => [step.id, step.done]));
  const steps: StackPlanStep[] = [];

  branches
    .filter(isBranchDrifted)
    .forEach((branch) => {
      const pr = pullRequests.find((item) => item.number === branch.pullRequestNumber);
      const drift = branch.health === "diverged" ? "diverged from main" : `${branch.behind} commits behind main`;
      steps.push(withDone(savedDone, {
        id: `rebase:${branch.id}`,
        kind: "rebase",
        title: branch.health === "diverged" ? "Rebase diverged branch" : "Refresh branch from main",
        detail: `${branch.name} is ${drift}; replay ${branch.ahead} local commits before review.`,
        targetId: pr?.id,
        targetLabel: pr ? `#${pr.number}` : branch.name,
      }));
    });

  pullRequests.forEach((pr, index) => {
    const memory = reviewMemory[pr.id];

    if (pr.state === "changes_requested" || memory?.decision === "blocked") {
      steps.push(withDone(savedDone, {
        id: `resolve:${pr.id}`,
        kind: "resolve",
        title: "Resolve requested changes",
        detail: `#${pr.number} is blocking the stack with reviewer or local memory feedback.`,
        targetId: pr.id,
        targetLabel: `#${pr.number}`,
      }));
    }

    if (pr.ci === "failure" || pr.ci === "pending") {
      steps.push(withDone(savedDone, {
        id: `test:${pr.id}`,
        kind: "test",
        title: pr.ci === "failure" ? "Fix failing checks" : "Wait for checks",
        detail: `#${pr.number}: ${pr.ciSummary}.`,
        targetId: pr.id,
        targetLabel: `#${pr.number}`,
      }));
    }

    if (!pr.codex.exists || pr.codex.reaction === "eyes") {
      steps.push(withDone(savedDone, {
        id: `review:${pr.id}`,
        kind: "review",
        title: pr.codex.exists ? "Close Codex watch" : "Run Codex sweep",
        detail: `#${pr.number}: ${pr.codex.statusText}.`,
        targetId: pr.id,
        targetLabel: `#${pr.number}`,
      }));
    }

    if (isReadyForMerge(pr, index, reviewMemory)) {
      steps.push(withDone(savedDone, {
        id: `merge:${pr.id}`,
        kind: "merge",
        title: "Queue merge after repair",
        detail: `#${pr.number} has green checks and enough readiness to enter the train.`,
        targetId: pr.id,
        targetLabel: `#${pr.number}`,
      }));
    }
  });

  return {
    id: savedPlan?.id ?? `${repo}:stack-surgery`,
    repo,
    title: `Stack surgery plan · ${repo}`,
    createdAt: savedPlan?.createdAt ?? new Date(0).toISOString(),
    steps: steps.slice(0, 12),
  };
}

function withDone(
  savedDone: Map<string, boolean>,
  step: Omit<StackPlanStep, "done">,
): StackPlanStep {
  return {
    ...step,
    done: savedDone.get(step.id) ?? false,
  };
}

function stampPlan(plan: StackPlanSnapshot): StackPlanSnapshot {
  return {
    ...plan,
    createdAt: new Date().toISOString(),
  };
}

function isBranchDrifted(branch: BranchSummary) {
  return branch.name !== "main" && (branch.behind > 0 || branch.health === "behind" || branch.health === "diverged");
}

function isReadyForMerge(
  pr: PullRequestSummary,
  index: number,
  reviewMemory: ReviewMemoryByPr,
) {
  const memory = reviewMemory[pr.id];
  const snoozed = Boolean(memory?.snoozedUntil && new Date(memory.snoozedUntil).getTime() > Date.now());
  const intel = getPrIntelligence(pr, index);

  return (
    !pr.isDraft &&
    !snoozed &&
    pr.ci === "success" &&
    memory?.decision !== "blocked" &&
    (memory?.decision === "ready" || pr.state === "approved" || intel.readiness >= intel.readinessTotal - 1)
  );
}

function iconForStep(kind: StackPlanStepKind) {
  if (kind === "rebase") return <GitBranch size={15} />;
  if (kind === "resolve") return <Wrench size={15} />;
  if (kind === "test") return <ShieldAlert size={15} />;
  if (kind === "review") return <Bot size={15} />;
  return <GitMerge size={15} />;
}
