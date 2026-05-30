import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  GitPullRequest,
  Gauge,
  Shuffle,
  TimerReset,
  UserCheck,
  Users,
  VolumeX,
} from "lucide-react";
import { getPrIntelligence, getReviewerLoads } from "../lib/insights";
import {
  PullRequestSummary,
  ReviewMemoryByPr,
  ReviewPerson,
  ReviewerRouteMemoryByPr,
  ReviewerRouteStatus,
} from "../types";
import { CiBadge, CodexBadge, StatusPill, formatRelativeTime } from "./ui";

type ReviewerRouteKind = "reviewer" | "missing" | "author" | "draft";
type ReviewerRouteSeverity = "critical" | "high" | "medium";

interface ReviewerCapacity {
  reviewer: ReviewPerson;
  count: number;
  pending: number;
  approved: number;
  tone: "green" | "amber" | "red";
}

interface ReviewerCapacityView extends ReviewerCapacity {
  routed: number;
  pressure: number;
  utilization: number;
}

export interface ReviewerRoute {
  id: string;
  pr: PullRequestSummary;
  kind: ReviewerRouteKind;
  severity: ReviewerRouteSeverity;
  title: string;
  detail: string;
  reason: string;
  targetReviewer: ReviewPerson;
  alternateReviewer?: ReviewPerson;
  message: string;
  ageHours: number;
  ageLabel: string;
  readinessLabel: string;
  status: ReviewerRouteStatus;
}

interface ReviewerLoadBalancerProps {
  pullRequests: PullRequestSummary[];
  reviewMemory: ReviewMemoryByPr;
  routeMemory: ReviewerRouteMemoryByPr;
  selectedId?: string;
  onSelectPullRequest: (id: string) => void;
  onUpdateRoute: (id: string, status: ReviewerRouteStatus, targetReviewer?: string) => void;
  onCopyRoute: (route: ReviewerRoute) => void;
}

