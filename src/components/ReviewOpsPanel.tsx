import {
  Bot,
  CheckCircle2,
  Clock3,
  GitMerge,
  RadioTower,
  ShieldAlert,
  Sparkles,
  Target,
  Workflow,
} from "lucide-react";
import { PullRequestSummary } from "../types";
import { getPrIntelligence } from "../lib/insights";

export type WorkMode = "focus" | "ship" | "risk" | "ai";

interface ReviewOpsPanelProps {
  pullRequests: PullRequestSummary[];
  selectedId?: string;
  mode: WorkMode;
  onModeChange: (mode: WorkMode) => void;
  onSelectPullRequest: (id: string) => void;
  onSmartMerge: (id: string) => void;
  onPromoteCodex: (id: string) => void;
}

export function ReviewOpsPanel({
  pullRequests,
  selectedId,
  mode,
  onModeChange,
  onSelectPullRequest,
  onSmartMerge,
  onPromoteCodex,
}: ReviewOpsPanelProps) {
  const selected = pullRequests.find((pr) => pr.id === selectedId) ?? pullRequests[0];
  const queue = [...pullRequests]
    .map((pr, index) => ({ pr, intel: getPrIntelligence(pr, index) }))
    .sort((a, b) => b.intel.readiness - a.intel.readiness)
    .slice(0, 4);
  const risky = queue.filter((item) => item.intel.risk !== "low").length;
  const codexPending = pullRequests.filter((pr) => !pr.codex.exists || pr.codex.reaction === "eyes").length;
  const selectedIntel = selected ? getPrIntelligence(selected) : undefined;

  return (
    <section className="review-ops">
      <div className="mode-strip" role="tablist" aria-label="Work modes">
        <ModeButton mode="focus" active={mode === "focus"} label="Focus" count={pullRequests.length} onClick={onModeChange} />
        <ModeButton mode="ship" active={mode === "ship"} label="Ship" count={queue.filter((item) => item.intel.readiness >= 5).length} onClick={onModeChange} />
        <ModeButton mode="risk" active={mode === "risk"} label="Risk" count={risky} onClick={onModeChange} />
        <ModeButton mode="ai" active={mode === "ai"} label="AI" count={codexPending} onClick={onModeChange} />
      </div>

      <div className="ops-card ai-brief">
        <div className="ops-title">
          <Sparkles size={16} />
          <h2>AI next actions</h2>
          <span>live</span>
        </div>
        <div className="brief-list">
          {selected && selectedIntel && (
            <button onClick={() => onSmartMerge(selected.id)}>
              <GitMerge size={16} />
              <span>
                Queue #{selected.number} when {selectedIntel.readiness}/{selectedIntel.readinessTotal} checks stay green
              </span>
              <em>{selectedIntel.queueEstimate}</em>
            </button>
          )}
          {pullRequests.find((pr) => pr.state === "changes_requested") && (
            <button onClick={() => onModeChange("risk")}>
              <ShieldAlert size={16} />
              <span>Resolve returned work before it blocks the stack</span>
              <em>risk</em>
            </button>
          )}
          {selected && selected.codex.reaction !== "changed" && (
            <button onClick={() => onPromoteCodex(selected.id)}>
              <Bot size={16} />
              <span>Promote Codex review signal from eyes to approval</span>
              <em>AI</em>
            </button>
          )}
        </div>
      </div>

      <div className="ops-card merge-queue">
        <div className="ops-title">
          <Workflow size={16} />
          <h2>Merge queue</h2>
          <span>{queue.length} lanes</span>
        </div>
        <div className="queue-list">
          {queue.map(({ pr, intel }) => (
            <button
              key={pr.id}
              className={pr.id === selectedId ? "selected" : ""}
              onClick={() => onSelectPullRequest(pr.id)}
            >
              <span className="queue-pr">#{pr.number}</span>
              <span className="queue-title">{pr.title.replace(/^feat: |^fix: |^chore: /, "")}</span>
              <span className={`queue-risk risk-${intel.risk}`}>{intel.risk}</span>
              <span className="queue-ready">{intel.readiness}/{intel.readinessTotal}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ops-card guardrails">
        <div className="ops-title">
          <RadioTower size={16} />
          <h2>Guardrails</h2>
          <span>armed</span>
        </div>
        <div className="guardrail-grid">
          <Guardrail label="Auto-refresh" status="Every 5m" good />
          <Guardrail label="Codex signal" status={`${codexPending} pending`} good={codexPending < 3} />
          <Guardrail label="Risk budget" status={`${risky} active`} good={risky < 2} />
          <Guardrail label="Queue health" status="Stable" good />
        </div>
      </div>
    </section>
  );
}

function ModeButton({
  mode,
  active,
  label,
  count,
  onClick,
}: {
  mode: WorkMode;
  active: boolean;
  label: string;
  count: number;
  onClick: (mode: WorkMode) => void;
}) {
  const Icon = mode === "focus" ? Target : mode === "ship" ? GitMerge : mode === "risk" ? ShieldAlert : Bot;

  return (
    <button className={active ? "active" : ""} onClick={() => onClick(mode)}>
      <Icon size={15} />
      <span>{label}</span>
      <b>{count}</b>
    </button>
  );
}

function Guardrail({ label, status, good }: { label: string; status: string; good: boolean }) {
  return (
    <div className={good ? "guardrail good" : "guardrail warn"}>
      {good ? <CheckCircle2 size={15} /> : <Clock3 size={15} />}
      <span>{label}</span>
      <em>{status}</em>
    </div>
  );
}
