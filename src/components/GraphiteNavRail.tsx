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

interface GraphiteNavRailProps {
  activeItem: GraphiteNavItemId;
  counts: Record<GraphiteNavItemId, number>;
  notificationCount: number;
  onNavigate: (item: GraphiteNavItemId) => void;
  onOpenCommandPalette: () => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
}

export type GraphiteNavItemId = "inbox" | "stacks" | "pull_requests" | "branches" | "reviews" | "automation";

const navItems: Array<{ id: GraphiteNavItemId; label: string; icon: LucideIcon }> = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "stacks", label: "Stacks", icon: Layers3 },
  { id: "pull_requests", label: "Pull requests", icon: GitPullRequest },
  { id: "branches", label: "Branches", icon: GitBranch },
  { id: "reviews", label: "Reviews", icon: CircleDot },
  { id: "automation", label: "Automation", icon: Sparkles },
];

export function GraphiteNavRail({
  activeItem,
  counts,
  notificationCount,
  onNavigate,
  onOpenCommandPalette,
  onOpenNotifications,
  onOpenSettings,
}: GraphiteNavRailProps) {
  return (
    <nav className="graphite-nav-rail" aria-label="Primary navigation">
      <span className="graphite-nav-logo" aria-label="GitTrack">
        gt
      </span>

      <div className="graphite-nav-stack">
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
              data-testid={`graphite-nav-${id}`}
            >
              <Icon size={16} />
              {count > 0 && <span className="graphite-nav-badge">{count > 9 ? "9+" : count}</span>}
            </button>
          );
        })}
      </div>

      <div className="graphite-nav-stack graphite-nav-bottom">
        <button type="button" onClick={onOpenCommandPalette} title="Search" aria-label="Search">
          <Search size={16} />
        </button>
        <button type="button" onClick={onOpenNotifications} title={`Notifications${notificationCount ? ` (${notificationCount})` : ""}`} aria-label="Notifications" data-testid="graphite-nav-notifications">
          <Bell size={16} />
          {notificationCount > 0 && <span className="graphite-nav-badge badge-urgent">{notificationCount > 9 ? "9+" : notificationCount}</span>}
        </button>
        <button type="button" onClick={onOpenSettings} title="Settings" aria-label="Settings">
          <Settings size={16} />
        </button>
        <span className="graphite-nav-avatar" aria-label="Mohammed">
          M
        </span>
      </div>
    </nav>
  );
}
