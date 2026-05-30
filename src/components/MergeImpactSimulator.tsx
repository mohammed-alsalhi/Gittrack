import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileCode2,
  GitMerge,
  GitPullRequest,
  Layers3,
  PackageCheck,
  ShieldAlert,
  Sparkles,
  Target,
} from "lucide-react";
import { getPrIntelligence } from "../lib/insights";
import { PullRequestSummary, ReviewMemoryByPr } from "../types";
import { CiBadge, StatusPill } from "./ui";

interface MergeImpactSimulatorProps {
  repo: string;
  pullRequests: PullRequestSummary[];
  reviewMemory: ReviewMemoryByPr;
  selectedIds?: string[];
  selectedPrId?: string;
  onTogglePullRequest: (id: string, nextSelected: boolean) => void;
  onSelectRecommended: (ids: string[]) => void;
  onClearPlan: () => void;
  onCopyPlan: (text: string, count: number) => void;
  onSelectPullRequest: (id: string) => void;
  onSmartMerge: (id: string) => void;
}

interface ImpactItem {
  pr: PullRequestSummary;
  selected: boolean;
  recommended: boolean;
  blocked: boolean;
  riskPoints: number;
  readiness: string;
  files: string[];
  domains: string[];
}

interface ImpactScenario {
  items: ImpactItem[];
  selected: ImpactItem[];
  recommendedIds: string[];
  confidence: number;
  riskPoints: number;
  blockerCount: number;
  fileCount: number;
  domains: ImpactDomain[];
  shipOrder: ImpactItem[];
}

interface ImpactDomain {
  name: string;
  files: number;
  prs: number;
  tone: "green" | "amber" | "red" | "blue";
}

