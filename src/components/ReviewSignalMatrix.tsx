import { useMemo } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Copy,
  Eye,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Radar,
  ShieldCheck,
  ThumbsUp,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getPrIntelligence } from "../lib/insights";
import type { BranchSummary, CodexReaction, PullRequestSummary, ReviewMemory, ReviewMemoryByPr } from "../types";
import { BranchStatus, CiBadge, CodexBadge, formatRelativeTime, StatusPill } from "./ui";

type MatrixTone = "green" | "amber" | "red" | "blue" | "purple";
type ReviewGateKey = "human" | "codex" | "ci" | "branch" | "memory";

interface ReviewSignalMatrixProps {
  activeRepo: string;
  pullRequests: PullRequestSummary[];
  branches: BranchSummary[];
  reviewMemory: ReviewMemoryByPr;
  selectedPrId?: string;
  onSelectPullRequest: (id: string) => void;
  onPromoteCodex: (id: string) => void;
  onMarkReady: (id: string) => void;
  onOpenChangeRadar: () => void;
  onCopyMatrix: (text: string, count: number) => void;
}

interface ReviewMatrixItem {
  pr: PullRequestSummary;
  branch?: BranchSummary;
  memory?: ReviewMemory;
  human: GateState;
  codex: GateState;
  ci: GateState;
  branchGate: GateState;
  memoryGate: GateState;
  readiness: number;
  readinessTotal: number;
  score: number;
  tone: MatrixTone;
  nextAction: string;
}

interface GateState {
  key: ReviewGateKey;
  label: string;
  detail: string;
  tone: MatrixTone;
  ready: boolean;
  icon: LucideIcon;
}

interface MatrixMetric {
  label: string;
  value: string;
  detail: string;
  tone: MatrixTone;
  icon: LucideIcon;
}