export function ReviewerLoadBalancer({
  pullRequests,
  reviewMemory,
  routeMemory,
  selectedId,
  onSelectPullRequest,
  onUpdateRoute,
  onCopyRoute,
}: ReviewerLoadBalancerProps) {
  const baseCapacity = buildReviewerCapacity(pullRequests);
  const routes = buildReviewerRoutes(pullRequests, reviewMemory, routeMemory, baseCapacity);
  const activeRoutes = routes.filter((route) => route.status !== "done" && route.status !== "muted");
  const visibleRoutes = activeRoutes.slice(0, 6);
  const routeTargets = countRoutesByReviewer(activeRoutes);
  const capacity = baseCapacity.map<ReviewerCapacityView>((lane) => {
    const routed = routeTargets.get(lane.reviewer.login) ?? 0;
    const pressure = lane.pending + routed;

    return {
      ...lane,
      routed,
      pressure,
      tone: pressure >= 3 ? "red" : pressure >= 2 ? "amber" : "green",
      utilization: Math.min(100, Math.max(8, Math.round((pressure / 3) * 100))),
    };
  });
  const hotRoutes = activeRoutes.filter((route) => route.severity === "critical" || route.severity === "high").length;
  const drafted = routes.filter((route) => route.status === "drafted" || route.status === "rerouted").length;
  const balanced = capacity.filter((lane) => lane.tone === "green").length;
  const overloaded = capacity.filter((lane) => lane.tone === "red").length;

  return (
    <section className="reviewer-load-balancer" data-testid="reviewer-load-balancer">
      <div className="reviewer-head">
        <div>
          <span>Reviewer routing</span>
          <h2>{activeRoutes.length ? `${activeRoutes.length} routes keep review moving` : "Review routing is balanced"}</h2>
          <p>Capacity, stale PRs, returned work, and missing reviewers in one queue.</p>
        </div>
        <div className="reviewer-metric-strip" aria-label="Reviewer routing summary">
          <ReviewerMetric label="Hot routes" value={hotRoutes} tone={hotRoutes ? "red" : "green"} />
          <ReviewerMetric label="Drafted" value={drafted} tone="blue" />
          <ReviewerMetric label="Balanced" value={balanced} tone="green" />
          <ReviewerMetric label="Overloaded" value={overloaded} tone={overloaded ? "red" : "green"} />
        </div>
      </div>

      <div className="reviewer-body">
        <div className="reviewer-route-list">
          <div className="reviewer-section-title">
            <GitPullRequest size={15} />
            <strong>Route queue</strong>
            <span>{visibleRoutes.length} visible</span>
          </div>
          {visibleRoutes.map((route) => (
            <div
              className={`reviewer-route-row route-${route.severity} status-${route.status} ${route.pr.id === selectedId ? "selected" : ""}`}
              key={route.id}
            >
              <button type="button" className="reviewer-route-main" onClick={() => onSelectPullRequest(route.pr.id)}>
                <span className="reviewer-route-icon">{iconForRouteKind(route.kind)}</span>
                <span className="reviewer-route-copy">
                  <strong>{route.title}</strong>
                  <small>{route.detail}</small>
                </span>
                <span className="reviewer-route-meta">
                  <StatusPill state={route.pr.state} />
                  <CiBadge state={route.pr.ci} />
                  <CodexBadge reaction={route.pr.codex.reaction} compact />
                </span>
              </button>
              <div className="reviewer-route-foot">
                <span>
                  <Users size={13} /> @{route.targetReviewer.login}
                </span>
                <span>
                  <TimerReset size={13} /> {route.ageLabel}
                </span>
                <button
                  type="button"
                  onClick={() => onCopyRoute(route)}
                  data-testid={`copy-review-route-${route.pr.number}`}
                >
                  <Copy size={13} />
                  Draft
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateRoute(
                      route.pr.id,
                      "rerouted",
                      route.alternateReviewer?.login ?? route.targetReviewer.login,
                    )
                  }
                  data-testid={`reroute-review-${route.pr.number}`}
                >
                  <Shuffle size={13} />
                  Reroute
                </button>
                <button type="button" onClick={() => onUpdateRoute(route.pr.id, "done", route.targetReviewer.login)}>
                  <CheckCircle2 size={13} />
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateRoute(route.pr.id, "muted", route.targetReviewer.login)}
                  aria-label={`Mute route for #${route.pr.number}`}
                >
                  <VolumeX size={13} />
                </button>
              </div>
            </div>
          ))}
          {!visibleRoutes.length && (
            <div className="reviewer-empty">
              <CheckCircle2 size={16} />
              No active review routes for this repo.
            </div>
          )}
        </div>

        <aside className="reviewer-capacity">
          <div className="reviewer-section-title">
            <Gauge size={15} />
            <strong>Capacity</strong>
            <span>{capacity.length} people</span>
          </div>
          <div className="capacity-list">
            {capacity.map((lane) => (
              <div className={`capacity-row capacity-${lane.tone}`} key={lane.reviewer.login}>
                <span className="capacity-row-head">
                  <strong>@{lane.reviewer.login}</strong>
                  <em>{lane.pending} pending · {lane.routed} routed</em>
                </span>
                <span className="capacity-bar" aria-hidden="true">
                  <span style={{ width: `${lane.utilization}%` }} />
                </span>
                <small>{lane.approved} approved · {lane.count} assigned</small>
              </div>
            ))}
          </div>
        </aside>

        <aside className="reviewer-policy">
          <div className="reviewer-section-title">
            <UserCheck size={15} />
            <strong>Route policy</strong>
          </div>
          <div className="reviewer-policy-grid">
            <PolicyCard label="Targeting" value={targetingSummary(activeRoutes)} />
            <PolicyCard label="Load cap" value={overloaded ? "rebalance now" : "under cap"} />
            <PolicyCard label="Last route" value={lastRouteSummary(routeMemory)} />
          </div>
          <div className="reviewer-template">
            <strong>Draft shape</strong>
            <p>PR number, target reviewer, current blocker, readiness, CI, and Codex state.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function ReviewerMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "blue" | "green" | "red";
}) {
  return (
    <div className={`reviewer-metric metric-${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function PolicyCard({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildReviewerCapacity(pullRequests: PullRequestSummary[]): ReviewerCapacity[] {
  const people = new Map<string, ReviewPerson>();
  const loads = new Map(getReviewerLoads(pullRequests).map((load) => [load.reviewer.login, load]));

  pullRequests.forEach((pr) => {
    addHuman(people, pr.author);
    pr.reviewers.forEach((reviewer) => addHuman(people, reviewer));
  });

  return [...people.values()]
    .map<ReviewerCapacity>((reviewer) => {
      const load = loads.get(reviewer.login);
      const pending = load?.pending ?? 0;

      return {
        reviewer,
        count: load?.count ?? 0,
        pending,
        approved: load?.approved ?? 0,
        tone: pending >= 3 ? "red" : pending >= 2 ? "amber" : "green",
      };
    })
    .sort(
      (a, b) =>
        b.pending - a.pending ||
        b.count - a.count ||
        a.reviewer.login.localeCompare(b.reviewer.login),
    );
}

function addHuman(people: Map<string, ReviewPerson>, person: ReviewPerson) {
  if (person.isCodex || people.has(person.login)) return;
  people.set(person.login, person);
}

function buildReviewerRoutes(
  pullRequests: PullRequestSummary[],
  reviewMemory: ReviewMemoryByPr,
  routeMemory: ReviewerRouteMemoryByPr,
  capacity: ReviewerCapacity[],
) {
  const referenceNow = getReferenceTime(pullRequests);

  return pullRequests
    .filter((pr) => pr.state !== "merged")
    .map((pr, index) => buildReviewerRoute(pr, index, reviewMemory, routeMemory, capacity, referenceNow))
    .filter((route): route is ReviewerRoute => Boolean(route))
    .sort((a, b) => routeScore(b) - routeScore(a));
}

function buildReviewerRoute(
  pr: PullRequestSummary,
  index: number,
  reviewMemory: ReviewMemoryByPr,
  routeMemory: ReviewerRouteMemoryByPr,
  capacity: ReviewerCapacity[],
  referenceNow: number,
): ReviewerRoute | undefined {
  const intel = getPrIntelligence(pr, index);
  const memory = reviewMemory[pr.id];
  const routeStatus = routeMemory[pr.id]?.status ?? "open";
  const humanReviewers = pr.reviewers.filter((reviewer) => !reviewer.isCodex);
  const ageHours = Math.max(0, (referenceNow - new Date(pr.updatedAt).getTime()) / 36e5);
  const readinessLabel = `${intel.readiness}/${intel.readinessTotal}`;
  const savedTarget = routeMemory[pr.id]?.targetReviewer;

  let kind: ReviewerRouteKind | undefined;
  let severity: ReviewerRouteSeverity = "medium";
  let title = "";
  let detail = "";
  let reason = "";

  if (pr.ci === "failure" || pr.state === "changes_requested" || memory?.decision === "blocked") {
    kind = "author";
    severity = "critical";
    title = `Return #${pr.number} to @${pr.author.login}`;
    detail = pr.ci === "failure" ? pr.ciSummary : "Requested changes are blocking the stack.";
    reason = "Author unblock";
  } else if (!pr.isDraft && humanReviewers.length === 0) {
    kind = "missing";
    severity = "high";
    title = `Assign reviewer for #${pr.number}`;
    detail = `No human reviewer · ${readinessLabel} ready · ${pr.ciSummary}`;
    reason = "Missing reviewer";
  } else if (pr.state === "waiting_review") {
    kind = "reviewer";
    severity = ageHours >= 4 ? "high" : "medium";
    title = `Route #${pr.number} review`;
    detail = `${humanReviewers.length || 1} assigned · ${formatAge(ageHours)} since last movement`;
    reason = "Waiting review";
  } else if (pr.isDraft && ageHours >= 2) {
    kind = "draft";
    severity = ageHours >= 12 ? "high" : "medium";
    title = `Keep #${pr.number} draft moving`;
    detail = `Draft updated ${formatRelativeTime(pr.updatedAt)} · ${readinessLabel} ready`;
    reason = "Draft aging";
  }

  if (!kind) return undefined;

  const suggested = chooseTargetReviewer(pr, kind, capacity);
  const targetReviewer = savedTarget ? findReviewer(savedTarget, capacity, pr) : suggested;
  const alternateReviewer = chooseAlternateReviewer(pr, targetReviewer.login, capacity);

  const route: ReviewerRoute = {
    id: pr.id,
    pr,
    kind,
    severity,
    title,
    detail,
    reason,
    targetReviewer,
    alternateReviewer,
    message: "",
    ageHours,
    ageLabel: `${formatAge(ageHours)} stale`,
    readinessLabel,
    status: routeStatus,
  };

  return { ...route, message: formatRouteMessage(route) };
}

function getReferenceTime(pullRequests: PullRequestSummary[]) {
  const latestPrUpdate = Math.max(
    0,
    ...pullRequests.map((pr) => new Date(pr.updatedAt).getTime()).filter(Number.isFinite),
  );

  return Math.max(Date.now(), latestPrUpdate);
}

function chooseTargetReviewer(
  pr: PullRequestSummary,
  kind: ReviewerRouteKind,
  capacity: ReviewerCapacity[],
) {
  if (kind === "author" || kind === "draft") return findReviewer(pr.author.login, capacity, pr);

  const current = pr.reviewers
    .filter((reviewer) => !reviewer.isCodex)
    .map((reviewer) => findReviewer(reviewer.login, capacity, pr))
    .sort((a, b) => reviewerPressure(a.login, capacity) - reviewerPressure(b.login, capacity));

  if (current.length) return current[0];

  return (
    capacity
      .filter((lane) => lane.reviewer.login !== pr.author.login)
      .sort((a, b) => a.pending - b.pending || a.count - b.count || a.reviewer.login.localeCompare(b.reviewer.login))[0]
      ?.reviewer ?? pr.author
  );
}

function chooseAlternateReviewer(
  pr: PullRequestSummary,
  currentLogin: string,
  capacity: ReviewerCapacity[],
) {
  return capacity
    .filter((lane) => lane.reviewer.login !== currentLogin && lane.reviewer.login !== pr.author.login)
    .sort((a, b) => a.pending - b.pending || a.count - b.count || a.reviewer.login.localeCompare(b.reviewer.login))[0]
    ?.reviewer;
}

function findReviewer(login: string, capacity: ReviewerCapacity[], pr: PullRequestSummary) {
  return (
    capacity.find((lane) => lane.reviewer.login === login)?.reviewer ??
    pr.reviewers.find((reviewer) => reviewer.login === login) ??
    (pr.author.login === login ? pr.author : { login })
  );
}

function reviewerPressure(login: string, capacity: ReviewerCapacity[]) {
  const lane = capacity.find((item) => item.reviewer.login === login);
  return lane ? lane.pending * 10 + lane.count : 999;
}

function countRoutesByReviewer(routes: ReviewerRoute[]) {
  const counts = new Map<string, number>();

  routes.forEach((route) => {
    counts.set(route.targetReviewer.login, (counts.get(route.targetReviewer.login) ?? 0) + 1);
  });

  return counts;
}

function routeScore(route: ReviewerRoute) {
  const severity = route.severity === "critical" ? 100 : route.severity === "high" ? 70 : 40;
  const status = route.status === "open" ? 8 : route.status === "rerouted" ? 4 : 0;
  return severity + Math.min(28, route.ageHours * 3) + status;
}

function iconForRouteKind(kind: ReviewerRouteKind) {
  if (kind === "author") return <AlertTriangle size={15} />;
  if (kind === "missing") return <UserCheck size={15} />;
  if (kind === "draft") return <TimerReset size={15} />;
  return <Users size={15} />;
}

function targetingSummary(routes: ReviewerRoute[]) {
  const reviewerRoutes = routes.filter((route) => route.kind === "reviewer" || route.kind === "missing").length;
  const authorRoutes = routes.filter((route) => route.kind === "author" || route.kind === "draft").length;
  return `${reviewerRoutes} reviewer · ${authorRoutes} author`;
}

function lastRouteSummary(routeMemory: ReviewerRouteMemoryByPr) {
  const last = Object.values(routeMemory)
    .filter((memory) => memory.status !== "open")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

  return last ? `${last.status} ${formatRelativeTime(last.updatedAt)}` : "none yet";
}

function formatRouteMessage(route: ReviewerRoute) {
  return [
    `@${route.targetReviewer.login} can you take #${route.pr.number}?`,
    `${route.reason}: ${route.detail}`,
    `Readiness ${route.readinessLabel}; CI ${route.pr.ci}; Codex ${route.pr.codex.statusText}.`,
    route.pr.url ? `PR: ${route.pr.url}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatAge(hours: number) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 24) return `${Math.floor(hours)}h`;
  return `${Math.floor(hours / 24)}d`;
}
