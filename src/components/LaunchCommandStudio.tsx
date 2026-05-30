import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  Code2,
  Copy,
  ExternalLink,
  GitMerge,
  GitPullRequest,
  MessageSquareText,
  Play,
  ShieldAlert,
  Sparkles,
  Terminal,
} from "lucide-react";
import type {
  LaunchCommandMemoryById,
  LaunchCommandStatus,
  PullRequestSummary,
  ReviewMemory,
} from "../types";
import { getPrIntelligence } from "../lib/insights";
import { CiBadge, formatRelativeTime, StatusPill } from "./ui";

interface LaunchCommandStudioProps {
  pullRequest?: PullRequestSummary;
  memory?: ReviewMemory;
  commandMemory: LaunchCommandMemoryById;
  onCopyText: (text: string, label: string) => void;
  onUpdateCommandStatus: (id: string, status: LaunchCommandStatus) => void;
  onSmartMerge: (id: string) => void;
  onPromoteCodex: (id: string) => void;
}

type LaunchMode = "review" | "ship" | "fix";
type CommandTone = "blue" | "green" | "amber" | "red";

interface LaunchCommand {
  id: string;
  title: string;
  detail: string;
  command: string;
  tone: CommandTone;
}

interface LaunchPlan {
  mode: LaunchMode;
  headline: string;
  summary: string;
  readinessLabel: string;
  commands: LaunchCommand[];
  reviewDraft: string;
  guardrails: Array<{ label: string; ready: boolean; detail: string }>;
}

const modeLabels: Record<LaunchMode, string> = {
  review: "Review",
  ship: "Ship",
  fix: "Fix",
};

