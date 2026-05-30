import { GitBranch, GitCommitHorizontal, GitMerge, Layers3, RefreshCw } from "lucide-react";
import { BranchSummary, PullRequestSummary } from "../types";
import { getPrIntelligence } from "../lib/insights";
import { formatRelativeTime } from "./ui";

interface StackGraphProps {
  branches: BranchSummary[];
  pullRequests: PullRequestSummary[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function StackGraph({ branches, pullRequests, selectedId, onSelect }: StackGraphProps) {
  const stack = pullRequests.slice(0, 4);
  const behindMain = branches.reduce((sum, branch) => sum + branch.behind, 0);
  const lastUpdated = stack[0]?.updatedAt ?? branches[0]?.updatedAt;

  return (
    <section className="stack-graph panel">
      <div className="panel-head stack-head">
        <div>
          <h2>Checkout Flow stack</h2>
          <span>
            <Layers3 size={13} />
            {stack.length} PRs · {behindMain} behind main · Updated {formatRelativeTime(lastUpdated)}
          </span>
        </div>
        <div className="panel-actions">
          <button className="control-button tight">
            <GitCommitHorizontal size={15} />
            <span>Stack view</span>
          </button>
          <button className="control-button tight">
            <GitBranch size={15} />
            <span>Graph view</span>
          </button>
          <button className="icon-button small" title="Sync stack" aria-label="Sync stack">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div className="stack-track">
        {stack.map((pr, index) => {
          const intel = getPrIntelligence(pr, index);
          return (
            <button
              className={`stack-node ${selectedId === pr.id ? "selected" : ""}`}
              key={pr.id}
              onClick={() => onSelect(pr.id)}
            >
              <span className="stack-node-number">#{pr.number}</span>
              <strong>{pr.title.replace(/^feat: |^fix: |^chore: |^docs: /, "")}</strong>
              <small>{pr.branch}</small>
              <span className={`risk-dot risk-${intel.risk}`} />
              {index < stack.length - 1 && <i className="stack-connector" />}
            </button>
          );
        })}
        <span className="main-node">
          <GitMerge size={15} />
          main
        </span>
      </div>

      <div className="stack-footer">
        <span>{behindMain} commits behind main</span>
        <div>
          <button>Rebase all</button>
          <button>Sync all</button>
        </div>
      </div>
    </section>
  );
}
