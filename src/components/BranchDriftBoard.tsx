import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Radar,
  RefreshCw,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import type { BranchSummary, PullRequestSummary } from "../types";
import { BranchStatus, CiBadge, CodexBadge, formatRelativeTime } from "./ui";

type BranchDriftTone = "green" | "amber" | "red" | "blue" | "purple";

interface BranchDriftBoardProps {
  activeRepo: string;
  branches: BranchSummary[];
  pullRequests: PullRequestSummary[];
  selectedPrId?: string;
  onOpenPullRequest: (repo: string, id: string) => void;
  onCopyDriftPlan: (text: string, count: number) => void;
  onOpenChangeRadar: () => void;
}

interface BranchDriftItem {
  branch: BranchSummary;
  pullRequest?: PullRequestSummary;
  commandLines: string[];
  commandTitle: string;
  detail: string;
  nextStep: string;
  score: number;
  tone: BranchDriftTone;
}

interface BranchDriftMetric {
  label: string;
  value: string;
  detail: string;
  tone: BranchDriftTone;
  icon: LucideIcon;
}

export function BranchDriftBoard({
  activeRepo,
  branches,
  pullRequests,
  selectedPrId,
  onOpenPullRequest,
  onCopyDriftPlan,
  onOpenChangeRadar,
}: BranchDriftBoardProps) {
  const model = useMemo(
    () => buildBranchDriftModel(activeRepo, branches, pullRequests),
    [activeRepo, branches, pullRequests],
  );
  const defaultBranchId =
    model.items.find((item) => item.pullRequest?.id === selectedPrId)?.branch.id ??
    model.items[0]?.branch.id;
  const [selectedBranchId, setSelectedBranchId] = useState(defaultBranchId);

  useEffect(() => {
    setSelectedBranchId(defaultBranchId);
  }, [defaultBranchId]);

  const selectedItem =
    model.items.find((item) => item.branch.id === selectedBranchId) ??
    model.items.find((item) => item.branch.id === defaultBranchId) ??
    model.items[0];
  const maxAhead = Math.max(1, ...model.items.map((item) => item.branch.ahead));
  const maxBehind = Math.max(1, ...model.items.map((item) => item.branch.behind));

  return (
    <section className="branch-drift-board" id="branch-drift-board" data-testid="branch-drift-board" aria-label="Branch drift board">
      <div className="branch-drift-head">
        <div>
          <span>Branch drift</span>
          <h2>{model.headline}</h2>
        </div>
        <div className="branch-drift-actions">
          <button
            type="button"
            onClick={() => onCopyDriftPlan(model.copy, model.actionCount)}
            data-testid="branch-drift-copy-plan"
          >
            <Copy size={14} />
            Copy sync plan
          </button>
          <button type="button" onClick={onOpenChangeRadar}>
            <Radar size={14} />
            Change radar
          </button>
        </div>
      </div>

      <div className="branch-drift-metrics" aria-label="Branch drift metrics">
        {model.metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <div className={`branch-drift-metric metric-${metric.tone}`} key={metric.label}>
              <Icon size={15} />
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </div>
          );
        })}
      </div>

      <div className="branch-drift-grid">
        <div className="branch-drift-queue">
          <div className="branch-drift-section-title">
            <span>Sync queue</span>
            <strong>{model.actionCount}</strong>
          </div>

          <div className="branch-drift-list">
            {model.items.map((item) => (
              <button
                type="button"
                className={`branch-drift-row drift-${item.tone} ${item.branch.id === selectedItem?.branch.id ? "selected" : ""}`}
                key={item.branch.id}
                onClick={() => setSelectedBranchId(item.branch.id)}
              >
                <span className="branch-drift-icon">
                  {iconForBranch(item.branch)}
                </span>
                <span className="branch-drift-copy">
                  <strong>{item.branch.name}</strong>
                  <small>{item.detail}</small>
                </span>
                <span className="branch-drift-delta" aria-label={`${item.branch.ahead} ahead, ${item.branch.behind} behind`}>
                  <em>+{item.branch.ahead}</em>
                  <em>-{item.branch.behind}</em>
                </span>
              </button>
            ))}

            {!model.items.length && (
              <div className="branch-drift-empty">
                <CheckCircle2 size={18} />
                <strong>No feature branches</strong>
                <span>Branches will appear here after the next GitHub sync.</span>
              </div>
            )}
          </div>
        </div>

        <div className="branch-drift-map">
          <div className="branch-drift-section-title">
            <span>Graph view</span>
            <strong>{model.items.length}</strong>
          </div>

          <div className="branch-drift-bars">
            {model.items.slice(0, 6).map((item) => (
              <button
                type="button"
                className={`branch-drift-bar drift-${item.tone} ${item.branch.id === selectedItem?.branch.id ? "selected" : ""}`}
                key={item.branch.id}
                onClick={() => setSelectedBranchId(item.branch.id)}
              >
                <span>
                  <GitMerge size={13} />
                  {item.pullRequest ? `#${item.pullRequest.number}` : "no PR"}
                </span>
                <strong>{item.branch.name}</strong>
                <div className="branch-drift-track" aria-hidden="true">
                  <em className="ahead-track" style={{ width: `${Math.max(5, (item.branch.ahead / maxAhead) * 100)}%` }} />
                  <em className="behind-track" style={{ width: `${Math.max(5, (item.branch.behind / maxBehind) * 100)}%` }} />
                </div>
              </button>
            ))}
          </div>
        </div>

        <aside className="branch-drift-detail">
          {selectedItem ? (
            <>
              <div className={`branch-drift-detail-head drift-${selectedItem.tone}`}>
                <span className="branch-drift-detail-icon">
                  {iconForBranch(selectedItem.branch)}
                </span>
                <div>
                  <strong>{selectedItem.nextStep}</strong>
                  <p>{selectedItem.branch.name}</p>
                </div>
                <BranchStatus branch={selectedItem.branch.health} />
              </div>

              <div className="branch-drift-route">
                <span>{selectedItem.pullRequest?.base ?? "main"}</span>
                <ArrowRight size={14} />
                <span>{selectedItem.branch.name}</span>
              </div>

              <div className="branch-drift-pr-card">
                {selectedItem.pullRequest ? (
                  <>
                    <div>
                      <GitPullRequest size={15} />
                      <span>Linked PR</span>
                      <strong>#{selectedItem.pullRequest.number}</strong>
                    </div>
                    <p>{selectedItem.pullRequest.title}</p>
                    <div className="branch-drift-pr-badges">
                      <CiBadge state={selectedItem.pullRequest.ci} />
                      <CodexBadge reaction={selectedItem.pullRequest.codex.reaction} compact />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <GitBranch size={15} />
                      <span>Unlinked branch</span>
                      <strong>{selectedItem.branch.health}</strong>
                    </div>
                    <p>No pull request is attached yet. Sync the branch, then decide whether it needs a PR.</p>
                  </>
                )}
              </div>

              <div className="branch-drift-command">
                <div className="branch-drift-section-title">
                  <span>{selectedItem.commandTitle}</span>
                  <strong>{selectedItem.commandLines.length}</strong>
                </div>
                <pre>{selectedItem.commandLines.join("\n")}</pre>
              </div>

              <div className="branch-drift-detail-actions">
                <button
                  type="button"
                  onClick={() => onCopyDriftPlan(formatSingleBranchPlan(selectedItem), 1)}
                  data-testid="branch-drift-copy-selected"
                >
                  <Copy size={13} />
                  Copy branch plan
                </button>
                <button
                  type="button"
                  disabled={!selectedItem.pullRequest}
                  onClick={() =>
                    selectedItem.pullRequest &&
                    onOpenPullRequest(selectedItem.pullRequest.repo, selectedItem.pullRequest.id)
                  }
                >
                  <GitPullRequest size={13} />
                  Open PR
                </button>
              </div>

              <time>Updated {formatRelativeTime(selectedItem.branch.updatedAt)}</time>
            </>
          ) : (
            <div className="branch-drift-empty detail-empty">
              <CheckCircle2 size={18} />
              <strong>Branch graph is clean</strong>
              <span>No branch details are available for this repository.</span>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function buildBranchDriftModel(
  activeRepo: string,
  branches: BranchSummary[],
  pullRequests: PullRequestSummary[],
) {
  const prByBranch = new Map(pullRequests.map((pr) => [`${pr.repo}:${pr.branch}`, pr]));
  const prByNumber = new Map(pullRequests.map((pr) => [`${pr.repo}#${pr.number}`, pr]));
  const items = branches
    .filter((branch) => !isDefaultBranch(branch))
    .map<BranchDriftItem>((branch) => {
      const pullRequest =
        prByBranch.get(`${branch.repo}:${branch.name}`) ??
        (branch.pullRequestNumber ? prByNumber.get(`${branch.repo}#${branch.pullRequestNumber}`) : undefined);
      return buildBranchDriftItem(branch, pullRequest);
    })
    .sort((a, b) => b.score - a.score || new Date(b.branch.updatedAt).getTime() - new Date(a.branch.updatedAt).getTime());
  const syncItems = items.filter((item) => needsSync(item.branch));
  const publishItems = items.filter((item) => !needsSync(item.branch) && item.branch.ahead > 0);
  const cleanItems = items.filter((item) => !needsSync(item.branch) && item.branch.ahead === 0);
  const orderedItems = [...syncItems, ...publishItems, ...cleanItems];
  const behindTotal = orderedItems.reduce((sum, item) => sum + item.branch.behind, 0);
  const divergedCount = orderedItems.filter((item) => item.branch.health === "diverged").length;
  const linkedCount = orderedItems.filter((item) => item.pullRequest).length;
  const actionCount = syncItems.length + publishItems.length;
  const freshness = clamp(100 - behindTotal * 8 - divergedCount * 14 - syncItems.length * 6, 24, 99);
  const headline =
    syncItems.length > 0
      ? `${syncItems.length} ${plural("branch", syncItems.length)} need sync before review`
      : publishItems.length > 0
        ? `${publishItems.length} ${plural("branch", publishItems.length)} ready to publish`
        : `${activeRepo} branch graph is fresh`;
  const metrics: BranchDriftMetric[] = [
    {
      label: "Freshness",
      value: `${freshness}%`,
      detail: syncItems.length ? "review drift risk" : "branch graph clean",
      tone: freshness >= 85 ? "green" : freshness >= 62 ? "amber" : "red",
      icon: CheckCircle2,
    },
    {
      label: "Behind",
      value: String(behindTotal),
      detail: "commits to replay",
      tone: behindTotal ? "amber" : "green",
      icon: RefreshCw,
    },
    {
      label: "Diverged",
      value: String(divergedCount),
      detail: "requires careful rebase",
      tone: divergedCount ? "red" : "green",
      icon: ShieldAlert,
    },
    {
      label: "Linked PRs",
      value: String(linkedCount),
      detail: `${orderedItems.length} feature ${plural("branch", orderedItems.length)}`,
      tone: linkedCount ? "blue" : "purple",
      icon: GitPullRequest,
    },
  ];

  return {
    actionCount,
    copy: formatBranchDriftPlan(activeRepo, orderedItems, actionCount),
    headline,
    items: orderedItems,
    metrics,
  };
}

function buildBranchDriftItem(branch: BranchSummary, pullRequest?: PullRequestSummary): BranchDriftItem {
  const sync = needsSync(branch);
  const publish = !sync && branch.ahead > 0;
  const stale = branch.health === "stale";
  const diverged = branch.health === "diverged";
  const tone: BranchDriftTone = diverged ? "red" : sync || stale ? "amber" : publish ? "blue" : "green";
  const score =
    (diverged ? 90 : 0) +
    (sync ? 55 : 0) +
    (stale ? 35 : 0) +
    branch.behind * 8 +
    branch.ahead * 3 +
    (pullRequest ? 8 : 0);
  const base = pullRequest?.base ?? "main";
  const detail = sync
    ? `${branch.ahead} ahead / ${branch.behind} behind ${base}`
    : publish
      ? `${branch.ahead} local ${plural("commit", branch.ahead)} ready to publish`
      : stale
        ? `Last moved ${formatRelativeTime(branch.updatedAt)}`
        : `Fresh against ${base}`;
  const nextStep = diverged
    ? "Careful rebase required"
    : sync
      ? "Refresh from base"
      : publish
        ? "Publish branch"
        : stale
          ? "Confirm branch still needed"
          : "No branch action";

  return {
    branch,
    commandLines: buildBranchCommandLines(branch, pullRequest),
    commandTitle: sync ? "Rebase sequence" : publish ? "Publish sequence" : "Verification sequence",
    detail,
    nextStep,
    pullRequest,
    score,
    tone,
  };
}

function buildBranchCommandLines(branch: BranchSummary, pullRequest?: PullRequestSummary) {
  const base = pullRequest?.base ?? "main";

  if (needsSync(branch)) {
    return [
      `git fetch origin ${shellQuote(base)}`,
      `git checkout ${shellQuote(branch.name)}`,
      `git rebase origin/${shellQuote(base)}`,
      `git push --force-with-lease origin ${shellQuote(branch.name)}`,
    ];
  }

  if (branch.ahead > 0) {
    return [
      `git checkout ${shellQuote(branch.name)}`,
      `git push origin ${shellQuote(branch.name)}`,
    ];
  }

  return [
    `git fetch origin ${shellQuote(base)}`,
    `git log --oneline origin/${shellQuote(base)}..${shellQuote(branch.name)}`,
  ];
}

function formatBranchDriftPlan(activeRepo: string, items: BranchDriftItem[], actionCount: number) {
  const actionItems = items.filter((item) => needsSync(item.branch) || item.branch.ahead > 0);
  const visibleItems = actionItems.length ? actionItems : items.slice(0, 4);
  const lines = [
    `Branch drift plan for ${activeRepo}`,
    `${actionCount} branch ${actionCount === 1 ? "action" : "actions"} queued`,
    "",
    ...visibleItems.flatMap((item, index) => [
      `${index + 1}. ${item.branch.name} - ${item.nextStep}`,
      `   ${item.detail}${item.pullRequest ? ` - PR #${item.pullRequest.number}` : ""}`,
      ...item.commandLines.map((command) => `   ${command}`),
      "",
    ]),
  ];

  return lines.join("\n").trim();
}

function formatSingleBranchPlan(item: BranchDriftItem) {
  return [
    `${item.branch.repo}:${item.branch.name}`,
    item.nextStep,
    item.detail,
    "",
    ...item.commandLines,
  ].join("\n");
}

function iconForBranch(branch: BranchSummary) {
  if (branch.health === "diverged") return <AlertTriangle size={15} />;
  if (needsSync(branch)) return <RefreshCw size={15} />;
  if (branch.ahead > 0) return <GitBranch size={15} />;
  return <CheckCircle2 size={15} />;
}

function isDefaultBranch(branch: BranchSummary) {
  return branch.name === "main" || branch.name === "master";
}

function needsSync(branch: BranchSummary) {
  return branch.behind > 0 || branch.health === "behind" || branch.health === "diverged" || branch.health === "stale";
}

function shellQuote(value: string) {
  return /^[A-Za-z0-9._/-]+$/.test(value) ? value : `'${value.replace(/'/g, "'\\''")}'`;
}

function plural(label: string, count: number) {
  if (count === 1) return label;
  if (label === "branch") return "branches";
  return `${label}s`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
