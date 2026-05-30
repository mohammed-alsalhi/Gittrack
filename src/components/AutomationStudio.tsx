import {
  BellRing,
  Bot,
  GitMerge,
  Play,
  RadioTower,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { PullRequestSummary } from "../types";
import { getPrIntelligence } from "../lib/insights";

export interface AutomationRule {
  id: string;
  label: string;
  detail: string;
  enabled: boolean;
  tone: "green" | "violet" | "amber";
}

interface AutomationStudioProps {
  rules: AutomationRule[];
  pullRequests: PullRequestSummary[];
  onToggleRule: (id: string) => void;
  onRunPlan: () => void;
}

export function AutomationStudio({
  rules,
  pullRequests,
  onToggleRule,
  onRunPlan,
}: AutomationStudioProps) {
  const ready = pullRequests
    .map((pr, index) => ({ pr, intel: getPrIntelligence(pr, index) }))
    .filter((item) => item.intel.readiness >= item.intel.readinessTotal - 1);
  const risky = pullRequests.filter((pr) => getPrIntelligence(pr).risk === "high");
  const enabledCount = rules.filter((rule) => rule.enabled).length;

  return (
    <section className="automation-studio">
      <div className="automation-header">
        <div>
          <span>Autopilot Studio</span>
          <h2>{enabledCount} rules actively watching your stack</h2>
        </div>
        <button onClick={onRunPlan}>
          <Play size={15} />
          <span>Run plan</span>
        </button>
      </div>

      <div className="automation-grid">
        <div className="rule-stack">
          {rules.map((rule) => (
            <button
              key={rule.id}
              className={`rule-card ${rule.enabled ? "enabled" : ""} rule-${rule.tone}`}
              onClick={() => onToggleRule(rule.id)}
            >
              <span className="rule-switch" />
              <strong>{rule.label}</strong>
              <small>{rule.detail}</small>
            </button>
          ))}
        </div>

        <div className="release-train">
          <div className="mini-title">
            <GitMerge size={16} />
            <strong>Release train</strong>
            <em>{ready.length} ready</em>
          </div>
          <div className="train-track">
            {ready.slice(0, 4).map(({ pr, intel }) => (
              <button key={pr.id} title={pr.title}>
                <span>#{pr.number}</span>
                <i style={{ width: `${Math.round((intel.readiness / intel.readinessTotal) * 100)}%` }} />
              </button>
            ))}
            {!ready.length && <p>No PRs are merge-ready yet.</p>}
          </div>
        </div>

        <div className="signal-board">
          <Signal icon={<Bot size={16} />} label="Codex SLA" value="2m" />
          <Signal icon={<ShieldCheck size={16} />} label="Risk budget" value={risky.length ? `${risky.length} hot` : "clear"} />
          <Signal icon={<BellRing size={16} />} label="Reviewer nudges" value="armed" />
          <Signal icon={<RadioTower size={16} />} label="Next sync" value="4m" />
        </div>
      </div>
    </section>
  );
}

function Signal({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="signal">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export const defaultAutomationRules: AutomationRule[] = [
  {
    id: "codex-review",
    label: "Request Codex on risky diffs",
    detail: "Auto-flags high-risk PRs for AI review.",
    enabled: true,
    tone: "violet",
  },
  {
    id: "smart-merge",
    label: "Queue when checks stay green",
    detail: "Moves approved PRs into smart merge.",
    enabled: true,
    tone: "green",
  },
  {
    id: "reviewer-nudge",
    label: "Nudge stale reviewers",
    detail: "Pings only after quiet hours are respected.",
    enabled: true,
    tone: "amber",
  },
  {
    id: "stack-rebase",
    label: "Suggest stack rebases",
    detail: "Keeps dependent branches close to main.",
    enabled: false,
    tone: "violet",
  },
];
