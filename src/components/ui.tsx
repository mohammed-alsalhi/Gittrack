import {
  AlertCircle,
  Check,
  CheckCircle2,
  Circle,
  Eye,
  GitBranch,
  GitPullRequest,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import {
  BranchHealth,
  CheckState,
  CodexReaction,
  PullRequestState,
  ReviewPerson,
} from "../types";

export function formatRelativeTime(value?: string) {
  if (!value) return "Never";

  const then = new Date(value).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function StatusPill({ state }: { state: PullRequestState }) {
  const label = stateLabels[state];
  return <span className={`pill pill-${state}`}>{label}</span>;
}

export function BranchStatus({ branch }: { branch: BranchHealth }) {
  const icon = branch === "healthy" ? <CheckCircle2 size={14} /> : <GitBranch size={14} />;
  return (
    <span className={`branch-status branch-${branch}`}>
      {icon}
      {branchLabels[branch]}
    </span>
  );
}

export function CiBadge({ state }: { state: CheckState }) {
  const icon =
    state === "success" ? (
      <CheckCircle2 size={16} />
    ) : state === "failure" ? (
      <XCircle size={16} />
    ) : state === "pending" ? (
      <Circle size={16} />
    ) : (
      <AlertCircle size={16} />
    );

  return (
    <span className={`ci ci-${state}`} title={`CI ${state}`}>
      {icon}
    </span>
  );
}

export function CodexBadge({
  reaction,
  compact = false,
}: {
  reaction: CodexReaction;
  compact?: boolean;
}) {
  const Icon =
    reaction === "eyes" ? Eye : reaction === "thumbs_up" || reaction === "changed" ? ThumbsUp : GitPullRequest;
  const text = codexReactionLabels[reaction];

  return (
    <span className={`codex-badge codex-${reaction}`} title={text}>
      <Icon size={compact ? 14 : 16} />
      {!compact && <span>{text}</span>}
    </span>
  );
}

export function AvatarStack({ people }: { people: ReviewPerson[] }) {
  if (!people.length) return <span className="muted">-</span>;

  return (
    <span className="avatar-stack" aria-label={`${people.length} reviewers`}>
      {people.slice(0, 3).map((person) =>
        person.avatarUrl ? (
          <img key={person.login} src={person.avatarUrl} alt={person.login} />
        ) : (
          <span key={person.login} className={person.isCodex ? "avatar avatar-bot" : "avatar"}>
            {person.isCodex ? <GitPullRequest size={12} /> : initials(person.login)}
          </span>
        ),
      )}
      {people.length > 3 && <span className="avatar more">+{people.length - 3}</span>}
    </span>
  );
}

export function MiniCheck() {
  return (
    <span className="mini-check">
      <Check size={11} />
    </span>
  );
}

function initials(login: string) {
  return login
    .split(/[-_\s]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

const stateLabels: Record<PullRequestState, string> = {
  draft: "Draft",
  waiting_review: "Waiting review",
  changes_requested: "Changes requested",
  approved: "Approved",
  merged: "Merged",
  open: "Open",
};

const branchLabels: Record<BranchHealth, string> = {
  healthy: "Healthy",
  ahead: "Ahead",
  behind: "Behind",
  diverged: "Diverged",
  stale: "Stale",
};

const codexReactionLabels: Record<CodexReaction, string> = {
  none: "No Codex",
  eyes: "Eyes",
  thumbs_up: "Thumbs up",
  changed: "Eyes to thumbs up",
};
