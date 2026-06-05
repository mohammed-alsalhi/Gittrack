import { FormEvent, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  CheckCheck,
  ClipboardCheck,
  Clock3,
  Copy,
  FileCode2,
  ExternalLink,
  Eye,
  GitBranch,
  Github,
  GitMerge,
  MessageSquareText,
  MoreHorizontal,
  BellOff,
  Pin,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  Zap,
  X,
} from "lucide-react";
import { PrIntelligence, getPrIntelligence } from "../lib/insights";
import {
  PullRequestSummary,
  ReviewChecklistKey,
  ReviewEvent,
  ReviewMemory,
  ReviewMemoryPatch,
} from "../types";
import { CiBadge, CodexBadge, formatRelativeTime, MiniCheck, StatusPill } from "./ui";

interface InspectorProps {
  pullRequest?: PullRequestSummary;
  memory?: ReviewMemory;
  onUpdateMemory: (patch: ReviewMemoryPatch) => void;
  onPromoteCodex: (id: string) => void;
  onSmartMerge: (id: string) => void;
  actionMessage?: string | null;
}

const fallbackMemory: ReviewMemory = {
  decision: "watch",
  note: "",
  checklist: {
    read_diff: false,
    validated_ci: false,
    checked_codex: false,
    ready_to_merge: false,
  },
  chat: [],
  pinned: false,
  updatedAt: new Date(0).toISOString(),
};

const checklistItems: Array<[ReviewChecklistKey, string]> = [
  ["read_diff", "Read diff"],
  ["validated_ci", "Validated CI"],
  ["checked_codex", "Checked Codex"],
  ["ready_to_merge", "Ready to merge"],
];

type InspectorTab = "overview" | "reviews" | "files" | "commits" | "checks";
type ReadinessItem = readonly [string, boolean];