export function LaunchCommandStudio({
  pullRequest,
  memory,
  commandMemory,
  onCopyText,
  onUpdateCommandStatus,
  onSmartMerge,
  onPromoteCodex,
}: LaunchCommandStudioProps) {
  const [mode, setMode] = useState<LaunchMode>("review");
  const plan = useMemo(() => (pullRequest ? buildLaunchPlan(pullRequest, memory, mode) : undefined), [memory, mode, pullRequest]);

  if (!pullRequest || !plan) {
    return (
      <section className="launch-command-studio empty" id="launch-command-studio" data-testid="launch-command-studio">
        <Terminal size={18} />
        <strong>Select a pull request to generate launch commands.</strong>
      </section>
    );
  }

  const completed = plan.commands.filter((command) => commandMemory[command.id]?.status === "done").length;

  const copyCommand = (command: LaunchCommand) => {
    onUpdateCommandStatus(command.id, "copied");
    onCopyText(command.command, command.title);
  };

  const copyPlan = () => {
    plan.commands.forEach((command) => {
      if (commandMemory[command.id]?.status !== "done") {
        onUpdateCommandStatus(command.id, "copied");
      }
    });
    onCopyText(formatLaunchPlan(plan), `${modeLabels[mode]} launch plan`);
  };

  return (
    <section className="launch-command-studio" id="launch-command-studio" data-testid="launch-command-studio">
      <div className="launch-head">
        <div>
          <span>Launch studio</span>
          <h2>{plan.headline}</h2>
          <p>{plan.summary}</p>
        </div>
        <div className="launch-mode-switch" role="tablist" aria-label="Launch mode">
          {(["review", "ship", "fix"] as const).map((item) => (
            <button
              type="button"
              key={item}
              className={mode === item ? "active" : ""}
              onClick={() => setMode(item)}
              role="tab"
              aria-selected={mode === item}
              data-testid={`launch-mode-${item}`}
            >
              {modeLabels[item]}
            </button>
          ))}
        </div>
      </div>

      <div className="launch-status-strip">
        <div>
          <GitPullRequest size={15} />
          <span>Selected</span>
          <strong>#{pullRequest.number}</strong>
        </div>
        <div>
          <StatusPill state={pullRequest.state} />
          <span>State</span>
          <strong>{pullRequest.state.replace("_", " ")}</strong>
        </div>
        <div>
          <CiBadge state={pullRequest.ci} />
          <span>Checks</span>
          <strong>{pullRequest.ciSummary}</strong>
        </div>
        <div>
          <CheckCircle2 size={15} />
          <span>Progress</span>
          <strong>{completed}/{plan.commands.length} done</strong>
        </div>
      </div>

      <div className="launch-body">
        <div className="launch-command-rail">
          <div className="launch-section-title">
            <Terminal size={15} />
            <strong>{modeLabels[mode]} sequence</strong>
            <button type="button" onClick={copyPlan}>
              <Clipboard size={13} />
              Copy sequence
            </button>
          </div>

          <div className="launch-command-list">
            {plan.commands.map((command, index) => {
              const status = commandMemory[command.id]?.status ?? "open";

              return (
                <article className={`launch-command command-${command.tone}`} key={command.id}>
                  <div className="launch-command-top">
                    <span>{index + 1}</span>
                    <div>
                      <strong>{command.title}</strong>
                      <small>{command.detail}</small>
                    </div>
                    <em className={`launch-status status-${status}`}>{status}</em>
                  </div>
                  <code>{command.command}</code>
                  <div className="launch-command-actions">
                    <button type="button" onClick={() => copyCommand(command)} data-testid="launch-copy-command">
                      <Copy size={13} />
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateCommandStatus(command.id, status === "done" ? "open" : "done")}
                      data-testid={status === "done" ? "launch-command-reopen" : "launch-command-done"}
                    >
                      <CheckCircle2 size={13} />
                      {status === "done" ? "Reopen" : "Done"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="launch-review-draft">
          <div className="launch-section-title">
            <MessageSquareText size={15} />
            <strong>Ready-to-send draft</strong>
          </div>
          <div className="launch-draft-card">
            <p>{plan.reviewDraft}</p>
            <button type="button" onClick={() => onCopyText(plan.reviewDraft, "review draft")} data-testid="launch-copy-draft">
              <Copy size={13} />
              Copy draft
            </button>
          </div>

          <div className="launch-guardrails">
            <div className="launch-section-title">
              <ShieldAlert size={15} />
              <strong>Guardrails</strong>
              <span>{plan.readinessLabel}</span>
            </div>
            {plan.guardrails.map((guardrail) => (
              <div className={guardrail.ready ? "guardrail-row ready" : "guardrail-row blocked"} key={guardrail.label}>
                {guardrail.ready ? <CheckCircle2 size={14} /> : <ShieldAlert size={14} />}
                <span>
                  <strong>{guardrail.label}</strong>
                  <small>{guardrail.detail}</small>
                </span>
              </div>
            ))}
          </div>

          <div className="launch-live-actions">
            <button type="button" onClick={() => onPromoteCodex(pullRequest.id)}>
              <Sparkles size={14} />
              Promote Codex
            </button>
            <button type="button" onClick={() => onSmartMerge(pullRequest.id)}>
              <GitMerge size={14} />
              Smart merge
            </button>
            {pullRequest.url && (
              <a href={pullRequest.url} target="_blank" rel="noreferrer">
                <ExternalLink size={14} />
                GitHub
              </a>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function buildLaunchPlan(
  pullRequest: PullRequestSummary,
  memory: ReviewMemory | undefined,
  mode: LaunchMode,
): LaunchPlan {
  const intel = getPrIntelligence(pullRequest);
  const slug = shellQuote(pullRequest.repo);
  const branch = shellQuote(pullRequest.branch);
  const number = pullRequest.number;
  const baseCommandId = `${pullRequest.id}:${mode}`;
  const testCommand = pickTestCommand(pullRequest);
  const blockers = getLaunchBlockers(pullRequest, memory);
  const canShip = blockers.length === 0 && !pullRequest.isDraft && pullRequest.ci === "success";
  const commonFirst: LaunchCommand = {
    id: `${baseCommandId}:checkout`,
    title: "Checkout exact PR",
    detail: `Fetches #${number} locally without guessing branch names.`,
    command: `gh pr checkout ${number} --repo ${slug}`,
    tone: "blue",
  };
  const commonContext: LaunchCommand = {
    id: `${baseCommandId}:context`,
    title: "Open changed files",
    detail: `${intel.files.length} files, +${intel.additions}/-${intel.deletions}.`,
    command: `gh pr diff ${number} --repo ${slug} --name-only`,
    tone: "blue",
  };

  if (mode === "ship") {
    return {
      mode,
      headline: `Ship #${number} with a guarded merge path`,
      summary: `${pullRequest.title} has ${intel.readiness}/${intel.readinessTotal} readiness and ${pullRequest.ciSummary.toLowerCase()}.`,
      readinessLabel: canShip ? "ship-ready" : "hold",
      commands: [
        commonFirst,
        {
          id: `${baseCommandId}:verify`,
          title: "Verify release gates",
          detail: "Runs local build before queueing merge.",
          command: testCommand,
          tone: canShip ? "green" : "amber",
        },
        {
          id: `${baseCommandId}:approve`,
          title: "Approve with context",
          detail: "Sends a concise review approval.",
          command: `gh pr review ${number} --repo ${slug} --approve --body ${shellQuote(buildApprovalDraft(pullRequest, intel))}`,
          tone: "green",
        },
        {
          id: `${baseCommandId}:merge`,
          title: "Queue auto-merge",
          detail: "Uses squash merge and waits for required checks.",
          command: `gh pr merge ${number} --repo ${slug} --squash --auto`,
          tone: canShip ? "green" : "amber",
        },
      ],
      reviewDraft: buildApprovalDraft(pullRequest, intel),
      guardrails: buildGuardrails(pullRequest, memory),
    };
  }

  if (mode === "fix") {
    return {
      mode,
      headline: `Repair path for #${number}`,
      summary: blockers.length ? blockers.join(" · ") : "No hard blockers detected; use this path for a defensive re-check.",
      readinessLabel: blockers.length ? `${blockers.length} blockers` : "clear",
      commands: [
        commonFirst,
        {
          id: `${baseCommandId}:sync`,
          title: "Sync with base",
          detail: `Brings ${pullRequest.branch} close to ${pullRequest.base}.`,
          command: `git fetch origin ${shellQuote(pullRequest.base)} && git rebase origin/${shellQuote(pullRequest.base)}`,
          tone: "amber",
        },
        {
          id: `${baseCommandId}:test`,
          title: "Run focused verification",
          detail: "Checks the likely failure surface.",
          command: testCommand,
          tone: pullRequest.ci === "failure" ? "red" : "amber",
        },
        {
          id: `${baseCommandId}:push`,
          title: "Publish repaired branch",
          detail: "Updates the PR branch after fixes are applied.",
          command: `git push --force-with-lease origin ${branch}`,
          tone: "blue",
        },
      ],
      reviewDraft: buildFixDraft(pullRequest, intel, blockers),
      guardrails: buildGuardrails(pullRequest, memory),
    };
  }

  return {
    mode,
    headline: `Review #${number} without losing context`,
    summary: `${pullRequest.title} touches ${intel.files.slice(0, 2).join(", ")} and was updated ${formatRelativeTime(pullRequest.updatedAt)}.`,
    readinessLabel: `${intel.risk} risk`,
    commands: [
      commonFirst,
      commonContext,
      {
        id: `${baseCommandId}:watch`,
        title: "Watch live checks",
        detail: "Keeps CI and review state visible while you inspect.",
        command: `gh pr checks ${number} --repo ${slug} --watch`,
        tone: pullRequest.ci === "failure" ? "red" : pullRequest.ci === "pending" ? "amber" : "green",
      },
      {
        id: `${baseCommandId}:comment`,
        title: "Post review note",
        detail: "Copies the generated review summary into GitHub.",
        command: `gh pr review ${number} --repo ${slug} --comment --body ${shellQuote(buildReviewDraft(pullRequest, intel))}`,
        tone: "blue",
      },
    ],
    reviewDraft: buildReviewDraft(pullRequest, intel),
    guardrails: buildGuardrails(pullRequest, memory),
  };
}

function buildGuardrails(pullRequest: PullRequestSummary, memory?: ReviewMemory) {
  const intel = getPrIntelligence(pullRequest);

  return [
    {
      label: "CI green",
      ready: pullRequest.ci === "success",
      detail: pullRequest.ciSummary,
    },
    {
      label: "Review state",
      ready: pullRequest.state === "approved" || pullRequest.reviewers.length > 0,
      detail: pullRequest.state.replace("_", " "),
    },
    {
      label: "Codex signal",
      ready: pullRequest.codex.exists,
      detail: pullRequest.codex.statusText,
    },
    {
      label: "Your decision",
      ready: memory?.decision === "ready",
      detail: memory?.decision ?? "watch",
    },
    {
      label: "Risk budget",
      ready: intel.risk !== "high",
      detail: intel.risk,
    },
  ];
}

function getLaunchBlockers(pullRequest: PullRequestSummary, memory?: ReviewMemory) {
  const intel = getPrIntelligence(pullRequest);

  return [
    pullRequest.isDraft ? "draft PR" : "",
    pullRequest.ci !== "success" ? pullRequest.ciSummary : "",
    pullRequest.state === "changes_requested" ? "changes requested" : "",
    !pullRequest.codex.exists ? "Codex signal missing" : "",
    memory?.decision === "blocked" ? "marked blocked by you" : "",
    intel.risk === "high" ? "high-risk change" : "",
  ].filter(Boolean);
}

function buildReviewDraft(pullRequest: PullRequestSummary, intel: ReturnType<typeof getPrIntelligence>) {
  return [
    `Reviewed #${pullRequest.number}: ${pullRequest.title}.`,
    `Focus areas: ${intel.files.slice(0, 3).join(", ")}.`,
    `Current state: ${pullRequest.ciSummary}; Codex signal: ${pullRequest.codex.statusText}.`,
  ].join(" ");
}

function buildApprovalDraft(pullRequest: PullRequestSummary, intel: ReturnType<typeof getPrIntelligence>) {
  return [
    `Looks ready from my pass. Readiness is ${intel.readiness}/${intel.readinessTotal}.`,
    `Verified ${pullRequest.ciSummary.toLowerCase()}, ${pullRequest.codex.statusText.toLowerCase()}, and the main changed files: ${intel.files.slice(0, 2).join(", ")}.`,
  ].join(" ");
}

function buildFixDraft(
  pullRequest: PullRequestSummary,
  intel: ReturnType<typeof getPrIntelligence>,
  blockers: string[],
) {
  return [
    `Holding #${pullRequest.number} for fixes.`,
    blockers.length ? `Blockers: ${blockers.join("; ")}.` : `No hard blocker found, but this is a defensive repair pass.`,
    `Suggested focus: ${intel.files.slice(0, 3).join(", ")}.`,
  ].join(" ");
}

function pickTestCommand(pullRequest: PullRequestSummary) {
  if (pullRequest.files?.some((file) => file.includes("package") || file.endsWith(".ts") || file.endsWith(".tsx"))) {
    return "npm run build";
  }

  return "npm test";
}

function formatLaunchPlan(plan: LaunchPlan) {
  return [
    `${modeLabels[plan.mode]} launch plan`,
    plan.headline,
    plan.summary,
    "",
    ...plan.commands.map((command, index) => `${index + 1}. ${command.title}\n${command.command}`),
    "",
    `Draft: ${plan.reviewDraft}`,
  ].join("\n");
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
