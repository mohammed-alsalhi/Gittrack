import { useMemo } from "react";
import {
  Bot,
  CheckCircle2,
  GitBranch,
  GitPullRequest,
  Layers3,
  Radar,
  ShieldAlert,
  Sparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { getPrIntelligence } from "../lib/insights";
import type { BranchSummary, PullRequestSummary, ReviewMemoryByPr } from "../types";
import { CiBadge, CodexBadge, StatusPill } from "./ui";

interface StackCommandRailProps {
  pullRequests: PullRequestSummary[];
  branches: BranchSummary[];
  reviewMemory: ReviewMemoryByPr;
  selectedPrId?: string;
  onOpenPullRequest: (repo: string, id: string) => void;
  onPromoteCodex: (id: string) => void;
  onMarkReady: (id: string) => void;
  onSmartMerge: (id: string) => void;
  onOpenStackReviewNavigator: () => void;
  onOpenChangeRadar: () => void;
}

interface StackRailGroup {
  key: string;
  repo: string;
  label: string;
  pullRequests: PullRequestSummary[];
  blockers: PullRequestSummary[];
  ready: PullRequestSummary[];
  codexGaps: PullRequestSummary[];
  drift: BranchSummary[];
}

export function StackCommandRail({
  pullRequests,
  branches,
  reviewMemory,
  selectedPrId,
  onOpenPullRequest,
  onPromoteCodex,
  onMarkReady,
  onSmartMerge,
  onOpenStackReviewNavigator,
  onOpenChangeRadar,
}: StackCommandRailProps) {
  const groups = useMemo(() => buildStackGroups(pullRequests, branches, reviewMemory), [
    branches,
    pullRequests,
    reviewMemory,
  ]);
  const selectedGroup =
    groups.find((group) => group.pullRequests.some((pr) => pr.id === selectedPrId)) ??
    groups[0];
  const nextPr =
    selectedGroup?.blockers[0] ??
    selectedGroup?.codexGaps[0] ??
    selectedGroup?.ready[0] ??
    selectedGroup?.pullRequests[0];
  const codexFocus = selectedGroup?.codexGaps[0];
  const readyFocus = selectedGroup?.ready[0];
  const activePrCount = pullRequests.filter((pr) => pr.state !== "merged").length;
  const blockerCount = groups.reduce((sum, group) => sum + group.blockers.length, 0);
  const codexGapCount = groups.reduce((sum, group) => sum + group.codexGaps.length, 0);
  const driftCount = groups.reduce((sum, group) => sum + group.drift.length, 0);

  return (
    <section className="stack-command-rail" data-testid="stack-command-rail" aria-label="Stack command rail">
      <div className="stack-rail-head">
        <div>
          <span>Stack command rail</span>
          <h2>{groups.length} live stacks · {activePrCount} PRs</h2>
        </div>
        <div className="stack-rail-actions">
          <button type="button" onClick={onOpenChangeRadar} data-testid="stack-rail-open-radar">
            <Radar size={14} />
            Change radar
          </button>
          <button type="button" onClick={onOpenStackReviewNavigator} data-testid="stack-rail-open-navigator">
            <Workflow size={14} />
            Stack review
          </button>
        </div>
      </div>

      <div className="stack-rail-metrics" aria-label="Stack rail metrics">
        <RailMetric label="Blockers" value={blockerCount} detail="changes, CI, risk" tone={blockerCount ? "red" : "green"} icon={ShieldAlert} />
        <RailMetric label="Codex gaps" value={codexGapCount} detail="missing or eyes" tone={codexGapCount ? "purple" : "green"} icon={Bot} />
        <RailMetric label="Branch drift" value={driftCount} detail="behind or diverged" tone={driftCount ? "amber" : "green"} icon={GitBranch} />
      </div>

      <div className="stack-rail-body">
        <aside className="stack-rail-focus">
          <div className="stack-rail-section-title">
            <Layers3 size={15} />
            <strong>Active stack</strong>
            <span>{selectedGroup?.pullRequests.length ?? 0}</span>
          </div>
          {selectedGroup ? (
            <div className="stack-focus-card">
              <span>{selectedGroup.repo}</span>
              <strong>{selectedGroup.label}</strong>
              <p>
                {selectedGroup.blockers.length} blockers, {selectedGroup.codexGaps.length} Codex gaps, {selectedGroup.ready.length} ship-ready PRs.
              </p>
              <div className="stack-focus-tags">
                <em>{selectedGroup.drift.length} drift</em>
                <em>{selectedGroup.pullRequests.length} PRs</em>
                <em>{selectedGroup.ready.length} ready</em>
              </div>
              <div className="stack-focus-actions">
                <button type="button" disabled={!nextPr} onClick={() => nextPr && onOpenPullRequest(nextPr.repo, nextPr.id)} data-testid="stack-rail-open-next">
                  <GitPullRequest size={14} />
                  Open next
                </button>
                <button type="button" disabled={!codexFocus} onClick={() => codexFocus && onPromoteCodex(codexFocus.id)} data-testid="stack-rail-promote-codex">
                  <Sparkles size={14} />
                  Promote AI
                </button>
                <button type="button" disabled={!readyFocus} onClick={() => readyFocus && onMarkReady(readyFocus.id)} data-testid="stack-rail-mark-ready">
                  <CheckCircle2 size={14} />
                  Mark ready
                </button>
              </div>
            </div>
          ) : (
            <div className="stack-focus-empty">
              <CheckCircle2 size={18} />
              <strong>No active stacks</strong>
              <span>Refresh GitHub or add sample PRs to populate the stack rail.</span>
            </div>
          )}
        </aside>

        <div className="stack-rail-lanes">
          {groups.map((group) => (
            <article className={`stack-rail-lane ${group.key === selectedGroup?.key ? "active" : ""}`} key={group.key}>
              <button
                type="button"
                className="stack-lane-head"
                onClick={() => group.pullRequests[0] && onOpenPullRequest(group.repo, group.pullRequests[0].id)}
              >
                <span>
                  <strong>{group.label}</strong>
                  <small>{group.repo}</small>
                </span>
                <em>{group.pullRequests.length}</em>
              </button>
              <div className="stack-rail-node-list">
                {group.pullRequests.map((pr, index) => {
                  const intel = getPrIntelligence(pr, index);
                  const blocked = group.blockers.some((item) => item.id === pr.id);
                  const ready = group.ready.some((item) => item.id === pr.id);
                  const gap = group.codexGaps.some((item) => item.id === pr.id);

                  return (
                    <button
                      type="button"
                      className={`stack-rail-node ${pr.id === selectedPrId ? "selected" : ""} ${blocked ? "blocked" : ""} ${ready ? "ready" : ""} ${gap ? "gap" : ""}`}
                      key={pr.id}
                      onClick={() => onOpenPullRequest(pr.repo, pr.id)}
                    >
                      <span className="stack-rail-node-index">{intel.stackIndex}/{intel.stackTotal}</span>
                      <span className="stack-rail-node-copy">
                        <strong>#{pr.number} {pr.title}</strong>
                        <small>{pr.branch}</small>
                      </span>
                      <span className="stack-rail-node-badges">
                        <StatusPill state={pr.state} />
                        <CiBadge state={pr.ci} />
                        <CodexBadge reaction={pr.codex.reaction} compact />
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="stack-lane-actions">
                <button
                  type="button"
                  disabled={!group.ready[0]}
                  onClick={() => group.ready[0] && onSmartMerge(group.ready[0].id)}
                >
                  Smart merge
                </button>
                <button
                  type="button"
                  disabled={!group.codexGaps[0]}
                  onClick={() => group.codexGaps[0] && onPromoteCodex(group.codexGaps[0].id)}
                >
                  Fix AI gap
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function RailMetric({
  label,
  value,
  detail,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  detail: string;
  tone: "green" | "amber" | "red" | "purple";
  icon: LucideIcon;
}) {
  return (
    <div className={`stack-rail-metric metric-${tone}`}>
      <Icon size={15} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function buildStackGroups(
  pullRequests: PullRequestSummary[],
  branches: BranchSummary[],
  reviewMemory: ReviewMemoryByPr,
): StackRailGroup[] {
  const branchByPr = new Map(
    branches
      .filter((branch) => branch.pullRequestNumber)
      .map((branch) => [`${branch.repo}#${branch.pullRequestNumber}`, branch]),
  );
  const groups = new Map<string, StackRailGroup>();

  pullRequests
    .filter((pr) => pr.state !== "merged")
    .forEach((pr, index) => {
      const intel = getPrIntelligence(pr, index);
      const key = `${pr.repo}:${intel.stackName}`;
      const group =
        groups.get(key) ??
        ({
          key,
          repo: pr.repo,
          label: intel.stackName,
          pullRequests: [],
          blockers: [],
          ready: [],
          codexGaps: [],
          drift: [],
        } satisfies StackRailGroup);

      group.pullRequests.push(pr);

      const memory = reviewMemory[pr.id];
      const blocked = pr.ci === "failure" || pr.state === "changes_requested" || memory?.decision === "blocked" || intel.risk === "high";
      const ready =
        !pr.isDraft &&
        pr.ci === "success" &&
        memory?.decision !== "blocked" &&
        (memory?.decision === "ready" || pr.state === "approved" || intel.readiness >= intel.readinessTotal - 1);
      const codexGap = !pr.codex.exists || pr.codex.reaction === "eyes";
      const branch = branchByPr.get(`${pr.repo}#${pr.number}`);

      if (blocked) group.blockers.push(pr);
      if (ready) group.ready.push(pr);
      if (codexGap) group.codexGaps.push(pr);
      if (branch && (branch.health === "behind" || branch.health === "diverged" || branch.health === "stale")) {
        group.drift.push(branch);
      }

      groups.set(key, group);
    });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      pullRequests: [...group.pullRequests].sort(
        (a, b) => getPrIntelligence(a).stackIndex - getPrIntelligence(b).stackIndex || a.number - b.number,
      ),
    }))
    .sort((a, b) => b.blockers.length - a.blockers.length || b.codexGaps.length - a.codexGaps.length || b.ready.length - a.ready.length);
}
