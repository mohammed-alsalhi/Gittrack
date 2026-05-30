import {
  Bot,
  CheckCircle2,
  Command,
  GitMerge,
  GitPullRequest,
  Radar,
  Rocket,
  ShieldAlert,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { getPrIntelligence } from "../lib/insights";
import type { PullRequestSummary, ReviewMemory } from "../types";
import type { WorkMode } from "./ReviewOpsPanel";
import { CiBadge, CodexBadge } from "./ui";

interface OperationsDockProps {
  selectedPr?: PullRequestSummary;
  selectedMemory?: ReviewMemory;
  workMode: WorkMode;
  source: "sample" | "github";
  queueCount: number;
  lastAction?: string | null;
  onModeChange: (mode: WorkMode) => void;
  onOpenCommandPalette: () => void;
  onPromoteCodex: () => void;
  onMarkReady: () => void;
  onSmartMerge: () => void;
  onOpenLaunchStudio: () => void;
  onOpenChangeRadar: () => void;
}

const modes: Array<{ id: WorkMode; label: string; icon: LucideIcon }> = [
  { id: "focus", label: "Focus", icon: Target },
  { id: "ship", label: "Ship", icon: Rocket },
  { id: "risk", label: "Risk", icon: ShieldAlert },
  { id: "ai", label: "AI", icon: Bot },
];

export function OperationsDock({
  selectedPr,
  selectedMemory,
  workMode,
  source,
  queueCount,
  lastAction,
  onModeChange,
  onOpenCommandPalette,
  onPromoteCodex,
  onMarkReady,
  onSmartMerge,
  onOpenLaunchStudio,
  onOpenChangeRadar,
}: OperationsDockProps) {
  const intel = selectedPr ? getPrIntelligence(selectedPr) : undefined;
  const readiness = intel ? Math.round((intel.readiness / intel.readinessTotal) * 100) : 0;
  const selectedLabel = selectedPr ? `#${selectedPr.number} ${selectedPr.title}` : "No pull request selected";
  const statusText =
    lastAction ??
    (selectedPr
      ? `${selectedPr.repo} · ${selectedMemory?.decision ?? "watch"} · ${queueCount} PRs in scope`
      : `${queueCount} PRs in scope`);

  return (
    <aside className="operations-dock" data-testid="operations-dock" aria-label="Operations dock">
      <div className="ops-dock-context">
        <span className="ops-pr-icon">
          <GitPullRequest size={15} />
        </span>
        <div>
          <strong>{selectedLabel}</strong>
          <small>
            {selectedPr ? `${selectedPr.branch} → ${selectedPr.base}` : "Open the command palette to jump into work."}
          </small>
        </div>
      </div>

      <div className="ops-dock-status" aria-label="Selected pull request status">
        <span className={`ops-source source-${source}`}>{source === "github" ? "Live" : "Sample"}</span>
        {selectedPr && <CiBadge state={selectedPr.ci} />}
        {selectedPr && <CodexBadge reaction={selectedPr.codex.reaction} compact />}
        <span className="ops-ready">{readiness}% ready</span>
      </div>

      <div className="ops-mode-switch" aria-label="Work mode">
        {modes.map((mode) => {
          const Icon = mode.icon;
          return (
            <button
              type="button"
              className={mode.id === workMode ? "active" : ""}
              key={mode.id}
              onClick={() => onModeChange(mode.id)}
            >
              <Icon size={13} />
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>

      <div className="ops-dock-actions" aria-label="Fast actions">
        <button type="button" onClick={onOpenCommandPalette} aria-label="Open command palette" title="Open command palette">
          <Command size={14} />
          <span>Command</span>
        </button>
        <button type="button" disabled={!selectedPr} onClick={onPromoteCodex} aria-label="Promote AI review" title="Promote AI review">
          <Zap size={14} />
          <span>AI</span>
        </button>
        <button type="button" disabled={!selectedPr} onClick={onMarkReady} aria-label="Mark ready" title="Mark ready">
          <CheckCircle2 size={14} />
          <span>Ready</span>
        </button>
        <button type="button" disabled={!selectedPr} onClick={onSmartMerge} aria-label="Smart merge" title="Smart merge">
          <GitMerge size={14} />
          <span>Merge</span>
        </button>
        <button type="button" onClick={onOpenLaunchStudio} aria-label="Open launch studio" title="Open launch studio">
          <Rocket size={14} />
          <span>Launch</span>
        </button>
        <button type="button" onClick={onOpenChangeRadar} aria-label="Open change radar" title="Open change radar">
          <Radar size={14} />
          <span>Radar</span>
        </button>
      </div>

      <p className="ops-dock-message" aria-live="polite">{statusText}</p>
    </aside>
  );
}
