import {
  AlertCircle,
  CheckCircle2,
  CircleDot,
  Clock3,
  Eye,
  GitBranch,
  GitPullRequest,
  Inbox,
  ListFilter,
  Plus,
  ShieldAlert,
} from "lucide-react";
import { RepoSummary } from "../types";

export type FilterId =
  | "all"
  | "waiting"
  | "needs-review"
  | "drafts"
  | "changes"
  | "approved"
  | "codex"
  | "high-risk";

export interface FilterItem {
  id: FilterId;
  label: string;
  count: number;
}

interface SidebarProps {
  repos: RepoSummary[];
  activeRepo: string;
  filters: FilterItem[];
  activeFilter: FilterId;
  onRepoChange: (repo: string) => void;
  onFilterChange: (filter: FilterId) => void;
  onAddRepo: () => void;
}

export function Sidebar({
  repos,
  activeRepo,
  filters,
  activeFilter,
  onRepoChange,
  onFilterChange,
  onAddRepo,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">gt</span>
        <div>
          <strong>Inbox</strong>
          <small>GitTrack</small>
        </div>
      </div>

      <section className="sidebar-section">
        <div className="section-heading">
          <span>Synced repos</span>
          <button className="tiny-button" onClick={onAddRepo} title="Add repository">
            <Plus size={14} />
            <span>Add</span>
          </button>
        </div>

        <div className="repo-list">
          {repos.map((repo) => (
            <button
              key={repo.slug}
              className={`repo-row ${repo.slug === activeRepo ? "active" : ""}`}
              onClick={() => onRepoChange(repo.slug)}
            >
              <GitBranch size={16} />
              <span>{repo.slug}</span>
              <b>{repo.openPrs}</b>
            </button>
          ))}
        </div>
      </section>

      <section className="sidebar-section grow">
        <div className="section-heading">
          <span>Pull request inbox</span>
          <button className="icon-mini" title="New section" aria-label="New section">
            <Plus size={14} />
          </button>
        </div>

        <div className="filter-list">
          {filters.map((filter) => (
            <button
              key={filter.id}
              className={`filter-row filter-${filter.id} ${filter.id === activeFilter ? "active" : ""}`}
              onClick={() => onFilterChange(filter.id)}
            >
              {filterIcon(filter.id)}
              <span>{filter.label}</span>
              <b>{filter.count}</b>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}

function filterIcon(id: FilterId) {
  if (id === "all") return <ListFilter size={16} />;
  if (id === "waiting") return <Clock3 size={16} />;
  if (id === "needs-review") return <Inbox size={16} />;
  if (id === "drafts") return <CircleDot size={16} />;
  if (id === "changes") return <AlertCircle size={16} />;
  if (id === "approved") return <CheckCircle2 size={16} />;
  if (id === "codex") return <Eye size={16} />;
  if (id === "high-risk") return <ShieldAlert size={16} />;
  return <GitPullRequest size={16} />;
}
