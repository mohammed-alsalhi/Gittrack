import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clipboard,
  GitBranch,
  GitCommitVertical,
  GitMerge,
  GitPullRequest,
  Layers3,
  Route,
  ShieldAlert,
  Sparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { getPrIntelligence, type PrIntelligence } from "../lib/insights";
import type { BranchSummary, PullRequestSummary, ReviewMemoryByPr } from "../types";
import { CiBadge, CodexBadge, StatusPill, formatRelativeTime } from "./ui";

interface StackTopologyBoardProps {
  activeRepo: string;
  pullRequests: PullRequestSummary[];
  branches: BranchSummary[];
  reviewMemory: ReviewMemoryByPr;
  selectedPrId?: string;
  onSelectPullRequest: (id: string) => void;
  onPromoteCodex: (id: string) => void;
  onSmartMerge: (id: string) => void;
  onOpenBranchDrift: () => void;
  onOpenStackReview: () => void;
  onCopyTopologyPlan: (text: string, count: number) => void;
}

type TopologyNodeStatus = "blocked" | "ai" | "ready" | "draft" | "watch";
type GateTone = "green" | "amber" | "red" | "purple";

interface TopologyNode {
  pr: PullRequestSummary;
  intel: PrIntelligence;
  branch?: BranchSummary;
  status: TopologyNodeStatus;
  ready: boolean;
  blocked: boolean;
  codexGap: boolean;
}

interface StackTopology {
  key: string;
  repo: string;
  label: string;
  nodes: TopologyNode[];
  blockers: TopologyNode[];
  codexGaps: TopologyNode[];
  ready: TopologyNode[];
  drift: BranchSummary[];
  score: number;
  eta: string;
  copy: string;
}

interface NextMove {
  label: string;
  detail: string;
  tone: GateTone;
  icon: LucideIcon;
  node?: TopologyNode;
  action: () => void;
}