export function MergeImpactSimulator({
  repo,
  pullRequests,
  reviewMemory,
  selectedIds,
  selectedPrId,
  onTogglePullRequest,
  onSelectRecommended,
  onClearPlan,
  onCopyPlan,
  onSelectPullRequest,
  onSmartMerge,
}: MergeImpactSimulatorProps) {
  const scenario = buildImpactScenario(repo, pullRequests, reviewMemory, selectedIds);
  const selectedIdSet = new Set(scenario.selected.map((item) => item.pr.id));
  const primaryReady = scenario.shipOrder.find((item) => !item.blocked);
  const planText = formatImpactPlan(repo, scenario);

  return (
    <section className="merge-impact-simulator" data-testid="merge-impact-simulator">
      <div className="impact-head">
        <div>
          <span>Merge impact</span>
          <h2>
            {scenario.selected.length} {pluralize("PR", scenario.selected.length)} in the simulated ship set
          </h2>
          <p>Model confidence, blast radius, blockers, and the safest order before you land the stack.</p>
        </div>
        <div className="impact-actions">
          <button type="button" onClick={() => onSelectRecommended(scenario.recommendedIds)} data-testid="impact-recommended">
            <Sparkles size={14} />
            Recommended
          </button>
          <button type="button" onClick={onClearPlan}>
            <Target size={14} />
            Clear
          </button>
          <button type="button" className="impact-primary" onClick={() => onCopyPlan(planText, scenario.selected.length)}>
            <Copy size={14} />
            Copy plan
          </button>
        </div>
      </div>

      <div className="impact-metric-strip" aria-label="Merge impact summary">
        <ImpactMetric label="Confidence" value={`${scenario.confidence}%`} tone={scenario.confidence > 82 ? "green" : scenario.confidence > 64 ? "amber" : "red"} />
        <ImpactMetric label="Blockers" value={scenario.blockerCount} tone={scenario.blockerCount ? "red" : "green"} />
        <ImpactMetric label="Files" value={scenario.fileCount} tone={scenario.fileCount > 12 ? "amber" : "blue"} />
        <ImpactMetric label="Domains" value={scenario.domains.length} tone={scenario.domains.length > 3 ? "amber" : "green"} />
      </div>

      <div className="impact-body">
        <div className="impact-candidates">
          <div className="impact-section-title">
            <ClipboardList size={15} />
            <strong>Candidate set</strong>
            <span>{scenario.items.length} active PRs</span>
          </div>

          <div className="impact-candidate-list">
            {scenario.items.map((item) => (
              <div
                className={`impact-row ${item.selected ? "selected" : ""} ${item.blocked ? "blocked" : ""}`}
                key={item.pr.id}
              >
                <button
                  type="button"
                  className="impact-toggle"
                  onClick={() => onTogglePullRequest(item.pr.id, !selectedIdSet.has(item.pr.id))}
                  aria-label={`${item.selected ? "Remove" : "Add"} #${item.pr.number} from simulated merge`}
                  data-testid={`impact-toggle-${item.pr.number}`}
                >
                  {item.selected ? <CheckCircle2 size={15} /> : <GitPullRequest size={15} />}
                </button>
                <button
                  type="button"
                  className={`impact-row-main ${item.pr.id === selectedPrId ? "focused" : ""}`}
                  onClick={() => onSelectPullRequest(item.pr.id)}
                >
                  <span>
                    <strong>#{item.pr.number} {item.pr.title.replace(/^feat: |^fix: |^chore: |^docs: /, "")}</strong>
                    <small>{item.domains.join(", ")} · {item.readiness} gates · risk {item.riskPoints}</small>
                  </span>
                  <StatusPill state={item.pr.state} />
                  <CiBadge state={item.pr.ci} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <aside className="impact-blast-radius">
          <div className="impact-section-title">
            <Boxes size={15} />
            <strong>Blast radius</strong>
            <span>{scenario.fileCount} files</span>
          </div>
          <div className="impact-domain-list">
            {scenario.domains.map((domain) => (
              <div className={`impact-domain domain-${domain.tone}`} key={domain.name}>
                <span>{iconForDomain(domain.name)}</span>
                <strong>{domain.name}</strong>
                <em>{domain.files} files · {domain.prs} PRs</em>
              </div>
            ))}
            {!scenario.domains.length && (
              <div className="impact-empty">
                <CheckCircle2 size={15} />
                Select PRs to model blast radius.
              </div>
            )}
          </div>
        </aside>

        <aside className="impact-ship-order">
          <div className="impact-section-title">
            <Layers3 size={15} />
            <strong>Ship order</strong>
          </div>
          <div className="impact-order-list">
            {scenario.shipOrder.map((item, index) => (
              <button
                type="button"
                className={`impact-order-row ${item.blocked ? "blocked" : ""}`}
                key={item.pr.id}
                onClick={() => onSelectPullRequest(item.pr.id)}
              >
                <b>{index + 1}</b>
                <span>
                  <strong>#{item.pr.number}</strong>
                  <small>{item.blocked ? "Blocker first" : "Ready lane"}</small>
                </span>
                {item.blocked ? <ShieldAlert size={14} /> : <CheckCircle2 size={14} />}
              </button>
            ))}
            {!scenario.shipOrder.length && (
              <div className="impact-empty">
                <PackageCheck size={15} />
                No simulated ship set yet.
              </div>
            )}
          </div>
          <button
            type="button"
            className="impact-merge-button"
            disabled={!primaryReady}
            onClick={() => primaryReady && onSmartMerge(primaryReady.pr.id)}
          >
            <GitMerge size={14} />
            Queue safest PR
          </button>
        </aside>
      </div>
    </section>
  );
}

function pluralize(label: string, count: number) {
  return count === 1 ? label : `${label}s`;
}

function ImpactMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "blue" | "green" | "amber" | "red";
}) {
  return (
    <div className={`impact-metric metric-${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function buildImpactScenario(
  repo: string,
  pullRequests: PullRequestSummary[],
  reviewMemory: ReviewMemoryByPr,
  explicitSelectedIds?: string[],
): ImpactScenario {
  const active = pullRequests.filter((pr) => pr.state !== "merged");
  const recommendedIds = active
    .filter((pr, index) => isRecommended(pr, index, reviewMemory))
    .map((pr) => pr.id);
  const selectedSource = explicitSelectedIds ?? recommendedIds;
  const selectedSet = new Set(selectedSource);

  const items = active.map<ImpactItem>((pr, index) => {
    const intel = getPrIntelligence(pr, index);
    const memory = reviewMemory[pr.id];
    const blocked = pr.ci === "failure" || pr.state === "changes_requested" || memory?.decision === "blocked" || pr.isDraft;
    const files = intel.files;
    const domains = [...new Set(files.map(domainForFile))];
    const riskPoints =
      (intel.risk === "high" ? 34 : intel.risk === "medium" ? 18 : 8) +
      (pr.ci === "failure" ? 30 : pr.ci === "pending" ? 14 : 0) +
      (pr.isDraft ? 18 : 0) +
      (memory?.decision === "blocked" ? 24 : 0) +
      Math.max(0, domains.length - 2) * 4;

    return {
      pr,
      selected: selectedSet.has(pr.id),
      recommended: recommendedIds.includes(pr.id),
      blocked,
      riskPoints,
      readiness: `${intel.readiness}/${intel.readinessTotal}`,
      files,
      domains,
    };
  });

  const selected = items.filter((item) => item.selected);
  const riskPoints = selected.reduce((sum, item) => sum + item.riskPoints, 0);
  const blockerCount = selected.filter((item) => item.blocked).length;
  const fileCount = new Set(selected.flatMap((item) => item.files)).size;
  const domainMap = new Map<string, { files: Set<string>; prs: Set<string> }>();

  selected.forEach((item) => {
    item.files.forEach((file) => {
      const domain = domainForFile(file);
      const previous = domainMap.get(domain) ?? { files: new Set<string>(), prs: new Set<string>() };
      previous.files.add(file);
      previous.prs.add(item.pr.id);
      domainMap.set(domain, previous);
    });
  });

  const domains = [...domainMap.entries()]
    .map<ImpactDomain>(([name, value]) => ({
      name,
      files: value.files.size,
      prs: value.prs.size,
      tone: toneForDomain(value.files.size, value.prs.size),
    }))
    .sort((a, b) => b.files - a.files || b.prs - a.prs);
  const confidence = selected.length
    ? Math.max(5, Math.min(99, 96 - riskPoints - blockerCount * 12 - Math.max(0, fileCount - 8)))
    : 0;
  const shipOrder = [...selected].sort((a, b) => Number(a.blocked) - Number(b.blocked) || a.riskPoints - b.riskPoints || a.pr.number - b.pr.number);

  return {
    items,
    selected,
    recommendedIds,
    confidence,
    riskPoints,
    blockerCount,
    fileCount,
    domains,
    shipOrder,
  };
}

function isRecommended(
  pr: PullRequestSummary,
  index: number,
  reviewMemory: ReviewMemoryByPr,
) {
  const memory = reviewMemory[pr.id];
  const intel = getPrIntelligence(pr, index);
  const snoozed = Boolean(memory?.snoozedUntil && new Date(memory.snoozedUntil).getTime() > Date.now());

  return (
    !pr.isDraft &&
    !snoozed &&
    pr.ci === "success" &&
    pr.state !== "changes_requested" &&
    memory?.decision !== "blocked" &&
    (pr.state === "approved" || memory?.decision === "ready" || intel.readiness >= intel.readinessTotal - 1)
  );
}

function domainForFile(file: string) {
  if (/package|lock|pnpm|yarn|npm/i.test(file)) return "Dependencies";
  if (/style|css|theme|token/i.test(file)) return "Design system";
  if (/component|pages|app|view|screen/i.test(file)) return "Frontend";
  if (/api|github|client|server|route/i.test(file)) return "Integration";
  if (/test|spec|fixture/i.test(file)) return "Tests";
  if (/config|vite|tsconfig|eslint/i.test(file)) return "Tooling";
  return "Core";
}

function toneForDomain(files: number, prs: number): ImpactDomain["tone"] {
  if (files > 5 || prs > 2) return "red";
  if (files > 2 || prs > 1) return "amber";
  if (files === 0) return "blue";
  return "green";
}

function iconForDomain(domain: string) {
  if (domain === "Dependencies") return <PackageCheck size={14} />;
  if (domain === "Integration") return <GitMerge size={14} />;
  if (domain === "Frontend" || domain === "Design system") return <FileCode2 size={14} />;
  if (domain === "Tests") return <ShieldAlert size={14} />;
  if (domain === "Tooling") return <AlertTriangle size={14} />;
  return <Boxes size={14} />;
}

function formatImpactPlan(repo: string, scenario: ImpactScenario) {
  return [
    `Merge impact plan · ${repo}`,
    `Confidence: ${scenario.confidence}%`,
    `Blockers: ${scenario.blockerCount}`,
    `Blast radius: ${scenario.fileCount} files across ${scenario.domains.length} domains`,
    "",
    "Ship order:",
    ...(scenario.shipOrder.length
      ? scenario.shipOrder.map((item, index) => `${index + 1}. #${item.pr.number} ${item.pr.title} (${item.blocked ? "blocked" : "ready"}, ${item.domains.join(", ")})`)
      : ["No PRs selected."]),
    "",
    "Domains:",
    ...(scenario.domains.length
      ? scenario.domains.map((domain) => `- ${domain.name}: ${domain.files} files / ${domain.prs} PRs`)
      : ["- None selected"]),
  ].join("\n");
}
