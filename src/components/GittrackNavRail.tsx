import {
  Bell,
  CircleDot,
  GitBranch,
  GitPullRequest,
  Inbox,
  Layers3,
  type LucideIcon,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";

interface GittrackNavRailProps {
  activeItem: GittrackNavItemId;
  counts: Record<GittrackNavItemId, number>;
  notificationCount: number;
  onNavigate: (item: GittrackNavItemId) => void;
  onOpenCommandPalette: () => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
}

export type GittrackNavItemId = "inbox" | "stacks" | "pull_requests" | "branches" | "reviews" | "automation";

const navItems: Array<{ id: GittrackNavItemId; label: string; icon: LucideIcon }> = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "stacks", label: "Stacks", icon: Layers3 },
  { id: "pull_requests", label: "Pull requests", icon: GitPullRequest },
  { id: "branches", label: "Branches", icon: GitBranch },
  { id: "reviews", label: "Reviews", icon: CircleDot },
  { id: "automation", label: "Automation", icon: Sparkles },
];

export function GittrackNavRail({
  activeItem,
  counts,
  notificationCount,
  onNavigate,
  onOpenCommandPalette,
  onOpenNotifications,
  onOpenSettings,
}: GittrackNavRailProps) {
  return (
    <nav className="gittrack-nav-rail" aria-label="Primary navigation">
      <span className="gittrack-nav-logo" aria-label="GitTrack">
        gt
      </span>

      <div className="gittrack-nav-stack">
        {navItems.map(({ id, label, icon: Icon }) => {
          const count = counts[id] ?? 0;
          const active = activeItem === id;

          return (
            <button
              type="button"
              key={label}
              className={active ? "active" : ""}
              title={`${label}${count ? ` (${count})` : ""}`}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              onClick={() => onNavigate(id)}
              data-testid={`gittrack-nav-${id}`}
            >
              <Icon size={16} />
              {count > 0 && <span className="gittrack-nav-badge">{count > 9 ? "9+" : count}</span>}
            </button>
          );
        })}
      </div>

      <div className="gittrack-nav-stack gittrack-nav-bottom">
        <button type="button" onClick={onOpenCommandPalette} title="Search" aria-label="Search">
          <Search size={16} />
        </button>
        <button type="button" onClick={onOpenNotifications} title={`Notifications${notificationCount ? ` (${notificationCount})` : ""}`} aria-label="Notifications" data-testid="gittrack-nav-notifications">
          <Bell size={16} />
          {notificationCount > 0 && <span className="gittrack-nav-badge badge-urgent">{notificationCount > 9 ? "9+" : notificationCount}</span>}
        </button>
        <button type="button" onClick={onOpenSettings} title="Settings" aria-label="Settings">
          <Settings size={16} />
        </button>
        <span className="gittrack-nav-avatar" aria-label="Mohammed">
          M
        </span>
      </div>
    </nav>
  );
}