export function StackTopologyBoard({
  activeRepo,
  pullRequests,
  branches,
  reviewMemory,
  selectedPrId,
  onSelectPullRequest,
  onPromoteCodex,
  onSmartMerge,
  onOpenBranchDrift,
  onOpenStackReview,
  onCopyTopologyPlan,
}: StackTopologyBoardProps) {
  const topologies = useMemo(
    () => buildStackTopologies(activeRepo, pullRequests, branches, reviewMemory),
    [activeRepo, branches, pullRequests, reviewMemory],
  );
  const [focusedStackKey, setFocusedStackKey] = useState<string | null>(null);
  const selectedStack =
    topologies.find((stack) => stack.key === focusedStackKey) ??
    topologies.find((stack) => stack.nodes.some((node) => node.pr.id === selectedPrId)) ??
    topologies[0];
  const selectedNode =
    selectedStack?.nodes.find((node) => node.pr.id === selectedPrId) ??
    selectedStack?.blockers[0] ??
    selectedStack?.codexGaps[0] ??
    selectedStack?.ready[0] ??
    selectedStack?.nodes[0];
  const nextMove = selectedStack
    ? buildNextMove(selectedStack, {
        onOpenBranchDrift,
        onPromoteCodex,
        onSelectPullRequest,
        onSmartMerge,
      })
    : undefined;
  const allNodes = topologies.flatMap((stack) => stack.nodes);
  const blockerCount = topologies.reduce((sum, stack) => sum + stack.blockers.length, 0);
  const codexGapCount = topologies.reduce((sum, stack) => sum + stack.codexGaps.length, 0);
  const readyCount = topologies.reduce((sum, stack) => sum + stack.ready.length, 0);
  const driftCount = topologies.reduce((sum, stack) => sum + stack.drift.length, 0);

  return (
    <section className="stack-topology-board" id="stack-topology-board" data-testid="stack-topology-board" aria-label="Stack topology">
      <header className="stack-topology-head">
        <div>
          <span>Stack topology</span>
          <h2>{selectedStack ? `${selectedStack.label} · ${selectedStack.nodes.length} linked PRs` : `${activeRepo} is clear`}</h2>
        </div>
        <div className="stack-topology-actions">
          <button type="button" onClick={() => onCopyTopologyPlan(selectedStack?.copy ?? "", selectedStack?.nodes.length ?? 0)} data-testid="copy-stack-topology">
            <Clipboard size={14} />
            Copy map
          </button>
          <button type="button" onClick={onOpenStackReview}>
            <Workflow size={14} />
            Review stack
          </button>
        </div>
      </header>

      <div className="topology-score-strip" aria-label="Topology score">
        <TopologyScore label="Flow" value={`${selectedStack?.score ?? 100}%`} detail={`${allNodes.length} active nodes`} tone={blockerCount ? "amber" : "green"} icon={Layers3} />
        <TopologyScore label="Blockers" value={String(blockerCount)} detail="CI, review, risk" tone={blockerCount ? "red" : "green"} icon={ShieldAlert} />
        <TopologyScore label="AI gaps" value={String(codexGapCount)} detail="missing or eyes" tone={codexGapCount ? "purple" : "green"} icon={Bot} />
        <TopologyScore label="Ready" value={String(readyCount)} detail="merge candidates" tone={readyCount ? "green" : "amber"} icon={CheckCircle2} />
        <TopologyScore label="Drift" value={String(driftCount)} detail="branch replay" tone={driftCount ? "amber" : "green"} icon={GitBranch} />
      </div>

      {selectedStack ? (
        <div className="topology-workbench">
          <aside className="topology-stack-switcher" aria-label="Stack lanes">
            {topologies.map((stack) => (
              <button
                type="button"
                className={stack.key === selectedStack.key ? "active" : ""}
                key={stack.key}
                onClick={() => setFocusedStackKey(stack.key)}
                data-testid={`topology-stack-${stack.key.replace(/[^a-z0-9_-]/gi, "-")}`}
              >
                <span className="topology-stack-dots" aria-hidden="true">
                  {stack.nodes.slice(0, 5).map((node) => (
                    <i className={`dot-${node.status}`} key={node.pr.id} />
                  ))}
                </span>
                <span>
                  <strong>{stack.label}</strong>
                  <small>{stack.repo} · {stack.eta}</small>
                </span>
                <em>{stack.score}%</em>
              </button>
            ))}
          </aside>

          <div className="topology-map-panel">
            <div className="topology-map-title">
              <span>
                <GitCommitVertical size={15} />
                Dependency lane
              </span>
              <strong>{selectedStack.nodes.length} nodes</strong>
            </div>

            <div className="topology-node-rail">
              {selectedStack.nodes.map((node, index) => (
                <button
                  type="button"
                  className={`topology-node node-${node.status} ${node.pr.id === selectedPrId ? "selected" : ""}`}
                  key={node.pr.id}
                  onClick={() => onSelectPullRequest(node.pr.id)}
                  data-testid={`topology-node-${node.pr.number}`}
                >
                  <span className="topology-node-marker">
                    <i>{node.intel.stackIndex}</i>
                    {index < selectedStack.nodes.length - 1 && <b />}
                  </span>
                  <span className="topology-node-main">
                    <span className="topology-node-kicker">
                      #{node.pr.number}
                      <em>{statusLabel(node.status)}</em>
                    </span>
                    <strong>{node.pr.title}</strong>
                    <small>{node.pr.branch} · {formatRelativeTime(node.pr.updatedAt)}</small>
                  </span>
                  <span className="topology-node-badges">
                    <StatusPill state={node.pr.state} />
                    <CiBadge state={node.pr.ci} />
                    <CodexBadge reaction={node.pr.codex.reaction} compact />
                  </span>
                </button>
              ))}
            </div>
          </div>

          <aside className="topology-command-panel">
            <div className={`topology-next-card next-${nextMove?.tone ?? "green"}`}>
              <span className="topology-next-icon">{nextMove && <nextMove.icon size={16} />}</span>
              <div>
                <span>Next safe move</span>
                <strong>{nextMove?.label ?? "Stack is clear"}</strong>
                <p>{nextMove?.detail ?? "No open pull request needs intervention in this lane."}</p>
              </div>
              <button type="button" onClick={nextMove?.action} disabled={!nextMove} data-testid="topology-run-next">
                Run move
              </button>
            </div>

            <div className="topology-focus-card">
              <span>Selected node</span>
              <strong>{selectedNode ? `#${selectedNode.pr.number} ${selectedNode.pr.title}` : "No active node"}</strong>
              <div className="topology-focus-meta">
                <Metric label="Risk" value={selectedNode?.intel.risk ?? "low"} />
                <Metric label="Ready" value={selectedNode ? `${selectedNode.intel.readiness}/${selectedNode.intel.readinessTotal}` : "0/0"} />
                <Metric label="Files" value={String(selectedNode?.intel.files.length ?? 0)} />
              </div>
              <div className="topology-focus-actions">
                <button type="button" disabled={!selectedNode} onClick={() => selectedNode && onSelectPullRequest(selectedNode.pr.id)}>
                  <GitPullRequest size={14} />
                  Open PR
                </button>
                <button type="button" disabled={!selectedNode?.codexGap} onClick={() => selectedNode && onPromoteCodex(selectedNode.pr.id)}>
                  <Sparkles size={14} />
                  Promote AI
                </button>
                <button type="button" disabled={!selectedNode?.ready} onClick={() => selectedNode && onSmartMerge(selectedNode.pr.id)}>
                  <GitMerge size={14} />
                  Queue
                </button>
              </div>
            </div>

            <div className="topology-gate-list" aria-label="Topology gates">
              <GateRow icon={CheckCircle2} label="CI" value={gateLabel(selectedStack.nodes.every((node) => node.pr.ci !== "failure"), "passing", "failure")} ready={selectedStack.nodes.every((node) => node.pr.ci !== "failure")} />
              <GateRow icon={Bot} label="Codex" value={selectedStack.codexGaps.length ? `${selectedStack.codexGaps.length} gaps` : "covered"} ready={!selectedStack.codexGaps.length} tone="purple" />
              <GateRow icon={ShieldAlert} label="Review" value={selectedStack.blockers.length ? `${selectedStack.blockers.length} blockers` : "clean"} ready={!selectedStack.blockers.length} />
              <GateRow icon={Route} label="Drift" value={selectedStack.drift.length ? `${selectedStack.drift.length} branches` : "fresh"} ready={!selectedStack.drift.length} tone="amber" onClick={onOpenBranchDrift} />
            </div>
          </aside>
        </div>
      ) : (
        <div className="topology-empty-state">
          <CheckCircle2 size={20} />
          <strong>No active stack lanes</strong>
          <span>Open pull requests will appear here as linked topology nodes.</span>
        </div>
      )}
    </section>
  );
}

