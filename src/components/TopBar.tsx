import { Github, RefreshCw, Search, Settings, SlidersHorizontal } from "lucide-react";

interface TopBarProps {
  connected: boolean;
  repoCount: number;
  query: string;
  loading: boolean;
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
  onRepoScope: () => void;
  onSettings: () => void;
}

export function TopBar({
  connected,
  repoCount,
  query,
  loading,
  onQueryChange,
  onRefresh,
  onRepoScope,
  onSettings,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="connection">
        <Github size={22} />
        <span>GitHub</span>
        <span className={`dot ${connected ? "dot-connected" : "dot-idle"}`} />
        <span className={connected ? "connected" : "muted"}>
          {connected ? "Connected" : "Sample data"}
        </span>
      </div>

      <label className="searchbox">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search pull requests, branches, authors..."
        />
        <kbd>⌘K</kbd>
      </label>

      <button className="control-button" onClick={onRefresh} disabled={loading} title="Refresh">
        <RefreshCw size={17} className={loading ? "spin" : ""} />
        <span>Refresh</span>
      </button>

      <button className="repo-scope" onClick={onRepoScope} title="Repository scope" data-testid="topbar-repo-scope">
        <SlidersHorizontal size={16} />
        <span>{repoCount === 1 ? "1 synced repo" : `${repoCount} synced repos`}</span>
      </button>

      <button className="icon-button" onClick={onSettings} title="Settings" aria-label="Settings">
        <Settings size={20} />
      </button>
    </header>
  );
}
