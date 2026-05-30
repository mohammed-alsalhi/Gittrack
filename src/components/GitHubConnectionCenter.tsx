import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Database,
  Github,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import type {
  BranchSummary,
  ConnectionCheckMemoryById,
  ConnectionCheckStatus,
  PullRequestSummary,
  RepoSummary,
  TrackerConfig,
} from "../types";
import { formatRelativeTime } from "./ui";

interface GitHubConnectionCenterProps {
  config: TrackerConfig;
  source: "sample" | "github";
  loading: boolean;
  error?: string | null;
  repos: RepoSummary[];
  pullRequests: PullRequestSummary[];
  branches: BranchSummary[];
  checkMemory: ConnectionCheckMemoryById;
  lastDiagnosticAt?: string;
  onOpenSettings: () => void;
  onRefresh: () => void;
  onUseSampleData: () => void;
  onRunDiagnostic: () => void;
  onCopySetupBrief: (text: string) => void;
  onUpdateCheckStatus: (id: string, status: ConnectionCheckStatus) => void;
}

type ConnectionTone = "green" | "amber" | "red" | "blue";

interface ConnectionCheck {
  id: string;
  label: string;
  detail: string;
  ready: boolean;
  tone: ConnectionTone;
}

export function GitHubConnectionCenter({
  config,
  source,
  loading,
  error,
  repos,
  pullRequests,
  branches,
  checkMemory,
  lastDiagnosticAt,
  onOpenSettings,
  onRefresh,
  onUseSampleData,
  onRunDiagnostic,
  onCopySetupBrief,
  onUpdateCheckStatus,
}: GitHubConnectionCenterProps) {
  const checks = buildConnectionChecks(config, source, repos, pullRequests, branches, error);
  const verified = checks.filter((check) => check.ready || checkMemory[check.id]?.status === "verified").length;
  const needsWork = checks.filter((check) => !check.ready && checkMemory[check.id]?.status !== "verified").length;
  const codexCoverage = pullRequests.length
    ? Math.round((pullRequests.filter((pr) => pr.codex.exists).length / pullRequests.length) * 100)
    : 0;
  const connectionState = error ? "Action needed" : source === "github" ? "Live GitHub sync" : "Sample workspace";
  const setupBrief = formatConnectionBrief({
    config,
    source,
    repos,
    pullRequests,
    branches,
    checks,
    error,
  });

  return (
    <section className="github-connection-center" id="github-connection-center" data-testid="github-connection-center">
      <div className="connection-center-head">
        <div>
          <span>Connection cockpit</span>
          <h2>{connectionState}</h2>
          <p>
            {source === "github"
              ? `${repos.length} live repos, ${pullRequests.length} tracked PRs, ${branches.length} branches loaded.`
              : "Connect GitHub when you want this cockpit to use your real branches, PRs, Codex reviews, and checks."}
          </p>
        </div>

        <div className="connection-actions">
          <button type="button" onClick={() => onCopySetupBrief(setupBrief)} data-testid="connection-copy-brief">
            <Clipboard size={14} />
            Copy setup brief
          </button>
          <button type="button" className="connection-primary" onClick={source === "github" ? onRefresh : onOpenSettings} disabled={loading}>
            {loading ? <RefreshCw size={14} className="spin" /> : source === "github" ? <RefreshCw size={14} /> : <Github size={14} />}
            {source === "github" ? "Refresh sync" : "Connect GitHub"}
          </button>
        </div>
      </div>

      <div className="connection-metrics" aria-label="Connection metrics">
        <ConnectionMetric icon={<Github size={15} />} label="Source" value={source === "github" ? "Live" : "Sample"} detail={loading ? "syncing" : "ready"} tone={source === "github" ? "green" : "amber"} />
        <ConnectionMetric icon={<SlidersHorizontal size={15} />} label="Repo scope" value={String(config.repoSlugs.length || repos.length)} detail={`${repos.length} loaded`} tone={repos.length ? "green" : "red"} />
        <ConnectionMetric icon={<Sparkles size={15} />} label="AI coverage" value={`${codexCoverage}%`} detail={`${pullRequests.filter((pr) => pr.codex.exists).length}/${Math.max(1, pullRequests.length)} PRs`} tone={codexCoverage > 60 ? "green" : codexCoverage ? "amber" : "red"} />
        <ConnectionMetric icon={<ShieldCheck size={15} />} label="Readiness" value={`${verified}/${checks.length}`} detail={needsWork ? `${needsWork} open` : "verified"} tone={needsWork ? "amber" : "green"} />
      </div>

      <div className="connection-body">
        <div className="connection-checklist">
          <div className="connection-section-title">
            <Database size={15} />
            <strong>Live data gates</strong>
            <span>{lastDiagnosticAt ? `checked ${formatRelativeTime(lastDiagnosticAt)}` : "not checked"}</span>
          </div>

          <div className="connection-check-list">
            {checks.map((check) => {
              const status = checkMemory[check.id]?.status ?? "open";
              const resolved = check.ready || status === "verified";

              return (
                <article className={`connection-check check-${check.tone} ${resolved ? "resolved" : ""}`} key={check.id}>
                  <span className="connection-check-icon">
                    {resolved ? <CheckCircle2 size={16} /> : check.tone === "red" ? <AlertTriangle size={16} /> : <KeyRound size={16} />}
                  </span>
                  <div>
                    <strong>{check.label}</strong>
                    <small>{check.detail}</small>
                  </div>
                  <em>{resolved ? "verified" : status}</em>
                  <button
                    type="button"
                    onClick={() => onUpdateCheckStatus(check.id, resolved ? "open" : "verified")}
                    data-testid={resolved ? "connection-check-reopen" : "connection-check-verify"}
                  >
                    {resolved ? "Reopen" : "Verify"}
                  </button>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="connection-runbook">
          <div className="connection-section-title">
            <ShieldCheck size={15} />
            <strong>Setup runbook</strong>
          </div>

          <ol>
            <li>
              <strong>Add repository slugs</strong>
              <span>Use one `owner/repo` per line for the repos you actually review.</span>
            </li>
            <li>
              <strong>Add a fine-grained token</strong>
              <span>Needs read access to metadata, pull requests, issues, contents, and commit statuses.</span>
            </li>
            <li>
              <strong>Refresh and verify</strong>
              <span>Confirm branches, PRs, checks, and Codex review reactions show up.</span>
            </li>
          </ol>

          <div className="connection-runbook-actions">
            <button type="button" onClick={onRunDiagnostic} data-testid="connection-run-diagnostic">
              <ShieldCheck size={14} />
              Run diagnostic
            </button>
            <button type="button" onClick={onOpenSettings}>
              <Github size={14} />
              Open settings
            </button>
            <button type="button" onClick={onUseSampleData}>
              <Database size={14} />
              Sample mode
            </button>
          </div>

          {error && (
            <div className="connection-error">
              <AlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function ConnectionMetric({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: ConnectionTone;
}) {
  return (
    <div className={`connection-metric metric-${tone}`}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function buildConnectionChecks(
  config: TrackerConfig,
  source: "sample" | "github",
  repos: RepoSummary[],
  pullRequests: PullRequestSummary[],
  branches: BranchSummary[],
  error?: string | null,
): ConnectionCheck[] {
  return [
    {
      id: "repo-scope",
      label: "Repository scope configured",
      detail: config.repoSlugs.length
        ? `${config.repoSlugs.length} configured slugs`
        : `${repos.length} sample repos loaded; add your real owner/repo slugs.`,
      ready: config.repoSlugs.length > 0,
      tone: config.repoSlugs.length ? "green" : "amber",
    },
    {
      id: "token",
      label: "GitHub token available",
      detail: config.token ? "Token saved locally for GitHub API reads." : "Add a fine-grained token to refresh real private repos.",
      ready: Boolean(config.token),
      tone: config.token ? "green" : "amber",
    },
    {
      id: "api-sync",
      label: "GitHub API sync healthy",
      detail: error ? error : source === "github" ? "Latest refresh completed without an API error." : "Currently running with sample data.",
      ready: source === "github" && !error,
      tone: error ? "red" : source === "github" ? "green" : "amber",
    },
    {
      id: "pulls",
      label: "Pull request inventory loaded",
      detail: pullRequests.length ? `${pullRequests.length} pull requests tracked.` : "No PRs loaded yet.",
      ready: pullRequests.length > 0,
      tone: pullRequests.length ? "green" : "red",
    },
    {
      id: "branches",
      label: "Branch graph loaded",
      detail: branches.length ? `${branches.length} branches tracked for drift.` : "No branches loaded yet.",
      ready: branches.length > 0,
      tone: branches.length ? "green" : "red",
    },
    {
      id: "codex",
      label: "Codex review signals visible",
      detail: pullRequests.some((pr) => pr.codex.exists)
        ? `${pullRequests.filter((pr) => pr.codex.exists).length} PRs include Codex signals.`
        : "No Codex reactions found yet.",
      ready: pullRequests.some((pr) => pr.codex.exists),
      tone: pullRequests.some((pr) => pr.codex.exists) ? "green" : "amber",
    },
  ];
}

function formatConnectionBrief({
  config,
  source,
  repos,
  pullRequests,
  branches,
  checks,
  error,
}: {
  config: TrackerConfig;
  source: "sample" | "github";
  repos: RepoSummary[];
  pullRequests: PullRequestSummary[];
  branches: BranchSummary[];
  checks: ConnectionCheck[];
  error?: string | null;
}) {
  return [
    "GitTrack connection brief",
    `Source: ${source}`,
    `Configured repos: ${config.repoSlugs.length ? config.repoSlugs.join(", ") : "none"}`,
    `Loaded: ${repos.length} repos, ${pullRequests.length} PRs, ${branches.length} branches`,
    error ? `Latest error: ${error}` : "Latest error: none",
    "",
    "Checks:",
    ...checks.map((check) => `- ${check.ready ? "[x]" : "[ ]"} ${check.label}: ${check.detail}`),
    "",
    "Required token access: metadata, contents, pull requests, issues, and commit statuses.",
  ].join("\n");
}
