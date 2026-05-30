import { GitBranch, Plus, RefreshCw } from "lucide-react";
import { BranchSummary } from "../types";
import { BranchStatus, formatRelativeTime } from "./ui";

interface BranchPanelProps {
  branches: BranchSummary[];
}

export function BranchPanel({ branches }: BranchPanelProps) {
  return (
    <section className="branch-panel panel">
      <div className="panel-head">
        <div>
          <h2>Stack Health</h2>
          <span>{branches.length} branches in view</span>
        </div>
        <div className="panel-actions">
          <button className="control-button tight">
            <Plus size={15} />
            <span>New Branch</span>
          </button>
          <button className="icon-button small" title="Refresh branches" aria-label="Refresh branches">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div className="branch-list">
        {branches.map((branch) => (
          <div className="branch-row" key={branch.id}>
            <div className="branch-name">
              <GitBranch size={15} />
              <span>{branch.name}</span>
            </div>
            <div className="branch-meta">
              <BranchStatus branch={branch.health} />
              {branch.ahead > 0 && <em className="ahead">Ahead {branch.ahead}</em>}
              {branch.behind > 0 && <em className="behind">Behind {branch.behind}</em>}
            </div>
            <time>{formatRelativeTime(branch.updatedAt)}</time>
          </div>
        ))}
      </div>
    </section>
  );
}