function TopologyScore({
  label,
  value,
  detail,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  tone: GateTone;
  icon: LucideIcon;
}) {
  return (
    <div className={`topology-score score-${tone}`}>
      <Icon size={15} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function GateRow({
  icon: Icon,
  label,
  value,
  ready,
  tone = "green",
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  ready: boolean;
  tone?: GateTone;
  onClick?: () => void;
}) {
  const content: ReactNode = (
    <>
      <Icon size={14} />
      <strong>{label}</strong>
      <span>{value}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={`topology-gate-row gate-${ready ? "ready" : tone}`} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={`topology-gate-row gate-${ready ? "ready" : tone}`}>{content}</div>;
}

function buildStackTopologies(
  activeRepo: string,
  pullRequests: PullRequestSummary[],
  branches: BranchSummary[],
  reviewMemory: ReviewMemoryByPr,
): StackTopology[] {
  const branchByPr = new Map(
    branches
      .filter((branch) => branch.pullRequestNumber)
      .map((branch) => [`${branch.repo}#${branch.pullRequestNumber}`, branch]),
  );
  const groups = new Map<string, TopologyNode[]>();

  pullRequests
    .filter((pr) => pr.state !== "merged")
    .forEach((pr, index) => {
      const intel = getPrIntelligence(pr, index);
      const branch = branchByPr.get(`${pr.repo}#${pr.number}`);
      const blocked = isBlocked(pr, intel, reviewMemory);
      const codexGap = !pr.codex.exists || pr.codex.reaction === "eyes";
      const ready = isReady(pr, intel, reviewMemory);
      const status: TopologyNodeStatus = blocked ? "blocked" : codexGap ? "ai" : ready ? "ready" : pr.isDraft ? "draft" : "watch";
      const node: TopologyNode = { pr, intel, branch, status, ready, blocked, codexGap };
      const key = `${pr.repo}:${intel.stackName}`;
      groups.set(key, [...(groups.get(key) ?? []), node]);
    });

  return [...groups.entries()]
    .map(([key, nodes]) => {
      const sortedNodes = [...nodes].sort((a, b) => a.intel.stackIndex - b.intel.stackIndex || a.pr.number - b.pr.number);
      const repo = sortedNodes[0]?.pr.repo ?? activeRepo;
      const label = sortedNodes[0]?.intel.stackName ?? "Stack lane";
      const pullRequestNumbers = new Set(sortedNodes.map((node) => node.pr.number));
      const drift = branches.filter(
        (branch) =>
          branch.repo === repo &&
          branch.pullRequestNumber &&
          pullRequestNumbers.has(branch.pullRequestNumber) &&
          branch.health !== "healthy" &&
          branch.health !== "ahead",
      );
      const blockers = sortedNodes.filter((node) => node.blocked);
      const codexGaps = sortedNodes.filter((node) => node.codexGap);
      const ready = sortedNodes.filter((node) => node.ready);
      const rawScore =
        100 -
        blockers.length * 18 -
        codexGaps.length * 10 -
        drift.length * 8 -
        sortedNodes.filter((node) => node.pr.isDraft).length * 6;
      const score = Math.max(35, Math.min(100, rawScore));
      const eta = ready[0]?.pr.queueEstimate ?? sortedNodes[0]?.intel.queueEstimate ?? "TBD";
      const copy = [
        `${label} topology for ${repo}`,
        `Flow score: ${score}%`,
        `Blockers: ${blockers.length}`,
        `Codex gaps: ${codexGaps.length}`,
        `Branch drift: ${drift.length}`,
        ...sortedNodes.map((node) => `#${node.pr.number} ${node.pr.title} — ${statusLabel(node.status)}`),
      ].join("\n");

      return {
        key,
        repo,
        label,
        nodes: sortedNodes,
        blockers,
        codexGaps,
        ready,
        drift,
        score,
        eta,
        copy,
      };
    })
    .sort((a, b) => b.blockers.length - a.blockers.length || b.codexGaps.length - a.codexGaps.length || b.nodes.length - a.nodes.length);
}

function buildNextMove(
  stack: StackTopology,
  actions: {
    onOpenBranchDrift: () => void;
    onPromoteCodex: (id: string) => void;
    onSelectPullRequest: (id: string) => void;
    onSmartMerge: (id: string) => void;
  },
): NextMove {
  const blocker = stack.blockers[0];
  if (blocker) {
    return {
      label: `Open #${blocker.pr.number} blocker`,
      detail: blocker.pr.ci === "failure" ? blocker.pr.ciSummary : blocker.pr.state === "changes_requested" ? "Requested changes are holding the lane." : "Risk is elevated on this dependency node.",
      tone: "red",
      icon: AlertTriangle,
      node: blocker,
      action: () => actions.onSelectPullRequest(blocker.pr.id),
    };
  }

  const codexGap = stack.codexGaps[0];
  if (codexGap) {
    return {
      label: `Promote Codex on #${codexGap.pr.number}`,
      detail: "The stack can move faster once the AI review signal leaves eyes or missing state.",
      tone: "purple",
      icon: Sparkles,
      node: codexGap,
      action: () => actions.onPromoteCodex(codexGap.pr.id),
    };
  }

  if (stack.drift.length) {
    return {
      label: "Replay branch drift",
      detail: `${stack.drift.length} linked branches need a base refresh before merge confidence is high.`,
      tone: "amber",
      icon: Route,
      action: actions.onOpenBranchDrift,
    };
  }

  const ready = stack.ready[0];
  if (ready) {
    return {
      label: `Queue #${ready.pr.number}`,
      detail: `${ready.pr.queueEstimate ?? ready.intel.queueEstimate} estimated once it joins the merge train.`,
      tone: "green",
      icon: GitMerge,
      node: ready,
      action: () => actions.onSmartMerge(ready.pr.id),
    };
  }

  const first = stack.nodes[0];
  return {
    label: first ? `Continue #${first.pr.number}` : "Continue stack review",
    detail: first ? "No hard blocker is active, so continue tightening the next review node." : "No open nodes are in this stack.",
    tone: "green",
    icon: GitPullRequest,
    node: first,
    action: () => first && actions.onSelectPullRequest(first.pr.id),
  };
}

function isBlocked(pr: PullRequestSummary, intel: PrIntelligence, reviewMemory: ReviewMemoryByPr) {
  return pr.ci === "failure" || pr.state === "changes_requested" || intel.risk === "high" || reviewMemory[pr.id]?.decision === "blocked";
}

function isReady(pr: PullRequestSummary, intel: PrIntelligence, reviewMemory: ReviewMemoryByPr) {
  const codexReady = pr.codex.reaction === "thumbs_up" || pr.codex.reaction === "changed";
  return !pr.isDraft && pr.ci === "success" && codexReady && reviewMemory[pr.id]?.decision !== "blocked" && intel.readiness >= intel.readinessTotal - 1;
}

function statusLabel(status: TopologyNodeStatus) {
  if (status === "blocked") return "blocked";
  if (status === "ai") return "AI gap";
  if (status === "ready") return "ready";
  if (status === "draft") return "draft";
  return "watch";
}

function gateLabel(ready: boolean, pass: string, fail: string) {
  return ready ? pass : fail;
}