export function Inspector({
  pullRequest,
  memory = fallbackMemory,
  onUpdateMemory,
  onPromoteCodex,
  onSmartMerge,
  actionMessage,
}: InspectorProps) {
  const [chatPrompt, setChatPrompt] = useState("");
  const [activeTab, setActiveTab] = useState<InspectorTab>("overview");
  const [selectedFile, setSelectedFile] = useState("");

  useEffect(() => {
    setChatPrompt("");
    setActiveTab("overview");
    setSelectedFile("");
  }, [pullRequest?.id]);

  if (!pullRequest) {
    return (
      <aside className="inspector empty">
        <MessageSquareText size={24} />
        <p>Select a pull request</p>
      </aside>
    );
  }

  const intel = getPrIntelligence(pullRequest);
  const checklistComplete = checklistItems.filter(([key]) => memory.checklist[key]).length;
  const snoozedUntil = memory.snoozedUntil ? new Date(memory.snoozedUntil) : undefined;
  const snoozed = Boolean(snoozedUntil && snoozedUntil.getTime() > Date.now());
  const readinessItems = [
    ["CI checks passing", pullRequest.ci === "success"],
    ["One approval", pullRequest.reviewers.length > 0],
    ["No merge conflicts", pullRequest.state !== "changes_requested"],
    ["Up to date with base", intel.risk !== "high"],
    ["Code owners approved", pullRequest.codex.reaction === "thumbs_up" || pullRequest.codex.reaction === "changed"],
    ["No blocked dependencies", !pullRequest.isDraft],
  ] as const;
  const visibleChat = memory.chat.slice(-4);
  const activeFile = selectedFile && intel.files.includes(selectedFile) ? selectedFile : intel.files[0];
  const tabItems: Array<{ id: InspectorTab; label: string; count?: number }> = [
    { id: "overview", label: "Overview" },
    { id: "reviews", label: "Reviews", count: Math.max(pullRequest.reviewEvents.length, pullRequest.codex.events.length) },
    { id: "files", label: "Files", count: intel.files.length },
    { id: "commits", label: "Commits", count: Math.max(3, pullRequest.reviewEvents.length || 0) },
    { id: "checks", label: "Checks", count: readinessItems.length },
  ];

  const submitChat = (prompt: string) => {
    const question = prompt.trim();
    if (!question) return;

    const createdAt = new Date().toISOString();
    const answer = buildReviewAnswer(question, pullRequest, intel, memory);
    onUpdateMemory({
      chat: [
        ...memory.chat,
        {
          id: `user-${pullRequest.id}-${Date.now()}`,
          role: "user",
          body: question,
          createdAt,
        },
        {
          id: `assistant-${pullRequest.id}-${Date.now() + 1}`,
          role: "assistant",
          body: answer,
          createdAt,
        },
      ],
    });
    setChatPrompt("");
  };

  const addAssistantNote = (
    body: string,
    checklist?: Partial<Record<ReviewChecklistKey, boolean>>,
  ) => {
    onUpdateMemory({
      chat: [
        ...memory.chat,
        {
          id: `assistant-${pullRequest.id}-${Date.now()}`,
          role: "assistant",
          body,
          createdAt: new Date().toISOString(),
        },
      ],
      checklist,
    });
  };

  const onChatSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitChat(chatPrompt);
  };

  return (
    <aside className="inspector">
      <div className="inspector-chrome">
        <button className="icon-button small" title="Previous" aria-label="Previous">
          <ArrowLeft size={16} />
        </button>
        <span>Review tray</span>
        <div>
          <button className="icon-button small" title="Next" aria-label="Next">
            <ArrowRight size={16} />
          </button>
          <button className="icon-button small" title="Close" aria-label="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="inspector-title">
        <h1>{pullRequest.title}</h1>
        <div className="title-meta">
          <span>#{pullRequest.number}</span>
          <StatusPill state={pullRequest.state} />
        </div>
        <a className="repo-link" href={pullRequest.url} target="_blank" rel="noreferrer">
          {pullRequest.repo}
        </a>
        <div className="branch-route">
          <span>{pullRequest.branch}</span>
          <ArrowRight size={13} />
          <span>{pullRequest.base}</span>
          <button className="icon-mini" title="Copy branch" aria-label="Copy branch">
            <GitBranch size={13} />
          </button>
        </div>
      </div>

      <div className="inspector-tabs">
        {tabItems.map((tab) => (
          <button
            type="button"
            key={tab.id}
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.count !== undefined && <b>{tab.count}</b>}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <>
          <section className="status-list">
            <div className="merge-readiness-head">
              <h2>Merge readiness</h2>
              <strong>{intel.readiness} / {intel.readinessTotal}</strong>
            </div>
            <div className="readiness-meter">
              <span style={{ width: `${Math.round((intel.readiness / intel.readinessTotal) * 100)}%` }} />
            </div>
            <div className="readiness-grid">
              {readinessItems.map(([label, ready]) => (
                <div className={ready ? "ready" : "not-ready"} key={label}>
                  {ready ? <MiniCheck /> : <Clock3 size={16} />}
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="inspector-intel">
            <div className="intel-card">
              <ShieldCheck size={16} />
              <span>Risk</span>
              <strong className={`risk-text risk-${intel.risk}`}>{intel.risk}</strong>
            </div>
            <div className="intel-card">
              <GitMerge size={16} />
              <span>Queue</span>
              <strong>{intel.queueEstimate}</strong>
            </div>
            <div className="intel-card">
              <Bot size={16} />
              <span>AI review</span>
              <strong>{pullRequest.codex.exists ? pullRequest.codex.statusText : "Not started"}</strong>
            </div>
          </section>

          <section className="ai-review-brief">
            <div className="section-title">
              <h2>AI review brief</h2>
              <span>{intel.risk === "high" ? "needs attention" : "ready to scan"}</span>
            </div>
            <div className="brief-grid">
              <div>
                <ClipboardCheck size={15} />
                <strong>Decision</strong>
                <p>{intel.readiness >= 5 ? "Queue after final approval lands." : "Hold until readiness improves."}</p>
              </div>
              <div>
                <ShieldCheck size={15} />
                <strong>Impact</strong>
                <p>{intel.risk === "high" ? "Touches review flow and has failing checks." : "Contained change with low blast radius."}</p>
              </div>
              <div>
                <CheckCircle2 size={15} />
                <strong>Test focus</strong>
                <p>Verify branch state, Codex signal, and merge readiness copy.</p>
              </div>
            </div>
          </section>

          <section className="review-memory">
            <div className="section-title">
              <h2>Decision cockpit</h2>
              <span>{checklistComplete}/{checklistItems.length} checked</span>
            </div>

            <div className="decision-strip" role="group" aria-label="Review decision">
              {(["watch", "ready", "blocked"] as const).map((decision) => (
                <button
                  type="button"
                  key={decision}
                  className={memory.decision === decision ? "active" : ""}
                  onClick={() => onUpdateMemory({ decision })}
                >
                  {decision}
                </button>
              ))}
            </div>

            <div className="memory-actions">
              <button
                type="button"
                className={memory.pinned ? "active" : ""}
                onClick={() => onUpdateMemory({ pinned: !memory.pinned, snoozedUntil: memory.pinned ? memory.snoozedUntil : undefined })}
              >
                <Pin size={14} />
                {memory.pinned ? "Pinned" : "Pin"}
              </button>
              <button
                type="button"
                className={snoozed ? "active" : ""}
                onClick={() =>
                  onUpdateMemory({
                    pinned: false,
                    snoozedUntil: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
                  })
                }
              >
                <BellOff size={14} />
                {snoozed ? "Snoozed" : "Snooze"}
              </button>
            </div>

            <div className="memory-checklist">
              {checklistItems.map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  className={memory.checklist[key] ? "checked" : ""}
                  onClick={() => onUpdateMemory({ checklist: { [key]: !memory.checklist[key] } })}
                >
                  {memory.checklist[key] ? <MiniCheck /> : <Clock3 size={15} />}
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <label className="memory-note">
              <span>Private review note</span>
              <textarea
                value={memory.note}
                onChange={(event) => onUpdateMemory({ note: event.target.value })}
                placeholder="What did you decide, what is blocked, or what should Future You remember?"
              />
            </label>
          </section>

          <section className="pr-chat-panel">
            <div className="section-title">
              <h2>Review chat</h2>
              <span>{memory.chat.length ? `${memory.chat.length} messages` : `$${intel.risk === "high" ? "0.06" : "0.03"} est.`}</span>
            </div>
            <div className="chat-thread" aria-live="polite">
              {visibleChat.length ? (
                visibleChat.map((message) => (
                  <div className={`chat-message chat-${message.role}`} key={message.id}>
                    <span>{message.role === "assistant" ? "GitTrack" : "You"}</span>
                    <p>{message.body}</p>
                    <time>{formatRelativeTime(message.createdAt)}</time>
                  </div>
                ))
              ) : (
                <div className="chat-empty">
                  <Sparkles size={15} />
                  Ask for blockers, summary, test focus, or merge readiness.
                </div>
              )}
            </div>
            <div className="chat-suggestion-list">
              <button type="button" onClick={() => submitChat("Summarize code changes")}>
                <Sparkles size={14} />
                Summarize code changes
              </button>
              <button type="button" onClick={() => submitChat("Find merge blockers")}>
                <ShieldCheck size={14} />
                Find merge blockers
              </button>
            </div>
            <form className="chat-composer" onSubmit={onChatSubmit}>
              <textarea
                value={chatPrompt}
                onChange={(event) => setChatPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    submitChat(chatPrompt);
                  }
                }}
                aria-label="Ask about this pull request"
                placeholder="Ask about this PR..."
              />
              <button
                type="submit"
                title="Send prompt"
                aria-label="Send prompt"
                disabled={!chatPrompt.trim()}
              >
                <SendHorizontal size={16} />
              </button>
            </form>
          </section>

          <section className="reviewers">
            <div className="section-title">
              <h2>Reviewers ({pullRequest.reviewers.length || 1})</h2>
              <button>Add reviewer</button>
            </div>
            <div className="reviewer-list">
              <div className="reviewer-row">
                <span className="avatar">{pullRequest.author.login[0]?.toUpperCase()}</span>
                <strong>{pullRequest.author.login}</strong>
                <em>Author</em>
              </div>
              {pullRequest.reviewers.map((reviewer) => (
                <div className="reviewer-row" key={reviewer.login}>
                  <span className={reviewer.isCodex ? "avatar avatar-bot" : "avatar"}>
                    {reviewer.isCodex ? <Github size={13} /> : reviewer.login[0]?.toUpperCase()}
                  </span>
                  <strong>{reviewer.login}</strong>
                  <em>{reviewer.isCodex ? "Bot" : reviewer.role ?? "Reviewer"}</em>
                </div>
              ))}
            </div>
          </section>

          <section className="codex-card">
            <div className="codex-card-head">
              <div>
                <h2>Codex Review</h2>
                <CodexBadge reaction={pullRequest.codex.reaction} />
              </div>
              <span>{pullRequest.codex.lastSeenAt ? formatRelativeTime(pullRequest.codex.lastSeenAt) : ""}</span>
            </div>

            {pullRequest.codex.exists ? (
              <div className="codex-timeline">
                {pullRequest.codex.events.map((event) => (
                  <div className="codex-event" key={event.id}>
                    <span className={`timeline-icon timeline-${event.reaction}`}>
                      {event.reaction === "thumbs_up" || event.state === "approved" ? (
                        <ThumbsUp size={15} />
                      ) : (
                        <Eye size={15} />
                      )}
                    </span>
                    <div>
                      <strong>{event.state === "approved" ? "Approved" : "Seen"}</strong>
                      <time>{formatRelativeTime(event.submittedAt)}</time>
                      {event.body && <p>{event.body}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="codex-empty">No Codex review signal found for this pull request.</p>
            )}

            <button className="codex-promote" onClick={() => onPromoteCodex(pullRequest.id)}>
              <Eye size={15} />
              <span>Mark eyes to thumbs up</span>
              <ThumbsUp size={15} />
            </button>
          </section>

          <section className="labels">
            <h2>Labels</h2>
            <div>
              {pullRequest.labels.map((label) => (
                <span key={label}>{label}</span>
              ))}
              {!pullRequest.labels.length && <span>unlabeled</span>}
            </div>
          </section>
        </>
      )}

      {activeTab === "reviews" && (
        <ReviewSignalPanel
          pullRequest={pullRequest}
          memory={memory}
          intel={intel}
          onPromoteCodex={() => {
            onPromoteCodex(pullRequest.id);
            addAssistantNote(buildReviewSignalNote(pullRequest, intel, memory), { checked_codex: true });
          }}
          onLogSignal={() => addAssistantNote(buildReviewSignalNote(pullRequest, intel, memory), { checked_codex: true })}
        />
      )}

      {activeTab === "files" && activeFile && (
        <FileReviewStudio
          pullRequest={pullRequest}
          intel={intel}
          activeFile={activeFile}
          onSelectFile={setSelectedFile}
          onAddContext={(file) =>
            addAssistantNote(
              `Added ${file} to the review context. Check the highlighted hunk, verify the generated suggestion, and confirm the diff before approval.`,
              { read_diff: true },
            )
          }
        />
      )}

      {activeTab === "commits" && (
        <CommitTimeline
          pullRequest={pullRequest}
          intel={intel}
          onAddSummary={() =>
            addAssistantNote(
              `Version summary queued: ${pullRequest.branch} has ${Math.max(3, pullRequest.reviewEvents.length || 0)} notable review events, ${intel.files.length} changed files, and ${intel.queueEstimate} queue estimate.`,
            )
          }
        />
      )}

      {activeTab === "checks" && (
        <ChecksBoard
          pullRequest={pullRequest}
          intel={intel}
          readinessItems={readinessItems}
          onValidate={() =>
            addAssistantNote(
              `CI validation recorded for #${pullRequest.number}: ${pullRequest.ciSummary}. Remaining merge readiness is ${intel.readiness}/${intel.readinessTotal}.`,
              { validated_ci: true },
            )
          }
        />
      )}

      <div className="inspector-actions">
        <button className="control-button">
          <GitBranch size={16} />
          <span>Checkout</span>
        </button>
        <button className="primary-action" onClick={() => onSmartMerge(pullRequest.id)}>
          <span>Smart merge</span>
          <GitMerge size={15} />
        </button>
        <button className="icon-button" title="More actions" aria-label="More actions">
          <MoreHorizontal size={18} />
        </button>
      </div>
      {actionMessage && <div className="action-toast">{actionMessage}</div>}
      {pullRequest.url && (
        <a className="github-deep-link" href={pullRequest.url} target="_blank" rel="noreferrer">
          <ExternalLink size={14} />
          View on GitHub
        </a>
      )}
    </aside>
  );
}

function ReviewSignalPanel({
  pullRequest,
  memory,
  intel,
  onPromoteCodex,
  onLogSignal,
}: {
  pullRequest: PullRequestSummary;
  memory: ReviewMemory;
  intel: PrIntelligence;
  onPromoteCodex: () => void;
  onLogSignal: () => void;
}) {
  const reviewEvents = buildReviewSignalEvents(pullRequest);
  const latestCodex = pullRequest.codex.events[pullRequest.codex.events.length - 1];
  const hasChangedReaction = pullRequest.codex.reaction === "changed";
  const humanApprovals = pullRequest.reviewEvents.filter((event) => event.state === "approved" && !event.reviewer.isCodex).length;
  const humanRequests = pullRequest.reviewEvents.filter((event) => event.state === "changes_requested" && !event.reviewer.isCodex).length;
  const signalStrength = calculateReviewSignalStrength(pullRequest, memory, intel);
  const signalLogged = memory.checklist.checked_codex;

  return (
    <section className="review-signal-panel inspector-tab-panel" data-testid="review-signal-panel">
      <div className="inspector-mode-head">
        <div>
          <span>Review signals</span>
          <h2>{pullRequest.codex.statusText}</h2>
        </div>
        <button type="button" className={signalLogged ? "logged" : ""} onClick={onLogSignal}>
          {signalLogged ? <CheckCheck size={14} /> : <Copy size={14} />}
          {signalLogged ? "Signal logged" : "Log signal"}
        </button>
      </div>

      <div className="review-signal-hero">
        <div>
          <span className={`signal-orb signal-${pullRequest.codex.reaction}`}>
            {pullRequest.codex.reaction === "thumbs_up" || hasChangedReaction ? <ThumbsUp size={18} /> : <Eye size={18} />}
          </span>
          <div>
            <strong>{hasChangedReaction ? "Codex reaction changed" : pullRequest.codex.exists ? "Codex signal exists" : "Codex missing"}</strong>
            <p>
              {pullRequest.codex.exists
                ? `${pullRequest.codex.statusText}${latestCodex ? ` · ${formatRelativeTime(latestCodex.submittedAt)}` : ""}`
                : "Request an AI review before this PR enters your ready lane."}
            </p>
          </div>
        </div>
        <button type="button" onClick={onPromoteCodex}>
          <Eye size={14} />
          Eyes to thumbs up
          <ThumbsUp size={14} />
        </button>
      </div>

      <div className="reaction-ladder" aria-label="Codex reaction progression">
        {[
          { id: "exists", label: "Exists", ready: pullRequest.codex.exists },
          { id: "eyes", label: "Eyes", ready: pullRequest.codex.events.some((event) => event.reaction === "eyes") || pullRequest.codex.reaction === "eyes" },
          { id: "thumbs", label: "Thumbs up", ready: pullRequest.codex.reaction === "thumbs_up" || hasChangedReaction },
          { id: "changed", label: "Changed", ready: hasChangedReaction },
        ].map((step, index) => (
          <div className={step.ready ? "ready" : "waiting"} key={step.id}>
            <span>{index + 1}</span>
            <strong>{step.label}</strong>
          </div>
        ))}
      </div>

      <div className="review-signal-metrics">
        <div>
          <span>Signal strength</span>
          <strong>{signalStrength}%</strong>
        </div>
        <div>
          <span>Human approvals</span>
          <strong>{humanApprovals}</strong>
        </div>
        <div>
          <span>Requested changes</span>
          <strong>{humanRequests}</strong>
        </div>
        <div>
          <span>Decision</span>
          <strong>{memory.decision}</strong>
        </div>
      </div>

      <div className="review-event-stream">
        <div className="review-signal-title">
          <span>Event stream</span>
          <strong>{reviewEvents.length}</strong>
        </div>
        {reviewEvents.map((event) => (
          <article className={`review-signal-event event-${event.tone}`} key={event.id}>
            <span className="review-event-icon">
              {event.icon === "thumbs" ? <ThumbsUp size={15} /> : event.icon === "bot" ? <Bot size={15} /> : event.icon === "alert" ? <AlertCircle size={15} /> : <MessageSquareText size={15} />}
            </span>
            <div>
              <strong>{event.title}</strong>
              <p>{event.detail}</p>
              <time>{formatRelativeTime(event.at)}</time>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function buildReviewSignalEvents(pullRequest: PullRequestSummary) {
  const codexEvents = pullRequest.codex.events.map((event) => toSignalEvent(event, true));
  const humanEvents = pullRequest.reviewEvents
    .filter((event) => !event.reviewer.isCodex)
    .map((event) => toSignalEvent(event, false));

  return [...codexEvents, ...humanEvents].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

function toSignalEvent(event: ReviewEvent, codex: boolean) {
  const approved = event.state === "approved" || event.reaction === "thumbs_up";
  const requested = event.state === "changes_requested";

  return {
    id: event.id,
    title: codex
      ? approved
        ? "Codex approved"
        : "Codex reviewed"
      : `${event.reviewer.login} ${event.state.replace("_", " ")}`,
    detail:
      event.body ??
      (codex
        ? `Reaction is ${event.reaction}.`
        : `Human review state changed to ${event.state}.`),
    at: event.submittedAt,
    tone: requested ? "red" : approved ? "green" : codex ? "purple" : "blue",
    icon: approved ? "thumbs" : requested ? "alert" : codex ? "bot" : "message",
  } satisfies {
    id: string;
    title: string;
    detail: string;
    at: string;
    tone: "blue" | "green" | "purple" | "red";
    icon: "alert" | "bot" | "message" | "thumbs";
  };
}

function calculateReviewSignalStrength(
  pullRequest: PullRequestSummary,
  memory: ReviewMemory,
  intel: PrIntelligence,
) {
  const codexScore = pullRequest.codex.reaction === "changed" || pullRequest.codex.reaction === "thumbs_up" ? 24 : pullRequest.codex.exists ? 12 : 0;
  const humanScore = Math.min(24, pullRequest.reviewEvents.filter((event) => event.state === "approved").length * 12);
  const ciScore = pullRequest.ci === "success" ? 18 : pullRequest.ci === "pending" ? 8 : 0;
  const memoryScore = memory.checklist.checked_codex ? 10 : 0;
  const readinessScore = Math.round((intel.readiness / intel.readinessTotal) * 24);
  return Math.max(8, Math.min(100, codexScore + humanScore + ciScore + memoryScore + readinessScore));
}

function buildReviewSignalNote(
  pullRequest: PullRequestSummary,
  intel: PrIntelligence,
  memory: ReviewMemory,
) {
  const blockers = getBlockers(pullRequest, memory, intel);
  const codexLine = pullRequest.codex.exists
    ? `Codex signal is "${pullRequest.codex.statusText}"`
    : "Codex signal is missing";

  return `${codexLine}; review strength ${calculateReviewSignalStrength(pullRequest, memory, intel)}%. ${
    blockers.length ? `Remaining blockers: ${blockers.join("; ")}.` : "No primary review blockers detected."
  }`;
}

function buildReviewAnswer(
  question: string,
  pullRequest: PullRequestSummary,
  intel: PrIntelligence,
  memory: ReviewMemory,
) {
  const lower = question.toLowerCase();
  const blockers = getBlockers(pullRequest, memory, intel);
  const files = intel.files.slice(0, 3).join(", ");
  const decision = memory.decision === "ready" ? "you marked it ready" : `your decision is ${memory.decision}`;

  if (lower.includes("block") || lower.includes("merge")) {
    return blockers.length
      ? `Merge blockers: ${blockers.join("; ")}. Current readiness is ${intel.readiness}/${intel.readinessTotal}, ${decision}.`
      : `No hard blockers detected. Readiness is ${intel.readiness}/${intel.readinessTotal}; ${decision}. Queue after confirming ${pullRequest.ciSummary}.`;
  }

  if (lower.includes("test") || lower.includes("risk")) {
    return `Risk is ${intel.risk}. Test focus: ${files}. Confirm the ${pullRequest.ciSummary} signal, Codex status "${pullRequest.codex.statusText}", and the ${pullRequest.branch} to ${pullRequest.base} branch path.`;
  }

  if (lower.includes("summary") || lower.includes("summarize") || lower.includes("change")) {
    return `#${pullRequest.number} changes ${files} with +${intel.additions}/-${intel.deletions}. It sits in ${intel.stackName}, branch ${pullRequest.branch}, and Codex says "${pullRequest.codex.statusText}".`;
  }

  return `I would treat #${pullRequest.number} as ${intel.risk} risk, check ${files}, then decide from the merge gates: ${blockers.length ? blockers.join("; ") : "all primary gates look clear"}.`;
}

function getBlockers(
  pullRequest: PullRequestSummary,
  memory: ReviewMemory,
  intel: PrIntelligence,
) {
  return [
    pullRequest.isDraft ? "draft PR" : "",
    pullRequest.ci !== "success" ? pullRequest.ciSummary : "",
    pullRequest.state === "changes_requested" ? "changes requested" : "",
    pullRequest.reviewers.length === 0 ? "no reviewer assigned" : "",
    !pullRequest.codex.exists ? "Codex signal missing" : "",
    memory.decision === "blocked" ? "manual decision is blocked" : "",
    memory.snoozedUntil ? "snoozed from your queue" : "",
    intel.readiness < intel.readinessTotal - 1 ? `readiness ${intel.readiness}/${intel.readinessTotal}` : "",
  ].filter(Boolean);
}

function FileReviewStudio({
  pullRequest,
  intel,
  activeFile,
  onSelectFile,
  onAddContext,
}: {
  pullRequest: PullRequestSummary;
  intel: PrIntelligence;
  activeFile: string;
  onSelectFile: (file: string) => void;
  onAddContext: (file: string) => void;
}) {
  const activeIndex = Math.max(0, intel.files.indexOf(activeFile));
  const activeDelta = getFileDelta(activeFile, activeIndex);
  const lines = buildDiffLines(activeFile, pullRequest, intel);

  return (
    <section className="file-review-studio inspector-tab-panel">
      <div className="inspector-mode-head">
        <div>
          <span>File review</span>
          <h2>{intel.files.length} changed files</h2>
        </div>
        <button type="button" onClick={() => onAddContext(activeFile)}>
          <Sparkles size={14} />
          Add context
        </button>
      </div>

      <div className="file-review-layout">
        <div className="file-review-sidebar" aria-label="Changed files">
          {intel.files.map((file, index) => {
            const delta = getFileDelta(file, index);
            return (
              <button
                type="button"
                key={file}
                className={file === activeFile ? "active" : ""}
                onClick={() => onSelectFile(file)}
              >
                <FileCode2 size={15} />
                <span>{file}</span>
                <em>+{delta.added}</em>
              </button>
            );
          })}
        </div>

        <div className="diff-preview">
          <div className="diff-preview-head">
            <div>
              <strong>{activeFile}</strong>
              <span>+{activeDelta.added} / -{activeDelta.removed}</span>
            </div>
            <button type="button" onClick={() => onAddContext(activeFile)}>
              <Copy size={13} />
              Review note
            </button>
          </div>

          <div className="diff-hunk" role="table" aria-label={`${activeFile} diff preview`}>
            {lines.map((line) => (
              <div className={`diff-line diff-${line.kind}`} key={`${line.number}-${line.kind}-${line.code}`}>
                <span>{line.number}</span>
                <code>{line.code}</code>
              </div>
            ))}
          </div>

          <div className="inline-review-card">
            <div>
              <Bot size={15} />
              <strong>Suggested review focus</strong>
            </div>
            <p>{getFileSuggestion(activeFile, pullRequest, intel)}</p>
            <button type="button" onClick={() => onAddContext(activeFile)}>
              Add to review batch
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function CommitTimeline({
  pullRequest,
  intel,
  onAddSummary,
}: {
  pullRequest: PullRequestSummary;
  intel: PrIntelligence;
  onAddSummary: () => void;
}) {
  const events = buildVersionEvents(pullRequest, intel);

  return (
    <section className="commit-timeline inspector-tab-panel">
      <div className="inspector-mode-head">
        <div>
          <span>Versions</span>
          <h2>Review timeline</h2>
        </div>
        <button type="button" onClick={onAddSummary}>
          <Copy size={14} />
          Copy summary
        </button>
      </div>

      <div className="version-stack">
        {events.map((event, index) => (
          <article className={`version-card tone-${event.tone}`} key={`${event.title}-${event.at}`}>
            <span className="version-index">{index + 1}</span>
            <div>
              <strong>{event.title}</strong>
              <p>{event.detail}</p>
              <time>{formatRelativeTime(event.at)}</time>
            </div>
            {event.tone === "green" ? <CheckCheck size={16} /> : event.tone === "red" ? <AlertCircle size={16} /> : <GitBranch size={16} />}
          </article>
        ))}
      </div>
    </section>
  );
}

function ChecksBoard({
  pullRequest,
  intel,
  readinessItems,
  onValidate,
}: {
  pullRequest: PullRequestSummary;
  intel: PrIntelligence;
  readinessItems: readonly ReadinessItem[];
  onValidate: () => void;
}) {
  const checkRows = buildCheckRows(pullRequest, intel);

  return (
    <section className="checks-board inspector-tab-panel">
      <div className="inspector-mode-head">
        <div>
          <span>Required checks</span>
          <h2>{pullRequest.ciSummary}</h2>
        </div>
        <button type="button" onClick={onValidate}>
          <CheckCheck size={14} />
          Validate CI
        </button>
      </div>

      <div className="check-health-strip">
        <div>
          <CiBadge state={pullRequest.ci} />
          <span>CI state</span>
          <strong>{pullRequest.ci}</strong>
        </div>
        <div>
          <ShieldCheck size={16} />
          <span>Readiness</span>
          <strong>{intel.readiness}/{intel.readinessTotal}</strong>
        </div>
        <div>
          <Zap size={16} />
          <span>Queue</span>
          <strong>{intel.queueEstimate}</strong>
        </div>
      </div>

      <div className="required-check-list">
        {checkRows.map((row) => (
          <div className={`required-check required-${row.state}`} key={row.name}>
            {row.state === "pass" ? <MiniCheck /> : row.state === "fail" ? <AlertCircle size={16} /> : <Clock3 size={16} />}
            <div>
              <strong>{row.name}</strong>
              <span>{row.detail}</span>
            </div>
            <em>{row.label}</em>
          </div>
        ))}
      </div>

      <div className="gate-memo">
        <h3>Merge gates</h3>
        {readinessItems.map(([label, ready]) => (
          <div className={ready ? "ready" : "waiting"} key={label}>
            {ready ? <MiniCheck /> : <Clock3 size={15} />}
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function getFileDelta(file: string, index: number) {
  const weight = file.length + index * 7;
  return {
    added: file.endsWith(".css") ? 18 : file.endsWith(".json") ? 6 : 8 + (weight % 17),
    removed: file.endsWith(".css") ? 4 : weight % 7,
  };
}

function buildDiffLines(
  file: string,
  pullRequest: PullRequestSummary,
  intel: PrIntelligence,
) {
  const componentName = file
    .split("/")
    .pop()
    ?.replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Review Surface";
  const riskGate = intel.risk === "high" ? "requiresManualGate" : "canQueueForMerge";

  return [
    { number: 18, kind: "context", code: `const title = "${componentName}";` },
    { number: 19, kind: "remove", code: `return status === "pending";` },
    { number: 19, kind: "add", code: `return ${riskGate}(pullRequest);` },
    { number: 20, kind: "add", code: `trackReviewSignal("${pullRequest.codex.reaction}", title);` },
    { number: 21, kind: "context", code: `queueEstimate = "${intel.queueEstimate}";` },
  ] as const;
}

function getFileSuggestion(
  file: string,
  pullRequest: PullRequestSummary,
  intel: PrIntelligence,
) {
  if (file.endsWith(".css")) {
    return "Check responsive density and text wrapping after the stack dashboard changes.";
  }
  if (file.includes("github") || file.includes("api")) {
    return "Confirm API data still maps into review, Codex, branch, and CI states without losing optional fields.";
  }
  if (intel.risk === "high") {
    return `Focus on the changed control path for #${pullRequest.number}; this PR is high risk until blockers clear.`;
  }
  return "Skim the hunk for state ownership, empty states, and whether the review note should be batched before approval.";
}

function buildVersionEvents(
  pullRequest: PullRequestSummary,
  intel: PrIntelligence,
) {
  const codexTone = pullRequest.codex.reaction === "thumbs_up" || pullRequest.codex.reaction === "changed" ? "green" : "amber";

  return [
    {
      title: "Branch opened",
      detail: `${pullRequest.branch} targets ${pullRequest.base} with ${intel.stackName}.`,
      at: pullRequest.createdAt,
      tone: "blue",
    },
    {
      title: "Latest push",
      detail: `Updated ${intel.files.length} files with +${intel.additions}/-${intel.deletions}.`,
      at: pullRequest.updatedAt,
      tone: intel.risk === "high" ? "red" : "blue",
    },
    {
      title: "Codex signal",
      detail: pullRequest.codex.exists ? pullRequest.codex.statusText : "No AI review has been seen yet.",
      at: pullRequest.codex.lastSeenAt ?? pullRequest.updatedAt,
      tone: codexTone,
    },
    {
      title: "Merge readiness",
      detail: `${intel.readiness}/${intel.readinessTotal} gates ready; queue estimate ${intel.queueEstimate}.`,
      at: pullRequest.updatedAt,
      tone: intel.readiness >= intel.readinessTotal - 1 ? "green" : "amber",
    },
  ] satisfies Array<{
    title: string;
    detail: string;
    at: string;
    tone: "blue" | "green" | "amber" | "red";
  }>;
}

function buildCheckRows(
  pullRequest: PullRequestSummary,
  intel: PrIntelligence,
) {
  return [
    {
      name: "typecheck",
      detail: "TypeScript compile and generated type contract",
      state: pullRequest.ci === "failure" ? "fail" : "pass",
      label: pullRequest.ci === "failure" ? "failed" : "passed",
    },
    {
      name: "unit review gates",
      detail: `${intel.files.length} changed files sampled for review-critical paths`,
      state: intel.risk === "high" ? "pending" : "pass",
      label: intel.risk === "high" ? "needs scan" : "passed",
    },
    {
      name: "Codex review",
      detail: pullRequest.codex.exists ? pullRequest.codex.statusText : "AI review has not been requested",
      state: pullRequest.codex.exists ? "pass" : "pending",
      label: pullRequest.codex.exists ? "seen" : "missing",
    },
    {
      name: "merge queue eligibility",
      detail: pullRequest.isDraft ? "Draft PRs cannot enter the queue" : `Estimated queue time ${intel.queueEstimate}`,
      state: pullRequest.isDraft || pullRequest.state === "changes_requested" ? "pending" : "pass",
      label: pullRequest.isDraft ? "draft" : "readying",
    },
  ] satisfies Array<{
    name: string;
    detail: string;
    state: "pass" | "pending" | "fail";
    label: string;
  }>;
}
