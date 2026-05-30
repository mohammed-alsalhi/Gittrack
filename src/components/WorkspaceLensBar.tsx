import {
  Bot,
  Gauge,
  LayoutDashboard,
  Rocket,
  Target,
  Workflow,
} from "lucide-react";
import { getPrIntelligence } from "../lib/insights";
import { PullRequestSummary } from "../types";

export type WorkspaceLens = "all" | "focus" | "ai" | "ship" | "ops";

interface WorkspaceLensBarProps {
  activeLens: WorkspaceLens;
  pullRequests: PullRequestSummary[];
  branchCount: number;
  automationCount: number;
  onChangeLens: (lens: WorkspaceLens) => void;
}

interface LensItem {
  id: WorkspaceLens;
  label: string;
  detail: string;
  count: number;
  tone: "blue" | "green" | "amber" | "red";
}

export function WorkspaceLensBar({
  activeLens,
  pullRequests,
  branchCount,
  automationCount,
  onChangeLens,
}: WorkspaceLensBarProps) {
  const lensItems = buildLensItems(pullRequests, branchCount, automationCount);
  const activeItem = lensItems.find((item) => item.id === activeLens) ?? lensItems[0];

  return (
    <section className="workspace-lens-bar" data-testid="workspace-lens-bar">
      <div className="lens-summary">
        <span>Workspace lens</span>
        <h2>{activeItem.label}</h2>
        <p>{activeItem.detail}</p>
      </div>
      <div className="lens-grid" role="tablist" aria-label="Workspace lenses">
        {lensItems.map((item) => (
          <button
            type="button"
            role="tab"
            aria-selected={item.id === activeLens}
            className={`lens-tile lens-${item.tone} ${item.id === activeLens ? "active" : ""}`}
            key={item.id}
            onClick={() => onChangeLens(item.id)}
            data-testid={`workspace-lens-${item.id}`}
          >
            <span className="lens-icon">{iconForLens(item.id)}</span>
            <span className="lens-copy">
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </span>
            <b>{item.count}</b>
          </button>
        ))}
      </div>
    </section>
  );
}

function buildLensItems(
  pullRequests: PullRequestSummary[],
  branchCount: number,
  automationCount: number,
): LensItem[] {
  const active = pullRequests.filter((pr) => pr.state !== "merged");
  const aiPending = active.filter((pr) => !pr.codex.exists || pr.codex.reaction === "eyes").length;
  const blocked = active.filter((pr) => pr.state === "changes_requested" || pr.ci === "failure").length;
  const ready = active.filter((pr, index) => {
    const intel = getPrIntelligence(pr, index);
    return !pr.isDraft && pr.ci === "success" && (pr.state === "approved" || intel.readiness >= intel.readinessTotal - 1);
  }).length;

  return [
    {
      id: "all",
      label: "PR inbox",
      detail: "Every queue, stack, and review surface",
      count: active.length,
      tone: "blue",
    },
    {
      id: "focus",
      label: "Review queue",
      detail: "Needs review, blockers, and routes",
      count: blocked + active.filter((pr) => pr.state === "waiting_review").length,
      tone: blocked ? "red" : "amber",
    },
    {
      id: "ai",
      label: "AI reviews",
      detail: "Codex eyes, sweeps, and approvals",
      count: aiPending,
      tone: aiPending ? "amber" : "green",
    },
    {
      id: "ship",
      label: "Merge queue",
      detail: "Forecast, impact, and queue train",
      count: ready,
      tone: ready ? "green" : "amber",
    },
    {
      id: "ops",
      label: "Stacks & ops",
      detail: "Automation, activity, and stack map",
      count: branchCount + automationCount,
      tone: "blue",
    },
  ];
}

function iconForLens(lens: WorkspaceLens) {
  if (lens === "focus") return <Target size={15} />;
  if (lens === "ai") return <Bot size={15} />;
  if (lens === "ship") return <Rocket size={15} />;
  if (lens === "ops") return <Workflow size={15} />;
  return lens === "all" ? <LayoutDashboard size={15} /> : <Gauge size={15} />;
}