export function ReviewSignalMatrix({
  activeRepo,
  pullRequests,
  branches,
  reviewMemory,
  selectedPrId,
  onSelectPullRequest,
  onPromoteCodex,
  onMarkReady,
  onOpenChangeRadar,
  onCopyMatrix,
}: ReviewSignalMatrixProps) {
  const model = useMemo(
    () => buildReviewMatrix(activeRepo, pullRequests, branches, reviewMemory),
    [activeRepo, branches, pullRequests, reviewMemory],
  );
  const focusItem =
    model.items.find((item) => item.pr.id === selectedPrId) ??
    model.items[0];

  return (
    <section className="review-signal-matrix" id="review-signal-matrix" data-testid="review-signal-matrix" aria-label="Review signal matrix">
      <div className="review-matrix-head">
        <div>
          <span>Review matrix</span>
          <h2>{model.headline}</h2>
        </div>
        <div className="review-matrix-actions">
          <button type="button" onClick={() => onCopyMatrix(model.copy, model.items.length)} data-testid="review-matrix-copy">
            <Copy size={14} />
            Copy matrix
          </button>
          <button type="button" onClick={onOpenChangeRadar}>
            <Radar size={14} />
            Radar
          </button>
        </div>
      </div>

      <div className="review-matrix-metrics" aria-label="Review matrix metrics">
        {model.metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <div className={`review-matrix-metric metric-${metric.tone}`} key={metric.label}>
              <Icon size={15} />
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </div>
          );
        })}
      </div>

      <div className="review-matrix-grid">
        <div className="review-matrix-table" role="table" aria-label="Pull request review signals">
          <div className="review-matrix-row review-matrix-header" role="row">
            <span>Pull request</span>
            <span>Human</span>
            <span>Codex</span>
            <span>CI</span>
            <span>Branch</span>
            <span>Decision</span>
          </div>

          {model.items.slice(0, 7).map((item) => (
            <button
              type="button"
              className={`review-matrix-row signal-${item.tone} ${item.pr.id === focusItem?.pr.id ? "selected" : ""}`}
              key={item.pr.id}
              onClick={() => onSelectPullRequest(item.pr.id)}
              role="row"
            >
              <span className="review-matrix-pr" role="cell">
                <em>#{item.pr.number}</em>
                <span>
                  <strong>{item.pr.title}</strong>
                  <small>{item.pr.branch} - {formatRelativeTime(item.pr.updatedAt)}</small>
                </span>
              </span>
              <GateCell gate={item.human} />
              <GateCell gate={item.codex} reaction={item.pr.codex.reaction} />
              <span className="review-matrix-ci" role="cell">
                <CiBadge state={item.pr.ci} />
                <small>{item.pr.ciSummary}</small>
              </span>
              <span className="review-matrix-branch" role="cell">
                {item.branch ? <BranchStatus branch={item.branch.health} /> : <GitBranch size={14} />}
                <small>{item.branch ? `+${item.branch.ahead} / -${item.branch.behind}` : "No branch"}</small>
              </span>
              <span className={`review-matrix-decision decision-${item.memoryGate.tone}`} role="cell">
                <strong>{item.memory?.decision ?? "watch"}</strong>
                <small>{item.readiness}/{item.readinessTotal} gates</small>
              </span>
            </button>
          ))}

          {!model.items.length && (
            <div className="review-matrix-empty">
              <CheckCircle2 size={18} />
              <strong>No active pull requests</strong>
              <span>Open PRs will appear here after the next sync.</span>
            </div>
          )}
        </div>

        <aside className="review-matrix-focus">
          {focusItem ? (
            <>
              <div className={`review-focus-card signal-${focusItem.tone}`}>
                <span className="review-focus-icon">{iconForTone(focusItem.tone)}</span>
                <div>
                  <strong>#{focusItem.pr.number} {focusItem.nextAction}</strong>
                  <p>{focusItem.pr.title}</p>
                </div>
                <StatusPill state={focusItem.pr.state} />
              </div>

              <div className="review-focus-ladder" aria-label="Review gate ladder">
                {[focusItem.human, focusItem.codex, focusItem.ci, focusItem.branchGate, focusItem.memoryGate].map((gate) => (
                  <div className={`review-gate-step gate-${gate.tone} ${gate.ready ? "ready" : ""}`} key={gate.key}>
                    <span>
                      <gate.icon size={14} />
                    </span>
                    <strong>{gate.label}</strong>
                    <small>{gate.detail}</small>
                  </div>
                ))}
              </div>

              <div className="review-focus-events">
                <div className="review-matrix-section-title">
                  <span>Latest signals</span>
                  <strong>{focusItem.pr.reviewEvents.length + focusItem.pr.codex.events.length}</strong>
                </div>
                {buildSignalEvents(focusItem.pr).slice(0, 4).map((event) => (
                  <div className={`review-focus-event event-${event.tone}`} key={event.id}>
                    <span>{event.icon}</span>
                    <div>
                      <strong>{event.title}</strong>
                      <small>{event.detail}</small>
                    </div>
                  </div>
                ))}
              </div>

              <div className="review-focus-actions">
                <button type="button" onClick={() => onPromoteCodex(focusItem.pr.id)} disabled={isCodexApproved(focusItem.pr.codex.reaction)}>
                  <ThumbsUp size={13} />
                  Promote Codex
                </button>
                <button type="button" onClick={() => onMarkReady(focusItem.pr.id)} disabled={focusItem.memory?.decision === "ready"}>
                  <GitMerge size={13} />
                  Mark ready
                </button>
              </div>
            </>
          ) : (
            <div className="review-matrix-empty focus-empty">
              <CheckCircle2 size={18} />
              <strong>No review focus</strong>
              <span>Select a PR to inspect review gates.</span>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function GateCell({ gate, reaction }: { gate: GateState; reaction?: CodexReaction }) {
  return (
    <span className={`review-matrix-gate gate-${gate.tone}`} role="cell">
      {reaction ? <CodexBadge reaction={reaction} compact /> : <gate.icon size={14} />}
      <span>
        <strong>{gate.label}</strong>
        <small>{gate.detail}</small>
      </span>
    </span>
  );
}

function buildReviewMatrix(
  activeRepo: string,
  pullRequests: PullRequestSummary[],
  branches: BranchSummary[],
  reviewMemory: ReviewMemoryByPr,
) {
  const branchByName = new Map(branches.map((branch) => [`${branch.repo}:${branch.name}`, branch]));
  const branchByPr = new Map(
    branches
      .filter((branch) => branch.pullRequestNumber)
      .map((branch) => [`${branch.repo}#${branch.pullRequestNumber}`, branch]),
  );
  const items = pullRequests
    .filter((pr) => pr.state !== "merged")
    .map((pr, index) => {
      const branch = branchByName.get(`${pr.repo}:${pr.branch}`) ?? branchByPr.get(`${pr.repo}#${pr.number}`);
      return buildMatrixItem(pr, branch, reviewMemory[pr.id], index);
    })
    .sort((a, b) => a.score - b.score || b.pr.updatedAt.localeCompare(a.pr.updatedAt));
  const totals = {
    active: items.length,
    humanReady: items.filter((item) => item.human.ready).length,
    codexReady: items.filter((item) => item.codex.ready).length,
    branchReady: items.filter((item) => item.branchGate.ready).length,
    mergeReady: items.filter((item) => item.memoryGate.ready && item.codex.ready && item.branchGate.ready && item.ci.ready).length,
  };
  const risk = items.filter((item) => item.tone === "red" || item.tone === "amber").length;
  const headline = risk
    ? `${risk} review ${plural("gate", risk)} need attention in ${activeRepo}`
    : `${activeRepo} review gates are green`;
  const metrics: MatrixMetric[] = [
    {
      label: "Human",
      value: `${totals.humanReady}/${Math.max(1, totals.active)}`,
      detail: "review covered",
      tone: totals.humanReady === totals.active ? "green" : totals.humanReady ? "amber" : "red",
      icon: Users,
    },
    {
      label: "Codex",
      value: `${totals.codexReady}/${Math.max(1, totals.active)}`,
      detail: "thumbs or changed",
      tone: totals.codexReady === totals.active ? "green" : totals.codexReady ? "purple" : "red",
      icon: Bot,
    },
    {
      label: "Branch",
      value: `${totals.branchReady}/${Math.max(1, totals.active)}`,
      detail: "fresh enough",
      tone: totals.branchReady === totals.active ? "green" : "amber",
      icon: GitBranch,
    },
    {
      label: "Merge",
      value: `${totals.mergeReady}`,
      detail: "ready candidates",
      tone: totals.mergeReady ? "green" : "amber",
      icon: GitMerge,
    },
  ];

  return {
    copy: formatMatrixBrief(activeRepo, items, totals),
    headline,
    items,
    metrics,
  };
}

function buildMatrixItem(
  pr: PullRequestSummary,
  branch: BranchSummary | undefined,
  memory: ReviewMemory | undefined,
  index: number,
): ReviewMatrixItem {
  const intel = getPrIntelligence(pr, index);
  const human = buildHumanGate(pr);
  const codex = buildCodexGate(pr);
  const ci = buildCiGate(pr);
  const branchGate = buildBranchGate(branch);
  const memoryGate = buildMemoryGate(memory, intel.readiness, intel.readinessTotal);
  const gates = [human, codex, ci, branchGate, memoryGate];
  const missing = gates.filter((gate) => !gate.ready).length;
  const red = gates.some((gate) => gate.tone === "red");
  const amber = gates.some((gate) => gate.tone === "amber");
  const tone: MatrixTone = red ? "red" : amber ? "amber" : codex.tone === "purple" ? "purple" : "green";
  const score =
    missing * 20 +
    (red ? 35 : 0) +
    (amber ? 14 : 0) +
    (pr.isDraft ? 8 : 0) +
    (intel.risk === "high" ? 18 : intel.risk === "medium" ? 8 : 0);

  return {
    branch,
    branchGate,
    ci,
    codex,
    human,
    memory,
    memoryGate,
    nextAction: nextActionForGates(gates, pr),
    pr,
    readiness: intel.readiness,
    readinessTotal: intel.readinessTotal,
    score,
    tone,
  };
}

function buildHumanGate(pr: PullRequestSummary): GateState {
  const humanReviews = pr.reviewEvents.filter((event) => !event.reviewer.isCodex);
  const approval = humanReviews.find((event) => event.state === "approved");
  const changes = humanReviews.find((event) => event.state === "changes_requested");

  if (changes) {
    return {
      key: "human",
      label: "Changes",
      detail: `@${changes.reviewer.login}`,
      icon: AlertTriangle,
      ready: false,
      tone: "red",
    };
  }

  if (approval || pr.state === "approved") {
    return {
      key: "human",
      label: "Approved",
      detail: approval ? `@${approval.reviewer.login}` : "state approved",
      icon: UserCheck,
      ready: true,
      tone: "green",
    };
  }

  if (pr.reviewers.length) {
    return {
      key: "human",
      label: "Assigned",
      detail: `${pr.reviewers.filter((reviewer) => !reviewer.isCodex).length || pr.reviewers.length} reviewers`,
      icon: Users,
      ready: false,
      tone: "amber",
    };
  }

  return {
    key: "human",
    label: "Missing",
    detail: "no reviewer",
    icon: Users,
    ready: false,
    tone: "red",
  };
}

function buildCodexGate(pr: PullRequestSummary): GateState {
  if (pr.codex.reaction === "changed" || pr.codex.reaction === "thumbs_up") {
    return {
      key: "codex",
      label: pr.codex.reaction === "changed" ? "Changed" : "Thumbs",
      detail: pr.codex.lastSeenAt ? formatRelativeTime(pr.codex.lastSeenAt) : "approved",
      icon: ThumbsUp,
      ready: true,
      tone: "green",
    };
  }

  if (pr.codex.reaction === "eyes") {
    return {
      key: "codex",
      label: "Eyes",
      detail: "watching",
      icon: Eye,
      ready: false,
      tone: "purple",
    };
  }

  return {
    key: "codex",
    label: "Missing",
    detail: "no AI review",
    icon: Bot,
    ready: false,
    tone: "red",
  };
}

function buildCiGate(pr: PullRequestSummary): GateState {
  if (pr.ci === "success") {
    return {
      key: "ci",
      label: "Passing",
      detail: pr.ciSummary,
      icon: ShieldCheck,
      ready: true,
      tone: "green",
    };
  }

  if (pr.ci === "failure") {
    return {
      key: "ci",
      label: "Failing",
      detail: pr.ciSummary,
      icon: AlertTriangle,
      ready: false,
      tone: "red",
    };
  }

  return {
    key: "ci",
    label: pr.ci === "pending" ? "Pending" : "Unknown",
    detail: pr.ciSummary,
    icon: ShieldCheck,
    ready: false,
    tone: "amber",
  };
}

function buildBranchGate(branch?: BranchSummary): GateState {
  if (!branch) {
    return {
      key: "branch",
      label: "Unknown",
      detail: "no branch",
      icon: GitBranch,
      ready: false,
      tone: "amber",
    };
  }

  if (branch.health === "healthy" || branch.health === "ahead") {
    return {
      key: "branch",
      label: branch.health === "ahead" ? "Ahead" : "Fresh",
      detail: `+${branch.ahead} / -${branch.behind}`,
      icon: GitBranch,
      ready: true,
      tone: branch.health === "ahead" ? "blue" : "green",
    };
  }

  return {
    key: "branch",
    label: branch.health,
    detail: `+${branch.ahead} / -${branch.behind}`,
    icon: GitBranch,
    ready: false,
    tone: branch.health === "diverged" ? "red" : "amber",
  };
}

function buildMemoryGate(memory: ReviewMemory | undefined, readiness: number, readinessTotal: number): GateState {
  if (memory?.decision === "ready") {
    return {
      key: "memory",
      label: "Ready",
      detail: "local decision",
      icon: CheckCircle2,
      ready: true,
      tone: "green",
    };
  }

  if (memory?.decision === "blocked") {
    return {
      key: "memory",
      label: "Blocked",
      detail: "local decision",
      icon: AlertTriangle,
      ready: false,
      tone: "red",
    };
  }

  return {
    key: "memory",
    label: "Watch",
    detail: `${readiness}/${readinessTotal} ready`,
    icon: GitPullRequest,
    ready: readiness >= readinessTotal - 1,
    tone: readiness >= readinessTotal - 1 ? "amber" : "blue",
  };
}

function nextActionForGates(gates: GateState[], pr: PullRequestSummary) {
  const failing = gates.find((gate) => !gate.ready && gate.tone === "red") ?? gates.find((gate) => !gate.ready);
  if (!failing) return "is ready to stage";
  if (failing.key === "codex") return pr.codex.reaction === "eyes" ? "needs Codex promotion" : "needs Codex review";
  if (failing.key === "human") return "needs human review";
  if (failing.key === "ci") return "needs CI repair";
  if (failing.key === "branch") return "needs branch sync";
  return "needs local decision";
}

function buildSignalEvents(pr: PullRequestSummary) {
  return [...pr.reviewEvents, ...pr.codex.events]
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .map((event, index) => ({
      detail: `${event.state.replace("_", " ")} - ${formatRelativeTime(event.submittedAt)}`,
      icon: event.reviewer.isCodex ? <Bot size={14} /> : <UserCheck size={14} />,
      id: `${event.id}-${index}`,
      title: event.reviewer.isCodex ? `Codex ${reactionLabel(event.reaction)}` : `@${event.reviewer.login}`,
      tone: event.state === "approved" ? "green" : event.state === "changes_requested" ? "red" : event.reviewer.isCodex ? "purple" : "blue",
    }));
}

function iconForTone(tone: MatrixTone) {
  if (tone === "red") return <AlertTriangle size={15} />;
  if (tone === "amber") return <Eye size={15} />;
  if (tone === "purple") return <Bot size={15} />;
  return <CheckCircle2 size={15} />;
}

function isCodexApproved(reaction: CodexReaction) {
  return reaction === "changed" || reaction === "thumbs_up";
}

function reactionLabel(reaction: CodexReaction) {
  if (reaction === "thumbs_up") return "thumbs up";
  if (reaction === "changed") return "eyes to thumbs up";
  if (reaction === "eyes") return "eyes";
  return "none";
}

function formatMatrixBrief(
  activeRepo: string,
  items: ReviewMatrixItem[],
  totals: { active: number; humanReady: number; codexReady: number; branchReady: number; mergeReady: number },
) {
  return [
    `Review matrix for ${activeRepo}`,
    `${totals.active} active PRs, ${totals.humanReady} human-ready, ${totals.codexReady} Codex-ready, ${totals.branchReady} branch-ready, ${totals.mergeReady} merge candidates.`,
    "",
    ...items.map((item) => (
      `#${item.pr.number} ${item.pr.title} - ${item.nextAction}; human ${item.human.label}, Codex ${item.codex.label}, CI ${item.ci.label}, branch ${item.branchGate.label}, decision ${item.memory?.decision ?? "watch"}`
    )),
  ].join("\n");
}

function plural(label: string, count: number) {
  return count === 1 ? label : `${label}s`;
}
