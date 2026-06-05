import { Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from "react";
import { AutopilotPlaybookCenter } from "./components/AutopilotPlaybookCenter";
import {
  AutomationRule,
  AutomationStudio,
  defaultAutomationRules,
} from "./components/AutomationStudio";
import { BranchDriftBoard } from "./components/BranchDriftBoard";
import { BranchPanel } from "./components/BranchPanel";
import { ChangeRadarCenter } from "./components/ChangeRadarCenter";
import { CommandCenter } from "./components/CommandCenter";
import { CommandPalette } from "./components/CommandPalette";
import { FlowForecastBoard } from "./components/FlowForecastBoard";
import { GraphiteDashboard } from "./components/GraphiteDashboard";
import { GraphiteNavRail, type GraphiteNavItemId } from "./components/GraphiteNavRail";
import { Inspector } from "./components/Inspector";
import { NotificationCenter, buildNotificationSignals } from "./components/NotificationCenter";
import { OperationsDock } from "./components/OperationsDock";
import { PortfolioPulseDeck } from "./components/PortfolioPulseDeck";
import { PullRequestTable } from "./components/PullRequestTable";
import { RepoScopePopover } from "./components/RepoScopePopover";
import { ReviewInboxWorkbench } from "./components/ReviewInboxWorkbench";
import { ReviewSignalMatrix } from "./components/ReviewSignalMatrix";
import type { ReviewerRoute } from "./components/ReviewerLoadBalancer";
import type { ReviewFreshnessItem } from "./components/ReviewFreshnessRadar";
import type { WorkMode } from "./components/ReviewOpsPanel";
import type { ReviewNudge } from "./components/ReviewSlaCenter";
import { FilterId, FilterItem, Sidebar } from "./components/Sidebar";
import { SettingsDialog } from "./components/SettingsDialog";
import { StackCommandRail } from "./components/StackCommandRail";
import { StackTopologyBoard } from "./components/StackTopologyBoard";
import { TopBar } from "./components/TopBar";
import { WorkspaceLens, WorkspaceLensBar } from "./components/WorkspaceLensBar";
import { sampleTrackerData } from "./data/sampleData";
import { migrateAppDatabase, readDatabaseValue, writeDatabaseValue } from "./lib/appDatabase";
import { loadGitHubTracker } from "./lib/github";
import { getPrIntelligence } from "./lib/insights";
import { loadLocalGitSummary } from "./lib/localGit";
import {
  AttentionItemMemory,
  AttentionItemMemoryById,
  AttentionItemStatus,
  ActionJournalEntry,
  ActionJournalScope,
  ActionJournalTone,
  AutopilotPlaybookId,
  AutopilotPlaybookMemory,
  BranchCleanupDecisionByRef,
  BranchCleanupStatus,
  BatchExecutionMemory,
  BatchExecutionMode,
  ChangeRadarMemory,
  ChangeRadarMode,
  CodexSignal,
  CodexSignalMemory,
  CodexSignalMemoryByPr,
  CodexSignalMemoryStatus,
  ConnectionCheckMemory,
  ConnectionCheckMemoryById,
  ConnectionCheckStatus,
  DecisionScenarioMemory,
  DecisionScenarioMode,
  DigestComposerAudience,
  DigestComposerMemory,
  DigestComposerMode,
  DigestCopyMeta,
  LaunchCommandMemory,
  LaunchCommandMemoryById,
  LaunchCommandStatus,
  LocalGitSummary,
  MergeImpactMemory,
  MergeImpactMemoryByRepo,
  OutboundUpdate,
  OutboundUpdateStatus,
  PullRequestSummary,
  ReleaseForecastByRepo,
  ReleaseForecastSnapshot,
  ReviewChecklistKey,
  ReviewChatMessage,
  ReviewDecision,
  ReviewEvent,
  ReviewMemory,
  ReviewMemoryByPr,
  ReviewMemoryPatch,
  ReviewNudgeMemory,
  ReviewNudgeMemoryById,
  ReviewNudgeStatus,
  ReviewRunByRepo,
  ReviewRunSnapshot,
  ReviewThreadMemory,
  ReviewThreadMemoryById,
  ReviewThreadStatus,
  ReviewerRouteMemory,
  ReviewerRouteMemoryByPr,
  ReviewerRouteStatus,
  ShipRoomBriefMode,
  ShipRoomBriefSnapshot,
  StackPlanByRepo,
  StackPlanSnapshot,
  StackPlanStep,
  StackPlanStepKind,
  StackReviewMode,
  StackReviewNavigatorMemory,
  TestingBranchFlag,
  TestingBranchSuite,
  TrackerConfig,
  TrackerDataset,
  WorkspaceBriefActionMemory,
  WorkspaceBriefActionMemoryById,
  WorkspaceBriefActionStatus,
} from "./types";

const ActionJournal = lazy(() => import("./components/ActionJournal").then((module) => ({ default: module.ActionJournal })));
const AttentionInbox = lazy(() => import("./components/AttentionInbox").then((module) => ({ default: module.AttentionInbox })));
const BatchCommandCart = lazy(() => import("./components/BatchCommandCart").then((module) => ({ default: module.BatchCommandCart })));
const CodexSignalTracker = lazy(() => import("./components/CodexSignalTracker").then((module) => ({ default: module.CodexSignalTracker })));
const DailyDigestComposer = lazy(() => import("./components/DailyDigestComposer").then((module) => ({ default: module.DailyDigestComposer })));
const GitHubConnectionCenter = lazy(() => import("./components/GitHubConnectionCenter").then((module) => ({ default: module.GitHubConnectionCenter })));
const LaunchCommandStudio = lazy(() => import("./components/LaunchCommandStudio").then((module) => ({ default: module.LaunchCommandStudio })));
const LiveOpsTimeline = lazy(() => import("./components/LiveOpsTimeline").then((module) => ({ default: module.LiveOpsTimeline })));
const MergeImpactSimulator = lazy(() => import("./components/MergeImpactSimulator").then((module) => ({ default: module.MergeImpactSimulator })));
const MergeQueueTimeline = lazy(() => import("./components/MergeQueueTimeline").then((module) => ({ default: module.MergeQueueTimeline })));
const OutboundCommsCenter = lazy(() => import("./components/OutboundCommsCenter").then((module) => ({ default: module.OutboundCommsCenter })));
const PortfolioDecisionSimulator = lazy(() => import("./components/PortfolioDecisionSimulator").then((module) => ({ default: module.PortfolioDecisionSimulator })));
const ReleaseForecast = lazy(() => import("./components/ReleaseForecast").then((module) => ({ default: module.ReleaseForecast })));
const ReviewerLoadBalancer = lazy(() => import("./components/ReviewerLoadBalancer").then((module) => ({ default: module.ReviewerLoadBalancer })));
const ReviewCommandDeck = lazy(() => import("./components/ReviewCommandDeck").then((module) => ({ default: module.ReviewCommandDeck })));
const ReviewFreshnessRadar = lazy(() => import("./components/ReviewFreshnessRadar").then((module) => ({ default: module.ReviewFreshnessRadar })));
const ReviewOpsPanel = lazy(() => import("./components/ReviewOpsPanel").then((module) => ({ default: module.ReviewOpsPanel })));
const ReviewRunPlanner = lazy(() => import("./components/ReviewRunPlanner").then((module) => ({ default: module.ReviewRunPlanner })));
const ReviewSlaCenter = lazy(() => import("./components/ReviewSlaCenter").then((module) => ({ default: module.ReviewSlaCenter })));
const ReviewThreadResolver = lazy(() => import("./components/ReviewThreadResolver").then((module) => ({ default: module.ReviewThreadResolver })));
const ShipRoomBrief = lazy(() => import("./components/ShipRoomBrief").then((module) => ({ default: module.ShipRoomBrief })));
const StackGraph = lazy(() => import("./components/StackGraph").then((module) => ({ default: module.StackGraph })));
const StackReviewNavigator = lazy(() => import("./components/StackReviewNavigator").then((module) => ({ default: module.StackReviewNavigator })));
const StackSurgeryPlanner = lazy(() => import("./components/StackSurgeryPlanner").then((module) => ({ default: module.StackSurgeryPlanner })));
const TriageCommandBoard = lazy(() => import("./components/TriageCommandBoard").then((module) => ({ default: module.TriageCommandBoard })));
const WorkspaceBriefing = lazy(() => import("./components/WorkspaceBriefing").then((module) => ({ default: module.WorkspaceBriefing })));

const STORAGE_KEY = "gittrack.config";
const WORK_MODE_KEY = "gittrack.workMode";
const AUTOMATION_RULES_KEY = "gittrack.automationRules";
const REVIEW_MEMORY_KEY = "gittrack.reviewMemory";
const SHIP_ROOM_BRIEFS_KEY = "gittrack.shipRoomBriefs";
const SHIP_ROOM_MODE_KEY = "gittrack.shipRoomMode";
const REVIEW_NUDGES_KEY = "gittrack.reviewNudges";
const STACK_PLANS_KEY = "gittrack.stackPlans";
const MERGE_IMPACT_KEY = "gittrack.mergeImpact";
const CODEX_SIGNAL_MEMORY_KEY = "gittrack.codexSignalMemory";
const RELEASE_FORECASTS_KEY = "gittrack.releaseForecasts";
const REVIEWER_ROUTES_KEY = "gittrack.reviewerRoutes";
const REVIEW_RUNS_KEY = "gittrack.reviewRuns";
const WORKSPACE_LENS_KEY = "gittrack.workspaceLens";
const WORKSPACE_BRIEF_ACTIONS_KEY = "gittrack.workspaceBriefActions";
const LAUNCH_COMMANDS_KEY = "gittrack.launchCommands";
const CONNECTION_CHECKS_KEY = "gittrack.connectionChecks";
const CONNECTION_DIAGNOSTIC_KEY = "gittrack.connectionDiagnosticAt";
const ATTENTION_ITEMS_KEY = "gittrack.attentionItems";
const DECISION_SCENARIO_KEY = "gittrack.decisionScenario";
const ACTION_JOURNAL_KEY = "gittrack.actionJournal";
const DAILY_DIGEST_KEY = "gittrack.dailyDigest";
const OUTBOUND_UPDATES_KEY = "gittrack.outboundUpdates";
const BATCH_COMMAND_CART_KEY = "gittrack.batchCommandCart";
const STACK_REVIEW_NAVIGATOR_KEY = "gittrack.stackReviewNavigator";
const REVIEW_THREADS_KEY = "gittrack.reviewThreads";
const AUTOPILOT_PLAYBOOK_KEY = "gittrack.autopilotPlaybook";
const CHANGE_RADAR_KEY = "gittrack.changeRadar";
const NOTIFICATION_SEEN_KEY = "gittrack.notificationSeen";
const LOCAL_GIT_PATH_KEY = "gittrack.localGitPath";
const LOCAL_GIT_BOOKMARKS_KEY = "gittrack.localGitBookmarks";
const BRANCH_CLEANUP_KEY = "gittrack.branchCleanupDecisions";
const TESTING_BRANCH_SUITES_KEY = "gittrack.testingBranchSuites";
const PERSISTED_KEYS = [
  STORAGE_KEY,
  WORK_MODE_KEY,
  AUTOMATION_RULES_KEY,
  REVIEW_MEMORY_KEY,
  SHIP_ROOM_BRIEFS_KEY,
  SHIP_ROOM_MODE_KEY,
  REVIEW_NUDGES_KEY,
  STACK_PLANS_KEY,
  MERGE_IMPACT_KEY,
  CODEX_SIGNAL_MEMORY_KEY,
  RELEASE_FORECASTS_KEY,
  REVIEWER_ROUTES_KEY,
  REVIEW_RUNS_KEY,
  WORKSPACE_LENS_KEY,
  WORKSPACE_BRIEF_ACTIONS_KEY,
  LAUNCH_COMMANDS_KEY,
  CONNECTION_CHECKS_KEY,
  CONNECTION_DIAGNOSTIC_KEY,
  ATTENTION_ITEMS_KEY,
  DECISION_SCENARIO_KEY,
  ACTION_JOURNAL_KEY,
  DAILY_DIGEST_KEY,
  OUTBOUND_UPDATES_KEY,
  BATCH_COMMAND_CART_KEY,
  STACK_REVIEW_NAVIGATOR_KEY,
  REVIEW_THREADS_KEY,
  AUTOPILOT_PLAYBOOK_KEY,
  CHANGE_RADAR_KEY,
  NOTIFICATION_SEEN_KEY,
  LOCAL_GIT_PATH_KEY,
  LOCAL_GIT_BOOKMARKS_KEY,
  BRANCH_CLEANUP_KEY,
  TESTING_BRANCH_SUITES_KEY,
];

migrateAppDatabase(PERSISTED_KEYS);

const GRAPHITE_NAV_TARGETS: Record<GraphiteNavItemId, string> = {
  inbox: "review-inbox-workbench",
  stacks: "stack-topology-board",
  pull_requests: "review-signal-matrix",
  branches: "branch-drift-board",
  reviews: "change-radar",
  automation: "autopilot-playbook-center",
};

const GRAPHITE_NAV_SCROLL_ORDER: GraphiteNavItemId[] = ["stacks", "branches", "pull_requests", "inbox", "reviews", "automation"];

const GRAPHITE_NAV_LABELS: Record<GraphiteNavItemId, string> = {
  inbox: "review inbox",
  stacks: "stack topology",
  pull_requests: "pull request matrix",
  branches: "branch drift board",
  reviews: "change radar",
  automation: "autopilot playbook",
};

const SECONDARY_GRAPHITE_NAV_ITEMS = new Set<GraphiteNavItemId>([
  "pull_requests",
  "branches",
  "reviews",
  "automation",
]);

const checklistDefaults: Record<ReviewChecklistKey, boolean> = {
  read_diff: false,
  validated_ci: false,
  checked_codex: false,
  ready_to_merge: false,
};

const defaultConfig: TrackerConfig = {
  token: "",
  repoSlugs: [],
};

export default function App() {
  const [config, setConfig] = useState<TrackerConfig>(loadStoredConfig);
  const [data, setData] = useState<TrackerDataset>(sampleTrackerData);
  const [source, setSource] = useState<"sample" | "github">("sample");
  const [activeRepo, setActiveRepo] = useState(sampleTrackerData.repos[0]?.slug ?? "");
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [selectedPrId, setSelectedPrId] = useState(sampleTrackerData.pullRequests[0]?.id);
  const [query, setQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [workMode, setWorkMode] = useState<WorkMode>(loadStoredWorkMode);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>(loadStoredAutomationRules);
  const [reviewMemory, setReviewMemory] = useState<ReviewMemoryByPr>(loadStoredReviewMemory);
  const [shipRoomMode, setShipRoomMode] = useState<ShipRoomBriefMode>(loadStoredShipRoomMode);
  const [shipRoomBriefs, setShipRoomBriefs] = useState<ShipRoomBriefSnapshot[]>(loadStoredShipRoomBriefs);
  const [reviewNudges, setReviewNudges] = useState<ReviewNudgeMemoryById>(loadStoredReviewNudges);
  const [stackPlans, setStackPlans] = useState<StackPlanByRepo>(loadStoredStackPlans);
  const [mergeImpact, setMergeImpact] = useState<MergeImpactMemoryByRepo>(loadStoredMergeImpact);
  const [codexSignalMemory, setCodexSignalMemory] = useState<CodexSignalMemoryByPr>(loadStoredCodexSignalMemory);
  const [releaseForecasts, setReleaseForecasts] = useState<ReleaseForecastByRepo>(loadStoredReleaseForecasts);
  const [reviewerRoutes, setReviewerRoutes] = useState<ReviewerRouteMemoryByPr>(loadStoredReviewerRoutes);
  const [reviewRuns, setReviewRuns] = useState<ReviewRunByRepo>(loadStoredReviewRuns);
  const [workspaceLens, setWorkspaceLens] = useState<WorkspaceLens>(loadStoredWorkspaceLens);
  const [workspaceBriefActions, setWorkspaceBriefActions] =
    useState<WorkspaceBriefActionMemoryById>(loadStoredWorkspaceBriefActions);
  const [launchCommands, setLaunchCommands] = useState<LaunchCommandMemoryById>(loadStoredLaunchCommands);
  const [connectionChecks, setConnectionChecks] = useState<ConnectionCheckMemoryById>(loadStoredConnectionChecks);
  const [connectionDiagnosticAt, setConnectionDiagnosticAt] = useState(loadStoredConnectionDiagnosticAt);
  const [attentionItems, setAttentionItems] = useState<AttentionItemMemoryById>(loadStoredAttentionItems);
  const [decisionScenario, setDecisionScenario] = useState<DecisionScenarioMemory>(loadStoredDecisionScenario);
  const [actionJournal, setActionJournal] = useState<ActionJournalEntry[]>(loadStoredActionJournal);
  const [dailyDigest, setDailyDigest] = useState<DigestComposerMemory>(loadStoredDailyDigest);
  const [outboundUpdates, setOutboundUpdates] = useState<OutboundUpdate[]>(loadStoredOutboundUpdates);
  const [batchCommandCart, setBatchCommandCart] = useState<BatchExecutionMemory>(loadStoredBatchCommandCart);
  const [stackReviewNavigator, setStackReviewNavigator] = useState<StackReviewNavigatorMemory>(loadStoredStackReviewNavigator);
  const [reviewThreads, setReviewThreads] = useState<ReviewThreadMemoryById>(loadStoredReviewThreads);
  const [autopilotPlaybook, setAutopilotPlaybook] = useState<AutopilotPlaybookMemory>(loadStoredAutopilotPlaybook);
  const [changeRadar, setChangeRadar] = useState<ChangeRadarMemory>(loadStoredChangeRadar);
  const [notificationSeenIds, setNotificationSeenIds] = useState<string[]>(loadStoredNotificationSeenIds);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [repoScopeOpen, setRepoScopeOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [activeNavItem, setActiveNavItem] = useState<GraphiteNavItemId>("inbox");
  const [secondarySystemsOpen, setSecondarySystemsOpen] = useState(false);
  const [operatingPanelsOpen, setOperatingPanelsOpen] = useState(false);
  const [localGitPath, setLocalGitPath] = useState(loadStoredLocalGitPath);
  const [localGitBookmarks, setLocalGitBookmarks] = useState<string[]>(loadStoredLocalGitBookmarks);
  const [branchCleanupDecisions, setBranchCleanupDecisions] = useState<BranchCleanupDecisionByRef>(loadStoredBranchCleanupDecisions);
  const [localGitSummary, setLocalGitSummary] = useState<LocalGitSummary | undefined>();
  const [localGitLoading, setLocalGitLoading] = useState(false);
  const [localGitError, setLocalGitError] = useState<string | null>(null);
  const [testingBranchSuites, setTestingBranchSuites] = useState<TestingBranchSuite[]>(loadStoredTestingBranchSuites);

  useEffect(() => {
    if (!data.repos.some((repo) => repo.slug === activeRepo)) {
      setActiveRepo(data.repos[0]?.slug ?? "");
    }
  }, [activeRepo, data.repos]);

  const repoPullRequests = useMemo(
    () => data.pullRequests.filter((pr) => pr.repo === activeRepo),
    [activeRepo, data.pullRequests],
  );

  const repoBranches = useMemo(
    () => data.branches.filter((branch) => branch.repo === activeRepo),
    [activeRepo, data.branches],
  );

  const filteredPullRequests = useMemo(
    () => applyPrFilters(repoPullRequests, activeFilter, query, reviewMemory),
    [activeFilter, query, repoPullRequests, reviewMemory],
  );

  const visibleBranches = useMemo(
    () =>
      data.branches
        .filter((branch) => branch.repo === activeRepo)
        .filter((branch) => branch.name.toLowerCase().includes(query.toLowerCase()) || !query)
        .slice(0, 12),
    [activeRepo, data.branches, query],
  );

  const selectedPr =
    data.pullRequests.find((pr) => pr.id === selectedPrId) ??
    filteredPullRequests[0] ??
    repoPullRequests[0];

  useEffect(() => {
    if (selectedPr && selectedPr.id !== selectedPrId) {
      setSelectedPrId(selectedPr.id);
    }
  }, [selectedPr, selectedPrId]);

  const filters = useMemo(() => buildFilters(repoPullRequests), [repoPullRequests]);
  const activeRepoSummary = data.repos.find((repo) => repo.slug === activeRepo);
  const selectedMemory = selectedPr ? reviewMemory[selectedPr.id] ?? createReviewMemory() : undefined;
  const notificationSignals = useMemo(
    () => buildNotificationSignals(data.pullRequests, data.branches, reviewMemory),
    [data.branches, data.pullRequests, reviewMemory],
  );
  const unreadNotificationCount = useMemo(() => {
    const seen = new Set(notificationSeenIds);
    return notificationSignals.filter((signal) => !seen.has(signal.id)).length;
  }, [notificationSeenIds, notificationSignals]);
  const graphiteNavCounts = useMemo<Record<GraphiteNavItemId, number>>(
    () => ({
      inbox: filteredPullRequests.length,
      stacks: new Set(repoPullRequests.filter((pr) => pr.state !== "merged").map((pr, index) => getPrIntelligence(pr, index).stackName)).size,
      pull_requests: repoPullRequests.filter((pr) => pr.state !== "merged").length,
      branches: repoBranches.filter((branch) => branch.name !== activeRepoSummary?.defaultBranch).length,
      reviews: repoPullRequests.filter((pr) => pr.codex.exists || pr.reviewEvents.length || reviewMemory[pr.id]?.decision === "blocked").length,
      automation: automationRules.filter((rule) => rule.enabled).length,
    }),
    [activeRepoSummary?.defaultBranch, automationRules, filteredPullRequests.length, repoBranches, repoPullRequests, reviewMemory],
  );
  const reviewQueueIds = useMemo(
    () => filteredPullRequests.map((pr) => pr.id),
    [filteredPullRequests],
  );

  const navigateReviewQueue = (direction: 1 | -1) => {
    if (!reviewQueueIds.length) return;

    const currentIndex = reviewQueueIds.indexOf(selectedPr?.id ?? "");
    const safeIndex = currentIndex >= 0 ? currentIndex : direction > 0 ? -1 : 0;
    const nextIndex = (safeIndex + direction + reviewQueueIds.length) % reviewQueueIds.length;
    const nextId = reviewQueueIds[nextIndex];
    const nextPr = filteredPullRequests.find((pr) => pr.id === nextId);

    setSelectedPrId(nextId);
    if (nextPr) {
      setLastAction(`${direction > 0 ? "Next" : "Previous"} review selected: #${nextPr.number}.`);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (event.key === "Escape") {
        setPaletteOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onReviewShortcut = (event: KeyboardEvent) => {
      if (
        paletteOpen ||
        settingsOpen ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "j") {
        event.preventDefault();
        navigateReviewQueue(1);
        return;
      }

      if (key === "k") {
        event.preventDefault();
        navigateReviewQueue(-1);
        return;
      }

      if (!selectedPr) return;

      if (key === "a") {
        event.preventDefault();
        promoteCodexReaction(selectedPr.id);
        return;
      }

      if (key === "r") {
        event.preventDefault();
        setReviewDecision(selectedPr.id, "ready");
        return;
      }

      if (key === "m") {
        event.preventDefault();
        smartMerge(selectedPr.id);
      }
    };

    window.addEventListener("keydown", onReviewShortcut);
    return () => window.removeEventListener("keydown", onReviewShortcut);
  }, [filteredPullRequests, navigateReviewQueue, paletteOpen, selectedPr, settingsOpen]);

  useEffect(() => {
    const workspace = document.querySelector<HTMLElement>(".workspace");
    const topbar = document.querySelector<HTMLElement>(".topbar");

    const syncActiveNavItem = () => {
      const rootTop = workspace?.getBoundingClientRect().top ?? 0;
      const marker = rootTop + (topbar?.offsetHeight ?? 0) + 96;
      let nextItem: GraphiteNavItemId | undefined;

      GRAPHITE_NAV_SCROLL_ORDER.forEach((item) => {
        const target = document.getElementById(GRAPHITE_NAV_TARGETS[item]);
        if (!target) return;

        const rect = target.getBoundingClientRect();
        if (rect.top <= marker && rect.bottom > rootTop) {
          nextItem = item;
        }
      });

      if (nextItem) {
        const resolvedItem = nextItem;
        setActiveNavItem((current) => (current === resolvedItem ? current : resolvedItem));
      }
    };

    syncActiveNavItem();
    const frame = window.requestAnimationFrame(syncActiveNavItem);
    workspace?.addEventListener("scroll", syncActiveNavItem, { passive: true });
    window.addEventListener("resize", syncActiveNavItem);

    return () => {
      window.cancelAnimationFrame(frame);
      workspace?.removeEventListener("scroll", syncActiveNavItem);
      window.removeEventListener("resize", syncActiveNavItem);
    };
  }, []);

  useEffect(() => {
    writeDatabaseValue(WORK_MODE_KEY, workMode);
  }, [workMode]);

  useEffect(() => {
    writeDatabaseValue(AUTOMATION_RULES_KEY, JSON.stringify(automationRules));
  }, [automationRules]);

  useEffect(() => {
    writeDatabaseValue(REVIEW_MEMORY_KEY, JSON.stringify(reviewMemory));
  }, [reviewMemory]);

  useEffect(() => {
    writeDatabaseValue(SHIP_ROOM_MODE_KEY, shipRoomMode);
  }, [shipRoomMode]);

  useEffect(() => {
    writeDatabaseValue(SHIP_ROOM_BRIEFS_KEY, JSON.stringify(shipRoomBriefs));
  }, [shipRoomBriefs]);

  useEffect(() => {
    writeDatabaseValue(REVIEW_NUDGES_KEY, JSON.stringify(reviewNudges));
  }, [reviewNudges]);

  useEffect(() => {
    writeDatabaseValue(STACK_PLANS_KEY, JSON.stringify(stackPlans));
  }, [stackPlans]);

  useEffect(() => {
    writeDatabaseValue(MERGE_IMPACT_KEY, JSON.stringify(mergeImpact));
  }, [mergeImpact]);

  useEffect(() => {
    writeDatabaseValue(CODEX_SIGNAL_MEMORY_KEY, JSON.stringify(codexSignalMemory));
  }, [codexSignalMemory]);

  useEffect(() => {
    writeDatabaseValue(RELEASE_FORECASTS_KEY, JSON.stringify(releaseForecasts));
  }, [releaseForecasts]);

  useEffect(() => {
    writeDatabaseValue(REVIEWER_ROUTES_KEY, JSON.stringify(reviewerRoutes));
  }, [reviewerRoutes]);

  useEffect(() => {
    writeDatabaseValue(REVIEW_RUNS_KEY, JSON.stringify(reviewRuns));
  }, [reviewRuns]);

  useEffect(() => {
    writeDatabaseValue(WORKSPACE_LENS_KEY, workspaceLens);
  }, [workspaceLens]);

  useEffect(() => {
    writeDatabaseValue(WORKSPACE_BRIEF_ACTIONS_KEY, JSON.stringify(workspaceBriefActions));
  }, [workspaceBriefActions]);

  useEffect(() => {
    writeDatabaseValue(LAUNCH_COMMANDS_KEY, JSON.stringify(launchCommands));
  }, [launchCommands]);

  useEffect(() => {
    writeDatabaseValue(CONNECTION_CHECKS_KEY, JSON.stringify(connectionChecks));
  }, [connectionChecks]);

  useEffect(() => {
    if (connectionDiagnosticAt) {
      writeDatabaseValue(CONNECTION_DIAGNOSTIC_KEY, connectionDiagnosticAt);
    }
  }, [connectionDiagnosticAt]);

  useEffect(() => {
    writeDatabaseValue(ATTENTION_ITEMS_KEY, JSON.stringify(attentionItems));
  }, [attentionItems]);

  useEffect(() => {
    writeDatabaseValue(DECISION_SCENARIO_KEY, JSON.stringify(decisionScenario));
  }, [decisionScenario]);

  useEffect(() => {
    writeDatabaseValue(ACTION_JOURNAL_KEY, JSON.stringify(actionJournal));
  }, [actionJournal]);

  useEffect(() => {
    writeDatabaseValue(DAILY_DIGEST_KEY, JSON.stringify(dailyDigest));
  }, [dailyDigest]);

  useEffect(() => {
    writeDatabaseValue(OUTBOUND_UPDATES_KEY, JSON.stringify(outboundUpdates));
  }, [outboundUpdates]);

  useEffect(() => {
    writeDatabaseValue(BATCH_COMMAND_CART_KEY, JSON.stringify(batchCommandCart));
  }, [batchCommandCart]);

  useEffect(() => {
    writeDatabaseValue(STACK_REVIEW_NAVIGATOR_KEY, JSON.stringify(stackReviewNavigator));
  }, [stackReviewNavigator]);

  useEffect(() => {
    writeDatabaseValue(REVIEW_THREADS_KEY, JSON.stringify(reviewThreads));
  }, [reviewThreads]);

  useEffect(() => {
    writeDatabaseValue(AUTOPILOT_PLAYBOOK_KEY, JSON.stringify(autopilotPlaybook));
  }, [autopilotPlaybook]);

  useEffect(() => {
    writeDatabaseValue(CHANGE_RADAR_KEY, JSON.stringify(changeRadar));
  }, [changeRadar]);

  useEffect(() => {
    writeDatabaseValue(NOTIFICATION_SEEN_KEY, JSON.stringify(notificationSeenIds.slice(0, 240)));
  }, [notificationSeenIds]);

  useEffect(() => {
    writeDatabaseValue(LOCAL_GIT_PATH_KEY, localGitPath);
  }, [localGitPath]);

  useEffect(() => {
    writeDatabaseValue(LOCAL_GIT_BOOKMARKS_KEY, JSON.stringify(localGitBookmarks));
  }, [localGitBookmarks]);

  useEffect(() => {
    writeDatabaseValue(BRANCH_CLEANUP_KEY, JSON.stringify(branchCleanupDecisions));
  }, [branchCleanupDecisions]);

  useEffect(() => {
    writeDatabaseValue(TESTING_BRANCH_SUITES_KEY, JSON.stringify(testingBranchSuites));
  }, [testingBranchSuites]);

  useEffect(() => {
    void refreshLocalGit(localGitPath);
  }, []);

  useEffect(() => {
    if (!lastAction || lastAction.startsWith("Action journal cleared")) return;

    setActionJournal((current) => {
      const previous = current[0];
      const previousAt = previous ? new Date(previous.createdAt).getTime() : 0;

      if (previous?.message === lastAction && Date.now() - previousAt < 1500) {
        return current;
      }

      return [createActionJournalEntry(lastAction, activeRepo, selectedPr), ...current].slice(0, 80);
    });
  }, [lastAction]);

  const refresh = async (overrideConfig = config) => {
    if (!overrideConfig.repoSlugs.length) {
      setSettingsOpen(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const githubData = await loadGitHubTracker(overrideConfig);
      setData(githubData);
      setSource("github");
      setActiveRepo(githubData.repos[0]?.slug ?? "");
      setSelectedPrId(githubData.pullRequests[0]?.id);
      setSettingsOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to refresh GitHub data.");
    } finally {
      setLoading(false);
    }
  };

  const refreshLocalGit = async (pathOverride = localGitPath) => {
    setLocalGitLoading(true);
    setLocalGitError(null);

    try {
      const summary = await loadLocalGitSummary(pathOverride);
      setLocalGitSummary(summary);
      setLocalGitPath(summary.root);
      setLastAction(`Scanned local git repo ${summary.repoName}.`);
    } catch (caught) {
      setLocalGitError(caught instanceof Error ? caught.message : "Unable to scan local git repository.");
    } finally {
      setLocalGitLoading(false);
    }
  };

  const saveLocalGitBookmark = () => {
    const bookmark = (localGitSummary?.root ?? localGitPath).trim();
    if (!bookmark) return;

    setLocalGitBookmarks((current) => [bookmark, ...current.filter((item) => item !== bookmark)].slice(0, 8));
    setLastAction(`Saved local Git bookmark ${bookmark}.`);
  };

  const selectLocalGitBookmark = (bookmark: string) => {
    setLocalGitPath(bookmark);
    void refreshLocalGit(bookmark);
  };

  const removeLocalGitBookmark = (bookmark: string) => {
    setLocalGitBookmarks((current) => current.filter((item) => item !== bookmark));
    setLastAction(`Removed local Git bookmark ${bookmark}.`);
  };

  const updateBranchCleanupDecision = (refKey: string, status: BranchCleanupStatus) => {
    setBranchCleanupDecisions((current) => ({
      ...current,
      [refKey]: {
        status,
        updatedAt: new Date().toISOString(),
      },
    }));
    setLastAction(`Marked stale ref for ${status === "delete" ? "cleanup" : status}.`);
  };

  const createTestingBranchSuite = () => {
    const suite = createTestingSuite(localGitSummary, localGitPath);
    setTestingBranchSuites((current) => [suite, ...current]);
    setLastAction(`Created testing suite "${suite.name}".`);
  };

  const updateTestingBranchSuite = (id: string, patch: Partial<TestingBranchSuite>) => {
    setTestingBranchSuites((current) =>
      current.map((suite) =>
        suite.id === id ? { ...suite, ...patch, updatedAt: new Date().toISOString() } : suite,
      ),
    );
  };

  const deleteTestingBranchSuite = (id: string) => {
    setTestingBranchSuites((current) => current.filter((suite) => suite.id !== id));
    setLastAction("Removed testing branch suite.");
  };

  const addTestingBranchFlag = (suiteId: string) => {
    const nextFlag: TestingBranchFlag = {
      id: `flag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      key: "VITE_EXPERIMENT",
      value: "true",
      enabled: true,
    };
    setTestingBranchSuites((current) =>
      current.map((suite) =>
        suite.id === suiteId
          ? { ...suite, flags: [...suite.flags, nextFlag], updatedAt: new Date().toISOString() }
          : suite,
      ),
    );
  };

  const updateTestingBranchFlag = (
    suiteId: string,
    flagId: string,
    patch: Partial<TestingBranchFlag>,
  ) => {
    setTestingBranchSuites((current) =>
      current.map((suite) =>
        suite.id === suiteId
          ? {
              ...suite,
              flags: suite.flags.map((flag) => (flag.id === flagId ? { ...flag, ...patch } : flag)),
              updatedAt: new Date().toISOString(),
            }
          : suite,
      ),
    );
  };

  const deleteTestingBranchFlag = (suiteId: string, flagId: string) => {
    setTestingBranchSuites((current) =>
      current.map((suite) =>
        suite.id === suiteId
          ? {
              ...suite,
              flags: suite.flags.filter((flag) => flag.id !== flagId),
              updatedAt: new Date().toISOString(),
            }
          : suite,
      ),
    );
  };

  const copyTestingBranchSuite = (suite: TestingBranchSuite) => {
    const runMatrix = buildTestingSuiteRunMatrix(suite);
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(runMatrix).catch(() => undefined);
    }
    setLastAction(`Copied ${suite.branches.length || 1}-branch test matrix for "${suite.name}".`);
  };

  const saveConfig = (nextConfig: TrackerConfig, shouldRefresh: boolean) => {
    setConfig(nextConfig);
    writeDatabaseValue(STORAGE_KEY, JSON.stringify(nextConfig));

    if (!shouldRefresh) {
      setData(sampleTrackerData);
      setSource("sample");
      setActiveRepo(sampleTrackerData.repos[0]?.slug ?? "");
      setSelectedPrId(sampleTrackerData.pullRequests[0]?.id);
      setSettingsOpen(false);
      setError(null);
      return;
    }

    void refresh(nextConfig);
  };

  const promoteCodexReaction = (id: string) => {
    setData((current) => ({
      ...current,
      pullRequests: current.pullRequests.map((pr) =>
        pr.id === id
          ? {
              ...pr,
              codex: promoteCodex(pr),
              reviewers: pr.reviewers.some((reviewer) => reviewer.isCodex)
                ? pr.reviewers
                : [...pr.reviewers, { login: "Codex", role: "Bot", isCodex: true }],
            }
          : pr,
      ),
    }));
    setCodexSignalMemory((current) => ({
      ...current,
      [id]: {
        status: "open",
        updatedAt: new Date().toISOString(),
      },
    }));
    setLastAction("Codex review moved from eyes to thumbs up.");
  };

  const updateCodexSignalStatus = (id: string, status: CodexSignalMemoryStatus) => {
    const pr = data.pullRequests.find((item) => item.id === id);
    setCodexSignalMemory((current) => ({
      ...current,
      [id]: {
        status,
        updatedAt: new Date().toISOString(),
      },
    }));
    setLastAction(
      pr
        ? `#${pr.number} Codex signal ${status === "acknowledged" ? "acknowledged" : status}.`
        : `Codex signal ${status === "acknowledged" ? "acknowledged" : status}.`,
    );
  };

  const copyCodexSweep = (text: string, count: number) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setLastAction(count ? `Copied Codex signal sweep for ${count} ${pluralize("PR", count)}.` : "Copied empty Codex signal sweep.");
  };

  const startReviewRun = (snapshot: ReviewRunSnapshot) => {
    setReviewRuns((current) => ({ ...current, [snapshot.repo]: snapshot }));
    setLastAction(`Started review run for ${snapshot.repo}.`);
  };

  const toggleReviewRunStep = (snapshot: ReviewRunSnapshot, stepId: string) => {
    const completed = new Set(snapshot.completedStepIds);
    const wasComplete = completed.has(stepId);

    if (wasComplete) {
      completed.delete(stepId);
    } else {
      completed.add(stepId);
    }

    const nextSnapshot: ReviewRunSnapshot = {
      ...snapshot,
      activeStepId: wasComplete ? stepId : snapshot.activeStepId === stepId ? undefined : snapshot.activeStepId,
      completedStepIds: [...completed],
    };

    setReviewRuns((current) => ({ ...current, [snapshot.repo]: nextSnapshot }));
    setLastAction(wasComplete ? "Review run step reopened." : "Review run step completed.");
  };

  const copyReviewRun = (text: string, stepCount: number) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setLastAction(stepCount ? `Copied review run with ${stepCount} ${pluralize("step", stepCount)}.` : "Copied empty review run.");
  };

  const copyReviewSessionBrief = (text: string, count: number) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setLastAction(count ? `Copied review session brief for ${count} ${pluralize("PR", count)}.` : "Copied empty review session brief.");
  };

  const copyFlowForecast = (text: string, count: number) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setLastAction(count ? `Copied flow forecast for ${count} active ${pluralize("PR", count)}.` : "Copied empty flow forecast.");
  };

  const copyBranchDriftPlan = (text: string, count: number) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setLastAction(count ? `Copied branch drift plan for ${count} ${pluralize("branch", count)}.` : "Copied empty branch drift plan.");
  };

  const copyPortfolioBrief = (text: string, count: number) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setLastAction(count ? `Copied portfolio pulse brief for ${count} active ${pluralize("PR", count)}.` : "Copied empty portfolio pulse brief.");
  };

  const copyReviewMatrix = (text: string, count: number) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setLastAction(count ? `Copied review matrix for ${count} active ${pluralize("PR", count)}.` : "Copied empty review matrix.");
  };

  const updateWorkspaceBriefAction = (id: string, status: WorkspaceBriefActionStatus) => {
    setWorkspaceBriefActions((current) => ({
      ...current,
      [id]: {
        status,
        updatedAt: new Date().toISOString(),
      },
    }));
    setLastAction(status === "done" ? "Workspace brief action completed." : `Workspace brief action ${status}.`);
  };

  const copyWorkspaceBrief = (text: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setLastAction("Copied workspace operating brief.");
  };

  const updateLaunchCommandStatus = (id: string, status: LaunchCommandStatus) => {
    setLaunchCommands((current) => ({
      ...current,
      [id]: {
        status,
        updatedAt: new Date().toISOString(),
      },
    }));
    setLastAction(status === "done" ? "Launch command marked done." : `Launch command ${status}.`);
  };

  const copyLaunchText = (text: string, label: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setLastAction(`Copied ${label}.`);
  };

  const updateConnectionCheckStatus = (id: string, status: ConnectionCheckStatus) => {
    setConnectionChecks((current) => ({
      ...current,
      [id]: {
        status,
        updatedAt: new Date().toISOString(),
      },
    }));
    setLastAction(status === "verified" ? "Connection check verified." : "Connection check reopened.");
  };

  const runConnectionDiagnostic = () => {
    setConnectionDiagnosticAt(new Date().toISOString());
    setLastAction(
      source === "github"
        ? `Connection diagnostic passed across ${data.repos.length} repos.`
        : "Connection diagnostic completed in sample mode.",
    );
  };

  const copyConnectionSetupBrief = (text: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setLastAction("Copied GitHub connection setup brief.");
  };

  const updateAttentionItemStatus = (id: string, status: AttentionItemStatus) => {
    setAttentionItems((current) => ({
      ...current,
      [id]: {
        status,
        updatedAt: new Date().toISOString(),
      },
    }));
    setLastAction(status === "done" ? "Attention item cleared." : status === "acknowledged" ? "Attention item acknowledged." : "Attention item reopened.");
  };

  const copyAttentionDigest = (text: string, count: number) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setLastAction(count ? `Copied attention digest with ${count} signals.` : "Copied empty attention digest.");
  };

  const openAttentionPullRequest = (repo: string, id: string) => {
    setActiveRepo(repo);
    setSelectedPrId(id);
    setActiveFilter("all");
    setQuery("");
    setLastAction(`Opened attention item in ${repo}.`);
  };

  const openCommandQueuePullRequest = (id: string) => {
    const pr = data.pullRequests.find((item) => item.id === id);
    if (pr) {
      setActiveRepo(pr.repo);
      setSelectedPrId(id);
      setActiveFilter("all");
      setQuery("");
      setLastAction(`Opened #${pr.number} from the command queue.`);
    }
  };

  const openAttentionRepo = (repo: string) => {
    setActiveRepo(repo);
    setActiveFilter("all");
    setQuery("");
    setLastAction(`Opened attention lane for ${repo}.`);
  };

  const switchRepoScope = (repo: string) => {
    setActiveRepo(repo);
    setSelectedPrId(data.pullRequests.find((pr) => pr.repo === repo)?.id ?? "");
    setActiveFilter("all");
    setQuery("");
    setRepoScopeOpen(false);
    setNotificationOpen(false);
    setLastAction(`Switched repository scope to ${repo}.`);
  };

  const markNotificationSeen = (id: string) => {
    setNotificationSeenIds((current) => (current.includes(id) ? current : [id, ...current].slice(0, 240)));
  };

  const markNotificationsSeen = (ids: string[]) => {
    setNotificationSeenIds((current) => [...new Set([...ids, ...current])].slice(0, 240));
    setLastAction(ids.length ? `Marked ${ids.length} ${pluralize("notification", ids.length)} seen.` : "No notifications to mark seen.");
  };

  const updateDecisionScenario = (mode: DecisionScenarioMode, selectedPrIds?: string[]) => {
    setDecisionScenario({
      mode,
      selectedPrIds,
      updatedAt: new Date().toISOString(),
    });
    if (selectedPrIds) {
      setLastAction(`Decision simulator loaded ${selectedPrIds.length} ${pluralize("PR", selectedPrIds.length)}.`);
    }
  };

  const applyDecisionPlan = (mode: DecisionScenarioMode, selectedPrIds: string[]) => {
    const selectedSet = new Set(selectedPrIds);
    const selected = data.pullRequests.filter((pr) => selectedSet.has(pr.id));

    if (!selected.length) {
      setLastAction("Decision simulator needs a selected PR set first.");
      return;
    }

    if (mode === "ai") {
      setData((current) => ({
        ...current,
        pullRequests: current.pullRequests.map((pr) =>
          selectedSet.has(pr.id)
            ? {
                ...pr,
                codex: promoteCodex(pr),
                reviewers: pr.reviewers.some((reviewer) => reviewer.isCodex)
                  ? pr.reviewers
                  : [...pr.reviewers, { login: "Codex", role: "Bot", isCodex: true }],
              }
            : pr,
        ),
      }));
      setCodexSignalMemory((current) => ({
        ...current,
        ...Object.fromEntries(
          selected.map((pr) => [
            pr.id,
            {
              status: "open" as const,
              updatedAt: new Date().toISOString(),
            },
          ]),
        ),
      }));
      setWorkspaceLens("ai");
      setLastAction(`Decision plan promoted AI coverage for ${selected.length} ${pluralize("PR", selected.length)}.`);
      return;
    }

    setReviewMemory((current) => {
      const next = { ...current };
      selected.forEach((pr) => {
        const existing = next[pr.id] ?? createReviewMemory();
        const readyChecklist =
          mode === "ship"
            ? {
                read_diff: true,
                validated_ci: true,
                checked_codex: true,
                ready_to_merge: true,
              }
            : existing.checklist;

        next[pr.id] = {
          ...existing,
          decision: mode === "ship" ? "ready" : mode === "unblock" ? "blocked" : "watch",
          pinned: mode === "review" || mode === "unblock" ? true : existing.pinned,
          snoozedUntil: undefined,
          checklist: {
            ...existing.checklist,
            ...readyChecklist,
          },
          updatedAt: new Date().toISOString(),
        };
      });
      return next;
    });

    if (mode === "ship") {
      setWorkspaceLens("ship");
      setLastAction(`Decision plan marked ${selected.length} ${pluralize("PR", selected.length)} ready for the merge train.`);
      return;
    }

    if (mode === "unblock") {
      setWorkspaceLens("focus");
      setActiveFilter("high-risk");
      setLastAction(`Decision plan pinned ${selected.length} ${pluralize("blocker", selected.length)} for unblock work.`);
      return;
    }

    setWorkspaceLens("focus");
    setLastAction(`Decision plan pinned ${selected.length} ${pluralize("review", selected.length)} into focus.`);
  };

  const copyDecisionPlan = (text: string, count: number) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setLastAction(count ? `Copied decision plan with ${count} ${pluralize("PR", count)}.` : "Copied empty decision plan.");
  };

  const copyActionJournal = (text: string, count: number) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setLastAction(count ? `Copied decision journal with ${count} ${count === 1 ? "entry" : "entries"}.` : "Copied empty decision journal.");
  };

  const updateDailyDigest = (patch: Partial<Omit<DigestComposerMemory, "updatedAt">>) => {
    setDailyDigest((current) => ({
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    }));
  };

  const copyDailyDigest = (text: string, lineCount: number, meta: DigestCopyMeta) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setOutboundUpdates((current) => [
      createOutboundUpdate(text, lineCount, meta, data.pullRequests),
      ...current,
    ].slice(0, 36));
    setLastAction(lineCount ? `Copied daily digest with ${lineCount} lines and added it to comms outbox.` : "Copied empty daily digest.");
  };

  const copyOutboundUpdate = (id: string, body: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(body).catch(() => undefined);
    }
    const update = outboundUpdates.find((item) => item.id === id);
    setLastAction(update ? `Copied ${update.title} from comms outbox.` : "Copied outbound update.");
  };

  const updateOutboundUpdateStatus = (id: string, status: OutboundUpdateStatus) => {
    setOutboundUpdates((current) =>
      current.map((update) =>
        update.id === id
          ? {
              ...update,
              status,
              updatedAt: new Date().toISOString(),
            }
          : update,
      ),
    );
    setLastAction(`Outbound update ${status}.`);
  };

  const clearSentOutboundUpdates = () => {
    setOutboundUpdates((current) => current.filter((update) => update.status !== "sent" && update.status !== "archived"));
    setLastAction("Cleared sent and archived outbound updates.");
  };

  const copyTriageBoard = (text: string, count: number) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setLastAction(count ? `Copied triage board with ${count} queue ${pluralize("card", count)}.` : "Copied empty triage board.");
  };

  const updateBatchCommandMode = (mode: BatchExecutionMode) => {
    setBatchCommandCart((current) => ({
      ...current,
      mode,
      updatedAt: new Date().toISOString(),
    }));
  };

  const toggleBatchCommandPr = (id: string, selected: boolean) => {
    setBatchCommandCart((current) => {
      const selectedIds = new Set(current.selectedPrIds);
      if (selected) {
        selectedIds.add(id);
      } else {
        selectedIds.delete(id);
      }

      return {
        ...current,
        selectedPrIds: [...selectedIds],
        updatedAt: new Date().toISOString(),
      };
    });
    const pr = data.pullRequests.find((item) => item.id === id);
    setLastAction(pr ? `#${pr.number} ${selected ? "added to" : "removed from"} batch command cart.` : "Batch command cart updated.");
  };

  const selectRecommendedBatch = (ids: string[]) => {
    setBatchCommandCart((current) => ({
      ...current,
      selectedPrIds: ids,
      updatedAt: new Date().toISOString(),
    }));
    setLastAction(ids.length ? `Loaded ${ids.length} recommended ${pluralize("PR", ids.length)} into batch command cart.` : "No recommended PRs for this batch mode.");
  };

  const clearBatchCommandCart = () => {
    setBatchCommandCart((current) => ({
      ...current,
      selectedPrIds: [],
      updatedAt: new Date().toISOString(),
    }));
    setLastAction("Cleared batch command cart.");
  };

  const runBatchCommand = (mode: BatchExecutionMode, ids: string[]) => {
    if (!ids.length) {
      setLastAction("Batch command cart needs selected PRs first.");
      return;
    }

    applyDecisionPlan(mode, ids);
    setBatchCommandCart((current) => ({
      ...current,
      selectedPrIds: ids,
      updatedAt: new Date().toISOString(),
    }));
    setLastAction(`Batch command ran ${mode} across ${ids.length} ${pluralize("PR", ids.length)}.`);
  };

  const copyBatchCommandPlan = (text: string, count: number) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setLastAction(count ? `Copied batch command plan with ${count} ${pluralize("PR", count)}.` : "Copied empty batch command plan.");
  };

  const updateStackReviewNavigator = (patch: Partial<StackReviewNavigatorMemory>) => {
    setStackReviewNavigator((current) =>
      createStackReviewNavigator({
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      }),
    );
  };

  const copyStackReviewPlan = (text: string, count: number) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setLastAction(count ? `Copied stack review plan with ${count} ${pluralize("PR", count)}.` : "Copied empty stack review plan.");
  };

  const copyStackTopologyPlan = (text: string, count: number) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setLastAction(count ? `Copied stack topology map with ${count} ${pluralize("node", count)}.` : "Copied empty stack topology map.");
  };

  const updateReviewThreadStatus = (threadId: string, status: ReviewThreadStatus) => {
    setReviewThreads((current) => ({
      ...current,
      [threadId]: {
        status,
        updatedAt: new Date().toISOString(),
      },
    }));
    setLastAction(`Review thread ${status}.`);
  };

  const copyReviewThreadReply = (threadId: string, prId: string, text: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setReviewThreads((current) => ({
      ...current,
      [threadId]: {
        status: "drafted",
        updatedAt: new Date().toISOString(),
      },
    }));
    const pr = data.pullRequests.find((item) => item.id === prId);
    setLastAction(pr ? `Drafted review-thread reply for #${pr.number}.` : "Drafted review-thread reply.");
  };

  const selectAutopilotPlaybook = (id: AutopilotPlaybookId) => {
    setAutopilotPlaybook((current) =>
      createAutopilotPlaybook({
        ...current,
        activePlaybookId: id,
        completedStepIds: [],
        updatedAt: new Date().toISOString(),
      }),
    );
    setLastAction(`Opened ${playbookLabel(id)} playbook.`);
  };

  const runAutopilotPlaybook = (id: AutopilotPlaybookId, stepIds: string[]) => {
    setAutopilotPlaybook(
      createAutopilotPlaybook({
        activePlaybookId: id,
        completedStepIds: stepIds,
        lastRunAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );
    setLastAction(`Ran ${playbookLabel(id)} playbook with ${stepIds.length} ${pluralize("step", stepIds.length)}.`);
  };

  const toggleAutopilotStep = (stepId: string) => {
    setAutopilotPlaybook((current) => {
      const completed = new Set(current.completedStepIds);
      if (completed.has(stepId)) {
        completed.delete(stepId);
      } else {
        completed.add(stepId);
      }

      return createAutopilotPlaybook({
        ...current,
        completedStepIds: [...completed],
        updatedAt: new Date().toISOString(),
      });
    });
    setLastAction("Autopilot playbook step updated.");
  };

  const copyAutopilotPlaybook = (text: string, stepCount: number) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setLastAction(stepCount ? `Copied autopilot runbook with ${stepCount} ${pluralize("step", stepCount)}.` : "Copied empty autopilot runbook.");
  };

  const changeRadarMode = (mode: ChangeRadarMode) => {
    setChangeRadar((current) =>
      createChangeRadar({
        ...current,
        mode,
        updatedAt: new Date().toISOString(),
      }),
    );
    setLastAction(`Change radar switched to ${modeLabel(mode)}.`);
  };

  const acknowledgeChangeSignal = (id: string) => {
    setChangeRadar((current) =>
      createChangeRadar({
        ...current,
        acknowledgedSignalIds: current.acknowledgedSignalIds.includes(id)
          ? current.acknowledgedSignalIds
          : [id, ...current.acknowledgedSignalIds].slice(0, 240),
        updatedAt: new Date().toISOString(),
      }),
    );
    setLastAction("Change radar signal acknowledged.");
  };

  const checkpointChangeRadar = (ids: string[]) => {
    setChangeRadar((current) =>
      createChangeRadar({
        ...current,
        acknowledgedSignalIds: [...new Set([...ids, ...current.acknowledgedSignalIds])].slice(0, 240),
        lastCheckpointAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );
    setLastAction(ids.length ? `Change radar checkpoint saved with ${ids.length} ${pluralize("signal", ids.length)}.` : "Change radar checkpoint saved.");
  };

  const toggleTrackedChangePr = (id: string) => {
    const pr = data.pullRequests.find((item) => item.id === id);
    setChangeRadar((current) => {
      const tracked = new Set(current.trackedPrIds);
      if (tracked.has(id)) {
        tracked.delete(id);
      } else {
        tracked.add(id);
      }

      return createChangeRadar({
        ...current,
        trackedPrIds: [...tracked].slice(0, 80),
        updatedAt: new Date().toISOString(),
      });
    });
    setLastAction(pr ? `#${pr.number} ${changeRadar.trackedPrIds.includes(id) ? "removed from" : "added to"} change radar tracking.` : "Change radar tracking updated.");
  };

  const copyChangeRadarSweep = (text: string, count: number) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setLastAction(count ? `Copied change radar sweep with ${count} ${pluralize("signal", count)}.` : "Copied empty change radar sweep.");
  };

  const copyQuickCommandDraft = (label: string, text: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setLastAction(`Copied ${label} command draft.`);
  };

  const stageQuickCommandDraft = (label: string) => {
    setLastAction(`${label} command staged.`);
  };

  const revealSecondarySystem = (id: string) => {
    setSecondarySystemsOpen(true);
    window.requestAnimationFrame(() => scrollWorkspaceElementIntoView(id));
  };

  const revealOperatingPanel = (id: string) => {
    setOperatingPanelsOpen(true);
    window.requestAnimationFrame(() => scrollWorkspaceElementIntoView(id));
  };

  const openChangeRadar = () => {
    setWorkspaceLens("all");
    setPaletteOpen(false);
    revealSecondarySystem("change-radar");
    setLastAction("Opened change radar.");
  };

  const openBranchDriftBoard = () => {
    setWorkspaceLens("all");
    setPaletteOpen(false);
    revealSecondarySystem("branch-drift-board");
    setLastAction("Opened branch drift board.");
  };

  const openStackTopology = () => {
    setWorkspaceLens("all");
    setPaletteOpen(false);
    scrollWorkspaceElementIntoView("stack-topology-board");
    setLastAction("Opened stack topology map.");
  };

  const openMergeQueueTimeline = () => {
    setWorkspaceLens("ship");
    setPaletteOpen(false);
    revealOperatingPanel("merge-queue-timeline");
    setLastAction("Opened merge train timeline.");
  };

  const clearActionJournal = () => {
    setActionJournal([]);
    setLastAction("Action journal cleared from local memory.");
  };

  const smartMerge = (id: string) => {
    const pr = data.pullRequests.find((item) => item.id === id);
    setLastAction(pr ? `Smart merge queued for #${pr.number}.` : "Smart merge queued.");
    setPaletteOpen(false);
  };

  const updateReviewMemory = (id: string, patch: ReviewMemoryPatch) => {
    setReviewMemory((current) => {
      const existing = current[id] ?? createReviewMemory();
      const next: ReviewMemory = {
        ...existing,
        ...patch,
        checklist: {
          ...existing.checklist,
          ...(patch.checklist ?? {}),
        },
        updatedAt: new Date().toISOString(),
      };

      return { ...current, [id]: next };
    });
  };

  const setReviewDecision = (id: string, decision: ReviewDecision) => {
    const pr = data.pullRequests.find((item) => item.id === id);
    const readyChecklist =
      decision === "ready"
        ? {
            read_diff: true,
            validated_ci: true,
            checked_codex: true,
            ready_to_merge: true,
          }
        : undefined;

    updateReviewMemory(id, { decision, checklist: readyChecklist });
    setLastAction(pr ? `#${pr.number} marked ${decision}.` : `PR marked ${decision}.`);
    setPaletteOpen(false);
  };

  const markTriageDecision = (id: string, decision: ReviewDecision) => {
    const pr = data.pullRequests.find((item) => item.id === id);
    if (pr) {
      setActiveRepo(pr.repo);
      setSelectedPrId(id);
    }
    setReviewDecision(id, decision);
  };

  const toggleReviewPin = (id: string) => {
    const pr = data.pullRequests.find((item) => item.id === id);
    const pinned = !(reviewMemory[id]?.pinned ?? false);
    updateReviewMemory(id, { pinned, snoozedUntil: pinned ? undefined : reviewMemory[id]?.snoozedUntil });
    setLastAction(pr ? `#${pr.number} ${pinned ? "pinned to" : "removed from"} your review queue.` : "Review queue updated.");
    setPaletteOpen(false);
  };

  const pinReview = (id: string) => {
    const pr = data.pullRequests.find((item) => item.id === id);
    updateReviewMemory(id, { pinned: true, snoozedUntil: undefined });
    setSelectedPrId(id);
    setLastAction(pr ? `#${pr.number} pinned to your focus lane.` : "Review pinned to your focus lane.");
  };

  const pinTriageReview = (id: string) => {
    const pr = data.pullRequests.find((item) => item.id === id);
    if (pr) setActiveRepo(pr.repo);
    pinReview(id);
  };

  const snoozeReview = (id: string) => {
    const pr = data.pullRequests.find((item) => item.id === id);
    const snoozedUntil = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
    updateReviewMemory(id, { snoozedUntil, pinned: false, decision: "watch" });
    setLastAction(pr ? `#${pr.number} snoozed until tomorrow.` : "PR snoozed until tomorrow.");
    setPaletteOpen(false);
  };

  const toggleAutomationRule = (id: string) => {
    setAutomationRules((rules) =>
      rules.map((rule) => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule)),
    );
  };

  const runAutomationPlan = () => {
    const enabled = automationRules.filter((rule) => rule.enabled).length;
    setLastAction(`Autopilot ran ${enabled} active rules across ${repoPullRequests.length} PRs.`);
    setPaletteOpen(false);
  };

  const openWorkspaceBriefing = () => {
    setWorkspaceLens("all");
    setPaletteOpen(false);
    revealOperatingPanel("workspace-briefing");
    setLastAction("Opened workspace briefing.");
  };

  const openLaunchStudio = () => {
    setWorkspaceLens("all");
    setPaletteOpen(false);
    revealOperatingPanel("launch-command-studio");
    setLastAction("Opened PR launch studio.");
  };

  const openConnectionCenter = () => {
    setWorkspaceLens("all");
    setPaletteOpen(false);
    revealOperatingPanel("github-connection-center");
    setLastAction("Opened GitHub connection cockpit.");
  };

  const openAttentionInbox = () => {
    setWorkspaceLens("all");
    setPaletteOpen(false);
    revealOperatingPanel("attention-inbox");
    setLastAction("Opened attention inbox.");
  };

  const openDecisionSimulator = () => {
    setWorkspaceLens("all");
    setPaletteOpen(false);
    revealOperatingPanel("decision-simulator");
    setLastAction("Opened decision simulator.");
  };

  const openActionJournal = () => {
    setWorkspaceLens("all");
    setPaletteOpen(false);
    revealOperatingPanel("action-journal");
    setLastAction("Opened decision journal.");
  };

  const openDailyDigest = () => {
    setWorkspaceLens("all");
    setPaletteOpen(false);
    revealOperatingPanel("daily-digest-composer");
    setLastAction("Opened daily digest composer.");
  };

  const openOutboundComms = () => {
    setWorkspaceLens("all");
    setPaletteOpen(false);
    revealOperatingPanel("outbound-comms");
    setLastAction("Opened comms outbox.");
  };

  const openTriageBoard = () => {
    setWorkspaceLens("all");
    setPaletteOpen(false);
    revealOperatingPanel("triage-board");
    setLastAction("Opened triage command board.");
  };

  const openBatchCommandCart = () => {
    setWorkspaceLens("all");
    setPaletteOpen(false);
    revealOperatingPanel("batch-command-cart");
    setLastAction("Opened batch command cart.");
  };

  const openStackReviewNavigator = () => {
    setWorkspaceLens("all");
    setPaletteOpen(false);
    revealOperatingPanel("stack-review-navigator");
    setLastAction("Opened stack review navigator.");
  };

  const openReviewThreadResolver = () => {
    setWorkspaceLens("all");
    setPaletteOpen(false);
    revealOperatingPanel("review-thread-resolver");
    setLastAction("Opened review thread resolver.");
  };

  const openAutopilotPlaybookCenter = () => {
    setWorkspaceLens("all");
    setPaletteOpen(false);
    revealSecondarySystem("autopilot-playbook-center");
    setLastAction("Opened autopilot playbook center.");
  };

  const runMergeQueueTrain = () => {
    const ready = repoPullRequests.filter((pr) => {
      const memory = reviewMemory[pr.id];
      const snoozed = Boolean(memory?.snoozedUntil && new Date(memory.snoozedUntil).getTime() > Date.now());
      return (
        (memory?.decision === "ready" || pr.state === "approved") &&
        pr.ci === "success" &&
        memory?.decision !== "blocked" &&
        !snoozed &&
        !pr.isDraft
      );
    });

    setLastAction(
      ready.length
        ? `Merge train staged ${ready.length} PRs: ${ready.map((pr) => `#${pr.number}`).join(", ")}.`
        : "Merge train is waiting for a ready, unsnoozed PR with green CI.",
    );
    setPaletteOpen(false);
  };

  const saveShipRoomBrief = (brief: ShipRoomBriefSnapshot) => {
    setShipRoomBriefs((current) => [brief, ...current.filter((item) => item.id !== brief.id)].slice(0, 12));
    setLastAction(`Saved ${brief.mode} brief for ${brief.repo}.`);
  };

  const copyShipRoomBrief = (brief: ShipRoomBriefSnapshot) => {
    const text = formatBriefForClipboard(brief);
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setLastAction(`Copied ${brief.mode} brief for ${brief.repo}.`);
  };

  const updateReviewNudge = (id: string, status: ReviewNudgeStatus) => {
    setReviewNudges((current) => ({
      ...current,
      [id]: {
        status,
        updatedAt: new Date().toISOString(),
      },
    }));
    setLastAction(status === "muted" ? "Nudge muted." : status === "done" ? "Nudge marked done." : "Nudge updated.");
  };

  const copyReviewNudge = (nudge: ReviewNudge) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(nudge.message).catch(() => undefined);
    }
    updateReviewNudge(nudge.id, "copied");
    setLastAction(`Drafted nudge for #${nudge.pr.number}.`);
  };

  const verifyReviewFreshness = (id: string) => {
    const pr = data.pullRequests.find((item) => item.id === id);
    updateReviewMemory(id, {
      checklist: {
        read_diff: true,
        checked_codex: true,
      },
    });
    setLastAction(pr ? `Verified current diff freshness for #${pr.number}.` : "Verified current diff freshness.");
  };

  const copyFreshnessRereview = (item: ReviewFreshnessItem) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(item.message).catch(() => undefined);
    }
    setLastAction(`Drafted freshness re-review for #${item.pr.number}.`);
  };

  const saveStackPlan = (plan: StackPlanSnapshot) => {
    setStackPlans((current) => ({ ...current, [plan.repo]: plan }));
    setLastAction(`Saved stack surgery plan for ${plan.repo}.`);
  };

  const toggleStackPlanStep = (plan: StackPlanSnapshot, stepId: string) => {
    const currentStep = plan.steps.find((step) => step.id === stepId);
    const nextPlan: StackPlanSnapshot = {
      ...plan,
      createdAt: new Date().toISOString(),
      steps: plan.steps.map((step) => (step.id === stepId ? { ...step, done: !step.done } : step)),
    };

    setStackPlans((current) => ({ ...current, [plan.repo]: nextPlan }));
    setLastAction(
      currentStep
        ? `${currentStep.done ? "Reopened" : "Completed"} stack step: ${currentStep.title}.`
        : "Stack plan updated.",
    );
  };

  const copyStackPlan = (plan: StackPlanSnapshot) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(formatStackPlanForClipboard(plan)).catch(() => undefined);
    }
    setLastAction(`Copied stack surgery plan for ${plan.repo}.`);
  };

  const updateMergeImpactSelection = (repo: string, selectedPrIds: string[]) => {
    setMergeImpact((current) => ({
      ...current,
      [repo]: {
        selectedPrIds,
        updatedAt: new Date().toISOString(),
      },
    }));
  };

  const toggleMergeImpactPr = (id: string, nextSelected: boolean) => {
    const current = mergeImpact[activeRepo]?.selectedPrIds;
    const fallback = repoPullRequests
      .filter((pr, index) => isRecommendedForImpact(pr, index, reviewMemory))
      .map((pr) => pr.id);
    const selected = new Set(current ?? fallback);

    if (nextSelected) {
      selected.add(id);
    } else {
      selected.delete(id);
    }

    updateMergeImpactSelection(activeRepo, [...selected]);
    const pr = data.pullRequests.find((item) => item.id === id);
    setLastAction(pr ? `#${pr.number} ${nextSelected ? "added to" : "removed from"} merge impact simulation.` : "Merge impact simulation updated.");
  };

  const selectRecommendedImpact = (ids: string[]) => {
    updateMergeImpactSelection(activeRepo, ids);
    setLastAction(
      ids.length
        ? `Loaded ${ids.length} recommended ${pluralize("PR", ids.length)} into the merge impact simulation.`
        : "No recommended PRs are ready for simulation.",
    );
  };

  const clearMergeImpact = () => {
    updateMergeImpactSelection(activeRepo, []);
    setLastAction("Cleared merge impact simulation.");
  };

  const copyMergeImpactPlan = (text: string, count: number) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setLastAction(count ? `Copied merge impact plan for ${count} ${pluralize("PR", count)}.` : "Copied empty merge impact plan.");
  };

  const commitReleaseForecast = (forecast: ReleaseForecastSnapshot) => {
    setReleaseForecasts((current) => ({ ...current, [forecast.repo]: forecast }));
    setLastAction(`Committed release forecast for ${forecast.repo}: ${forecast.headline}.`);
  };

  const copyReleaseForecast = (text: string, readyCount: number) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setLastAction(
      readyCount
        ? `Copied release forecast with ${readyCount} ready ${pluralize("PR", readyCount)}.`
        : "Copied release forecast with no ready PRs yet.",
    );
  };

  const updateReviewerRoute = (id: string, status: ReviewerRouteStatus, targetReviewer?: string) => {
    const pr = data.pullRequests.find((item) => item.id === id);

    setReviewerRoutes((current) => ({
      ...current,
      [id]: {
        status,
        targetReviewer: targetReviewer ?? current[id]?.targetReviewer,
        updatedAt: new Date().toISOString(),
      },
    }));

    setLastAction(
      pr
        ? `#${pr.number} reviewer route ${status}${targetReviewer ? ` to @${targetReviewer}` : ""}.`
        : `Reviewer route ${status}.`,
    );
  };

  const copyReviewerRoute = (route: ReviewerRoute) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(route.message).catch(() => undefined);
    }
    updateReviewerRoute(route.pr.id, "drafted", route.targetReviewer.login);
    setLastAction(`Drafted reviewer route for #${route.pr.number} to @${route.targetReviewer.login}.`);
  };

  const changeWorkMode = (mode: WorkMode) => {
    setWorkMode(mode);

    if (mode === "focus") {
      setActiveFilter("all");
      setQuery("");
    }
    if (mode === "ship") {
      setActiveFilter("approved");
      setQuery("");
    }
    if (mode === "risk") {
      setActiveFilter("high-risk");
      setQuery("");
    }
    if (mode === "ai") {
      setActiveFilter("codex");
      setQuery("");
    }
  };

  const navigateGraphiteRail = (item: GraphiteNavItemId) => {
    setWorkspaceLens("all");
    setPaletteOpen(false);
    setActiveNavItem(item);
    const scrollToTarget = () => scrollWorkspaceElementIntoView(GRAPHITE_NAV_TARGETS[item]);

    if (item === "inbox" || item === "pull_requests") {
      setActiveFilter("all");
    }

    if (item === "reviews") {
      setActiveFilter("codex");
    }

    if (SECONDARY_GRAPHITE_NAV_ITEMS.has(item)) {
      setSecondarySystemsOpen(true);
      window.requestAnimationFrame(scrollToTarget);
    } else {
      scrollToTarget();
    }

    setLastAction(`Opened ${GRAPHITE_NAV_LABELS[item]}.`);
  };

  return (
    <>
      <GraphiteDashboard
        repos={data.repos}
        activeRepo={activeRepo}
        source={source}
        query={query}
        loading={loading}
        pullRequests={repoPullRequests}
        branches={repoBranches}
        selectedPrId={selectedPr?.id}
        reviewMemory={reviewMemory}
        localGitPath={localGitPath}
        localGitBookmarks={localGitBookmarks}
        branchCleanupDecisions={branchCleanupDecisions}
        localGitSummary={localGitSummary}
        localGitLoading={localGitLoading}
        localGitError={localGitError}
        testingBranchSuites={testingBranchSuites}
        onRepoChange={(repo) => {
          setActiveRepo(repo);
          setSelectedPrId(data.pullRequests.find((pr) => pr.repo === repo)?.id ?? "");
        }}
        onQueryChange={setQuery}
        onRefresh={() => void refresh()}
        onLocalGitPathChange={setLocalGitPath}
        onRefreshLocalGit={() => void refreshLocalGit(localGitPath)}
        onSaveLocalGitBookmark={saveLocalGitBookmark}
        onSelectLocalGitBookmark={selectLocalGitBookmark}
        onRemoveLocalGitBookmark={removeLocalGitBookmark}
        onUpdateBranchCleanupDecision={updateBranchCleanupDecision}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenCommandPalette={() => setPaletteOpen(true)}
        onSelectPullRequest={setSelectedPrId}
        onPromoteCodex={promoteCodexReaction}
        onCreateTestingSuite={createTestingBranchSuite}
        onUpdateTestingSuite={updateTestingBranchSuite}
        onDeleteTestingSuite={deleteTestingBranchSuite}
        onCopyTestingSuite={copyTestingBranchSuite}
        onAddTestingFlag={addTestingBranchFlag}
        onUpdateTestingFlag={updateTestingBranchFlag}
        onDeleteTestingFlag={deleteTestingBranchFlag}
      />

      <CommandPalette
        open={paletteOpen}
        pullRequests={repoPullRequests}
        onClose={() => setPaletteOpen(false)}
        onSelectPullRequest={setSelectedPrId}
        onOpenSettings={() => {
          setPaletteOpen(false);
          setSettingsOpen(true);
        }}
        onPromoteCodex={() => selectedPr && promoteCodexReaction(selectedPr.id)}
        onPinSelected={() => selectedPr && toggleReviewPin(selectedPr.id)}
        onSnoozeSelected={() => selectedPr && snoozeReview(selectedPr.id)}
        onMarkReady={() => selectedPr && setReviewDecision(selectedPr.id, "ready")}
        onSetQuery={setQuery}
        onSmartMerge={() => selectedPr && smartMerge(selectedPr.id)}
        onRunAutomationPlan={runAutomationPlan}
        onOpenWorkspaceBrief={openWorkspaceBriefing}
        onOpenLaunchStudio={openLaunchStudio}
        onOpenConnectionCenter={openConnectionCenter}
        onOpenAttentionInbox={openAttentionInbox}
        onOpenDecisionSimulator={openDecisionSimulator}
        onOpenActionJournal={openActionJournal}
        onOpenDailyDigest={openDailyDigest}
        onOpenOutboundComms={openOutboundComms}
        onOpenBatchCommandCart={openBatchCommandCart}
        onOpenChangeRadar={openChangeRadar}
        onOpenStackTopology={openStackTopology}
        onOpenStackReviewNavigator={openStackReviewNavigator}
        onOpenReviewThreadResolver={openReviewThreadResolver}
        onOpenAutopilotPlaybook={openAutopilotPlaybookCenter}
        onOpenTriageBoard={openTriageBoard}
        onModeChange={(mode) => {
          changeWorkMode(mode);
          setPaletteOpen(false);
        }}
      />

      <SettingsDialog
        open={settingsOpen}
        config={config}
        onClose={() => setSettingsOpen(false)}
        onSave={saveConfig}
      />
    </>
  );

  return (
    <div className="app-shell">
      <GraphiteNavRail
        activeItem={activeNavItem}
        counts={graphiteNavCounts}
        notificationCount={unreadNotificationCount}
        onNavigate={navigateGraphiteRail}
        onOpenCommandPalette={() => setPaletteOpen(true)}
        onOpenNotifications={() => {
          setRepoScopeOpen(false);
          setNotificationOpen((open) => !open);
        }}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <NotificationCenter
        open={notificationOpen}
        signals={notificationSignals}
        seenSignalIds={notificationSeenIds}
        onClose={() => setNotificationOpen(false)}
        onMarkSeen={markNotificationSeen}
        onMarkAllSeen={markNotificationsSeen}
        onOpenPullRequest={(repo, id) => {
          openAttentionPullRequest(repo, id);
          setNotificationOpen(false);
        }}
        onOpenRepo={(repo) => {
          openAttentionRepo(repo);
          setNotificationOpen(false);
        }}
        onPromoteCodex={(id) => {
          promoteCodexReaction(id);
          setNotificationOpen(false);
        }}
        onMarkReady={(id) => {
          markTriageDecision(id, "ready");
          setNotificationOpen(false);
        }}
        onOpenChangeRadar={() => {
          openChangeRadar();
          setNotificationOpen(false);
        }}
      />

      <RepoScopePopover
        open={repoScopeOpen}
        repos={data.repos}
        activeRepo={activeRepo}
        source={source}
        pullRequests={data.pullRequests}
        branches={data.branches}
        reviewMemory={reviewMemory}
        onClose={() => setRepoScopeOpen(false)}
        onSelectRepo={switchRepoScope}
        onOpenSettings={() => {
          setRepoScopeOpen(false);
          setSettingsOpen(true);
        }}
        onOpenConnectionCenter={() => {
          setRepoScopeOpen(false);
          openConnectionCenter();
        }}
      />

      <Sidebar
        repos={data.repos}
        activeRepo={activeRepo}
        filters={filters}
        activeFilter={activeFilter}
        onRepoChange={(repo) => {
          setActiveRepo(repo);
          setSelectedPrId(data.pullRequests.find((pr) => pr.repo === repo)?.id ?? "");
        }}
        onFilterChange={setActiveFilter}
        onAddRepo={() => setSettingsOpen(true)}
      />

      <main className="workspace">
        <TopBar
          connected={source === "github"}
          repoCount={data.repos.length}
          query={query}
          loading={loading}
          onQueryChange={setQuery}
          onRefresh={() => void refresh()}
          onRepoScope={() => {
            setNotificationOpen(false);
            setRepoScopeOpen((open) => !open);
          }}
          onSettings={() => setSettingsOpen(true)}
        />

        <CommandCenter
          activeRepo={activeRepoSummary?.slug ?? "No repository selected"}
          pullRequests={repoPullRequests}
          branches={repoBranches}
          reviewMemory={reviewMemory}
          onOpenCommandPalette={() => setPaletteOpen(true)}
          onRefresh={() => void refresh()}
          onOpenPullRequest={openCommandQueuePullRequest}
          onPromoteCodex={promoteCodexReaction}
          onSmartMerge={smartMerge}
          onOpenBranchDrift={openBranchDriftBoard}
          onOpenMergeQueue={openMergeQueueTimeline}
          onOpenStackReview={openStackReviewNavigator}
          onCopyCommandDraft={copyQuickCommandDraft}
          onStageCommandDraft={stageQuickCommandDraft}
        />

        <section className="workspace-stage stack-topology-stage">
          <StackTopologyBoard
            activeRepo={activeRepo}
            pullRequests={repoPullRequests}
            branches={repoBranches}
            reviewMemory={reviewMemory}
            selectedPrId={selectedPr?.id}
            onSelectPullRequest={setSelectedPrId}
            onPromoteCodex={promoteCodexReaction}
            onSmartMerge={smartMerge}
            onOpenBranchDrift={openBranchDriftBoard}
            onOpenStackReview={openStackReviewNavigator}
            onCopyTopologyPlan={copyStackTopologyPlan}
          />
        </section>

        <section className="workspace-stage review-inbox-stage">
          <ReviewInboxWorkbench
            pullRequests={filteredPullRequests}
            selectedId={selectedPr?.id}
            reviewMemory={reviewMemory}
            onSelectPullRequest={setSelectedPrId}
            onPromoteCodex={promoteCodexReaction}
            onMarkReady={(id) => markTriageDecision(id, "ready")}
            onSmartMerge={smartMerge}
            onSelectNext={() => navigateReviewQueue(1)}
            onSelectPrevious={() => navigateReviewQueue(-1)}
            onCopySessionBrief={copyReviewSessionBrief}
            onOpenStackReviewNavigator={openStackReviewNavigator}
            onOpenChangeRadar={openChangeRadar}
          />
        </section>

        <section className="workspace-stage secondary-systems-stage">
          <details
            className="secondary-systems"
            open={secondarySystemsOpen}
            onToggle={(event) => setSecondarySystemsOpen(event.currentTarget.open)}
          >
            <summary>
              <span>Secondary systems</span>
              <strong>Forecasts, branch drift, PR matrix, automation</strong>
              <em>{secondarySystemsOpen ? "Hide" : "Show"}</em>
            </summary>
            <div className="secondary-systems-body">
        <section className="workspace-stage portfolio-pulse-stage">
          <PortfolioPulseDeck
            repos={data.repos}
            pullRequests={data.pullRequests}
            branches={data.branches}
            reviewMemory={reviewMemory}
            activeRepo={activeRepo}
            onSelectRepo={(repo) => {
              setActiveRepo(repo);
              setSelectedPrId(data.pullRequests.find((pr) => pr.repo === repo)?.id ?? "");
            }}
            onOpenPullRequest={openAttentionPullRequest}
            onOpenChangeRadar={openChangeRadar}
            onOpenBatchCart={openBatchCommandCart}
            onCopyPortfolioBrief={copyPortfolioBrief}
          />
        </section>

        <section className="workspace-stage flow-forecast-stage">
          <FlowForecastBoard
            activeRepo={activeRepo}
            pullRequests={repoPullRequests}
            branches={repoBranches}
            reviewMemory={reviewMemory}
            selectedPrId={selectedPr?.id}
            onSelectPullRequest={setSelectedPrId}
            onPromoteCodex={promoteCodexReaction}
            onMarkReady={(id) => markTriageDecision(id, "ready")}
            onSmartMerge={smartMerge}
            onCopyForecast={copyFlowForecast}
            onOpenBatchCart={openBatchCommandCart}
          />
        </section>

        <section className="workspace-stage branch-drift-stage">
          <BranchDriftBoard
            activeRepo={activeRepo}
            branches={repoBranches}
            pullRequests={repoPullRequests}
            selectedPrId={selectedPr?.id}
            onOpenPullRequest={openAttentionPullRequest}
            onCopyDriftPlan={copyBranchDriftPlan}
            onOpenChangeRadar={openChangeRadar}
          />
        </section>

        <section className="workspace-stage review-matrix-stage">
          <ReviewSignalMatrix
            activeRepo={activeRepo}
            pullRequests={repoPullRequests}
            branches={repoBranches}
            reviewMemory={reviewMemory}
            selectedPrId={selectedPr?.id}
            onSelectPullRequest={setSelectedPrId}
            onPromoteCodex={promoteCodexReaction}
            onMarkReady={(id) => markTriageDecision(id, "ready")}
            onOpenChangeRadar={openChangeRadar}
            onCopyMatrix={copyReviewMatrix}
          />
        </section>

        <section className="workspace-stage stack-rail-stage">
          <StackCommandRail
            pullRequests={data.pullRequests}
            branches={data.branches}
            reviewMemory={reviewMemory}
            selectedPrId={selectedPr?.id}
            onOpenPullRequest={openAttentionPullRequest}
            onPromoteCodex={promoteCodexReaction}
            onMarkReady={(id) => markTriageDecision(id, "ready")}
            onSmartMerge={smartMerge}
            onOpenStackReviewNavigator={openStackReviewNavigator}
            onOpenChangeRadar={openChangeRadar}
          />
        </section>

        <section className="workspace-stage change-stage">
          <ChangeRadarCenter
            repos={data.repos}
            pullRequests={data.pullRequests}
            branches={data.branches}
            activity={data.activity}
            reviewMemory={reviewMemory}
            memory={changeRadar}
            selectedPrId={selectedPr?.id}
            onModeChange={changeRadarMode}
            onAcknowledgeSignal={acknowledgeChangeSignal}
            onCheckpoint={checkpointChangeRadar}
            onToggleTrackedPr={toggleTrackedChangePr}
            onCopySweep={copyChangeRadarSweep}
            onOpenPullRequest={openAttentionPullRequest}
            onOpenRepo={openAttentionRepo}
            onPromoteCodex={promoteCodexReaction}
            onMarkReady={(id) => markTriageDecision(id, "ready")}
          />
        </section>

        <section className="workspace-stage playbook-stage">
          <AutopilotPlaybookCenter
            repos={data.repos}
            pullRequests={data.pullRequests}
            reviewMemory={reviewMemory}
            reviewThreads={reviewThreads}
            memory={autopilotPlaybook}
            onSelectPlaybook={selectAutopilotPlaybook}
            onRunPlaybook={runAutopilotPlaybook}
            onToggleStep={toggleAutopilotStep}
            onCopyPlaybook={copyAutopilotPlaybook}
            onOpenStackNavigator={openStackReviewNavigator}
            onOpenThreadResolver={openReviewThreadResolver}
            onOpenBatchCart={openBatchCommandCart}
            onOpenDailyDigest={openDailyDigest}
            onOpenDecisionSimulator={openDecisionSimulator}
            onOpenTriageBoard={openTriageBoard}
            onPromoteCodex={promoteCodexReaction}
            onMarkReady={(id) => markTriageDecision(id, "ready")}
          />
        </section>
            </div>
          </details>
        </section>

        <LazyFeature
          label="operating panels"
          open={operatingPanelsOpen}
          onOpenChange={setOperatingPanelsOpen}
        >
        <section className="workspace-stage stack-review-stage">
          <StackReviewNavigator
            pullRequests={data.pullRequests}
            reviewMemory={reviewMemory}
            memory={stackReviewNavigator}
            selectedPrId={selectedPr?.id}
            onMemoryChange={updateStackReviewNavigator}
            onOpenPullRequest={openAttentionPullRequest}
            onPinReview={pinTriageReview}
            onPromoteCodex={promoteCodexReaction}
            onMarkReady={(id) => markTriageDecision(id, "ready")}
            onMarkBlocked={(id) => markTriageDecision(id, "blocked")}
            onSmartMerge={smartMerge}
            onCopyStackPlan={copyStackReviewPlan}
          />
        </section>

        <section className="workspace-stage thread-resolver-stage">
          <ReviewThreadResolver
            pullRequests={data.pullRequests}
            reviewMemory={reviewMemory}
            threadMemory={reviewThreads}
            selectedPrId={selectedPr?.id}
            onOpenPullRequest={openAttentionPullRequest}
            onThreadStatusChange={updateReviewThreadStatus}
            onCopyThreadReply={copyReviewThreadReply}
            onPromoteCodex={promoteCodexReaction}
            onMarkReady={(id) => markTriageDecision(id, "ready")}
            onMarkBlocked={(id) => markTriageDecision(id, "blocked")}
          />
        </section>

        <section className="workspace-stage triage-stage">
          <TriageCommandBoard
            repos={data.repos}
            pullRequests={data.pullRequests}
            reviewMemory={reviewMemory}
            selectedPrId={selectedPr?.id}
            onOpenPullRequest={openAttentionPullRequest}
            onMarkReady={(id) => markTriageDecision(id, "ready")}
            onMarkBlocked={(id) => markTriageDecision(id, "blocked")}
            onPinReview={pinTriageReview}
            onPromoteCodex={promoteCodexReaction}
            onSmartMerge={smartMerge}
            onCopyBoard={copyTriageBoard}
            onOpenDecisionSimulator={openDecisionSimulator}
          />
        </section>

        <section className="workspace-stage batch-stage">
          <BatchCommandCart
            pullRequests={data.pullRequests}
            reviewMemory={reviewMemory}
            memory={batchCommandCart}
            onModeChange={updateBatchCommandMode}
            onTogglePullRequest={toggleBatchCommandPr}
            onSelectRecommended={selectRecommendedBatch}
            onClearSelection={clearBatchCommandCart}
            onRunBatch={runBatchCommand}
            onCopyBatch={copyBatchCommandPlan}
            onOpenPullRequest={openAttentionPullRequest}
          />
        </section>

        <section className="workspace-stage attention-stage">
          <AttentionInbox
            repos={data.repos}
            pullRequests={data.pullRequests}
            branches={data.branches}
            activity={data.activity}
            reviewMemory={reviewMemory}
            attentionMemory={attentionItems}
            selectedPrId={selectedPr?.id}
            onOpenPullRequest={openAttentionPullRequest}
            onOpenRepo={openAttentionRepo}
            onUpdateItemStatus={updateAttentionItemStatus}
            onCopyDigest={copyAttentionDigest}
          />
        </section>

        <section className="workspace-stage decision-stage">
          <PortfolioDecisionSimulator
            repos={data.repos}
            pullRequests={data.pullRequests}
            branches={data.branches}
            reviewMemory={reviewMemory}
            scenario={decisionScenario}
            selectedPrId={selectedPr?.id}
            onScenarioChange={updateDecisionScenario}
            onOpenPullRequest={openAttentionPullRequest}
            onApplyPlan={applyDecisionPlan}
            onCopyPlan={copyDecisionPlan}
          />
        </section>

        <section className="workspace-stage journal-stage">
          <ActionJournal
            entries={actionJournal}
            activity={data.activity}
            activeRepo={activeRepo}
            onCopyJournal={copyActionJournal}
            onClearJournal={clearActionJournal}
            onOpenAttentionInbox={openAttentionInbox}
            onOpenDecisionSimulator={openDecisionSimulator}
          />
        </section>

        <section className="workspace-stage digest-stage">
          <DailyDigestComposer
            repos={data.repos}
            pullRequests={data.pullRequests}
            branches={data.branches}
            activity={data.activity}
            reviewMemory={reviewMemory}
            actionJournal={actionJournal}
            memory={dailyDigest}
            onMemoryChange={updateDailyDigest}
            onCopyDigest={copyDailyDigest}
            onOpenPullRequest={openAttentionPullRequest}
            onOpenTriageBoard={openTriageBoard}
            onOpenActionJournal={openActionJournal}
            onPromoteCodex={promoteCodexReaction}
            onMarkReady={(id) => markTriageDecision(id, "ready")}
          />
        </section>

        <section className="workspace-stage outbox-stage">
          <OutboundCommsCenter
            updates={outboundUpdates}
            pullRequests={data.pullRequests}
            onCopyUpdate={copyOutboundUpdate}
            onStatusChange={updateOutboundUpdateStatus}
            onOpenDailyDigest={openDailyDigest}
            onOpenPullRequest={openAttentionPullRequest}
            onClearSent={clearSentOutboundUpdates}
          />
        </section>

        <section className="workspace-stage connection-stage">
          <GitHubConnectionCenter
            config={config}
            source={source}
            loading={loading}
            error={error}
            repos={data.repos}
            pullRequests={data.pullRequests}
            branches={data.branches}
            checkMemory={connectionChecks}
            lastDiagnosticAt={connectionDiagnosticAt}
            onOpenSettings={() => setSettingsOpen(true)}
            onRefresh={() => void refresh()}
            onUseSampleData={() => saveConfig(config, false)}
            onRunDiagnostic={runConnectionDiagnostic}
            onCopySetupBrief={copyConnectionSetupBrief}
            onUpdateCheckStatus={updateConnectionCheckStatus}
          />
        </section>

        {error && (
          <div className="error-banner">
            <strong>GitHub refresh failed</strong>
            <span>{error}</span>
          </div>
        )}

        <section className="workspace-stage">
          <WorkspaceBriefing
            repo={activeRepo}
            pullRequests={repoPullRequests}
            branches={repoBranches}
            reviewMemory={reviewMemory}
            actionMemory={workspaceBriefActions}
            onSelectPullRequest={setSelectedPrId}
            onOpenLens={setWorkspaceLens}
            onSmartMerge={smartMerge}
            onPromoteCodex={promoteCodexReaction}
            onMarkDecision={setReviewDecision}
            onUpdateActionStatus={updateWorkspaceBriefAction}
            onCopyBrief={copyWorkspaceBrief}
          />

          <LaunchCommandStudio
            pullRequest={selectedPr}
            memory={selectedMemory}
            commandMemory={launchCommands}
            onCopyText={copyLaunchText}
            onUpdateCommandStatus={updateLaunchCommandStatus}
            onSmartMerge={smartMerge}
            onPromoteCodex={promoteCodexReaction}
          />

          <section className="content-grid">
            <BranchPanel branches={visibleBranches} />
            <PullRequestTable
              pullRequests={filteredPullRequests}
              selectedId={selectedPr?.id}
              reviewMemory={reviewMemory}
              onSelect={setSelectedPrId}
            />
          </section>

          <WorkspaceLensBar
            activeLens={workspaceLens}
            pullRequests={repoPullRequests}
            branchCount={visibleBranches.length}
            automationCount={automationRules.filter((rule) => rule.enabled).length}
            onChangeLens={setWorkspaceLens}
          />

          {isPanelVisible(workspaceLens, "deck") && (
            <ReviewCommandDeck
              pullRequests={repoPullRequests}
              reviewMemory={reviewMemory}
              selectedId={selectedPr?.id}
              onSelectPullRequest={setSelectedPrId}
              onPinPullRequest={pinReview}
              onSnoozePullRequest={snoozeReview}
              onMarkReady={(id) => setReviewDecision(id, "ready")}
              onSmartMerge={smartMerge}
              onPromoteCodex={promoteCodexReaction}
              onSetQuery={setQuery}
            />
          )}

          {isPanelVisible(workspaceLens, "run") && (
            <ReviewRunPlanner
              repo={activeRepo}
              pullRequests={repoPullRequests}
              reviewMemory={reviewMemory}
              run={reviewRuns[activeRepo]}
              selectedId={selectedPr?.id}
              onStartRun={startReviewRun}
              onToggleStep={toggleReviewRunStep}
              onCopyRun={copyReviewRun}
              onSelectPullRequest={setSelectedPrId}
              onSmartMerge={smartMerge}
              onPromoteCodex={promoteCodexReaction}
            />
          )}

          {isPanelVisible(workspaceLens, "codex") && (
            <CodexSignalTracker
              repo={activeRepo}
              pullRequests={repoPullRequests}
              signalMemory={codexSignalMemory}
              selectedId={selectedPr?.id}
              onSelectPullRequest={setSelectedPrId}
              onUpdateSignalStatus={updateCodexSignalStatus}
              onPromoteCodex={promoteCodexReaction}
              onCopySweep={copyCodexSweep}
            />
          )}

          {isPanelVisible(workspaceLens, "release") && (
            <ReleaseForecast
              repo={activeRepo}
              pullRequests={repoPullRequests}
              branches={visibleBranches}
              reviewMemory={reviewMemory}
              forecast={releaseForecasts[activeRepo]}
              selectedId={selectedPr?.id}
              onCommitForecast={commitReleaseForecast}
              onCopyForecast={copyReleaseForecast}
              onSelectPullRequest={setSelectedPrId}
              onSmartMerge={smartMerge}
            />
          )}

          {isPanelVisible(workspaceLens, "reviewer") && (
            <ReviewerLoadBalancer
              pullRequests={repoPullRequests}
              reviewMemory={reviewMemory}
              routeMemory={reviewerRoutes}
              selectedId={selectedPr?.id}
              onSelectPullRequest={setSelectedPrId}
              onUpdateRoute={updateReviewerRoute}
              onCopyRoute={copyReviewerRoute}
            />
          )}

          {isPanelVisible(workspaceLens, "brief") && (
            <ShipRoomBrief
              repo={activeRepo}
              activity={data.activity.filter((event) => event.repo === activeRepo)}
              pullRequests={repoPullRequests}
              reviewMemory={reviewMemory}
              briefs={shipRoomBriefs}
              mode={shipRoomMode}
              onModeChange={setShipRoomMode}
              onSaveBrief={saveShipRoomBrief}
              onCopyBrief={copyShipRoomBrief}
              onSelectPullRequest={setSelectedPrId}
            />
          )}

          {isPanelVisible(workspaceLens, "sla") && (
            <ReviewSlaCenter
              pullRequests={repoPullRequests}
              reviewMemory={reviewMemory}
              nudgeMemory={reviewNudges}
              selectedId={selectedPr?.id}
              onSelectPullRequest={setSelectedPrId}
              onUpdateNudge={updateReviewNudge}
              onCopyNudge={copyReviewNudge}
            />
          )}

          {isPanelVisible(workspaceLens, "freshness") && (
            <ReviewFreshnessRadar
              pullRequests={repoPullRequests}
              reviewMemory={reviewMemory}
              selectedId={selectedPr?.id}
              onSelectPullRequest={setSelectedPrId}
              onVerifyFreshness={verifyReviewFreshness}
              onCopyRereview={copyFreshnessRereview}
            />
          )}

          {isPanelVisible(workspaceLens, "surgery") && (
            <StackSurgeryPlanner
              repo={activeRepo}
              branches={visibleBranches}
              pullRequests={repoPullRequests}
              reviewMemory={reviewMemory}
              plan={stackPlans[activeRepo]}
              selectedId={selectedPr?.id}
              onSavePlan={saveStackPlan}
              onToggleStep={toggleStackPlanStep}
              onCopyPlan={copyStackPlan}
              onSelectPullRequest={setSelectedPrId}
              onSmartMerge={smartMerge}
            />
          )}

          {isPanelVisible(workspaceLens, "impact") && (
            <MergeImpactSimulator
              repo={activeRepo}
              pullRequests={repoPullRequests}
              reviewMemory={reviewMemory}
              selectedIds={mergeImpact[activeRepo]?.selectedPrIds}
              selectedPrId={selectedPr?.id}
              onTogglePullRequest={toggleMergeImpactPr}
              onSelectRecommended={selectRecommendedImpact}
              onClearPlan={clearMergeImpact}
              onCopyPlan={copyMergeImpactPlan}
              onSelectPullRequest={setSelectedPrId}
              onSmartMerge={smartMerge}
            />
          )}

          {isPanelVisible(workspaceLens, "queue") && (
            <MergeQueueTimeline
              pullRequests={repoPullRequests}
              reviewMemory={reviewMemory}
              selectedId={selectedPr?.id}
              onSelectPullRequest={setSelectedPrId}
              onRunQueue={runMergeQueueTrain}
              onSmartMerge={smartMerge}
            />
          )}

          {isPanelVisible(workspaceLens, "ops") && (
            <ReviewOpsPanel
              pullRequests={repoPullRequests}
              selectedId={selectedPr?.id}
              mode={workMode}
              onModeChange={changeWorkMode}
              onSelectPullRequest={setSelectedPrId}
              onSmartMerge={smartMerge}
              onPromoteCodex={promoteCodexReaction}
            />
          )}

          {isPanelVisible(workspaceLens, "automation") && (
            <AutomationStudio
              rules={automationRules}
              pullRequests={repoPullRequests}
              onToggleRule={toggleAutomationRule}
              onRunPlan={runAutomationPlan}
            />
          )}

          {isPanelVisible(workspaceLens, "timeline") && (
            <LiveOpsTimeline
              activity={data.activity.filter((event) => event.repo === activeRepo)}
              pullRequests={repoPullRequests}
              onSelectPullRequest={setSelectedPrId}
              onCopyUpdate={() => setLastAction("Generated standup update copied to your queue.")}
            />
          )}

          {isPanelVisible(workspaceLens, "graph") && (
            <StackGraph
              branches={visibleBranches}
              pullRequests={repoPullRequests}
              selectedId={selectedPr?.id}
              onSelect={setSelectedPrId}
            />
          )}
        </section>
        </LazyFeature>
      </main>

      <Inspector
        pullRequest={selectedPr}
        memory={selectedMemory}
        onUpdateMemory={(patch) => selectedPr && updateReviewMemory(selectedPr.id, patch)}
        onPromoteCodex={promoteCodexReaction}
        onSmartMerge={smartMerge}
        actionMessage={lastAction}
      />

      <OperationsDock
        selectedPr={selectedPr}
        selectedMemory={selectedMemory}
        workMode={workMode}
        source={source}
        queueCount={filteredPullRequests.length}
        lastAction={lastAction}
        onModeChange={changeWorkMode}
        onOpenCommandPalette={() => setPaletteOpen(true)}
        onPromoteCodex={() => selectedPr && promoteCodexReaction(selectedPr.id)}
        onMarkReady={() => selectedPr && setReviewDecision(selectedPr.id, "ready")}
        onSmartMerge={() => selectedPr && smartMerge(selectedPr.id)}
        onOpenLaunchStudio={openLaunchStudio}
        onOpenChangeRadar={openChangeRadar}
      />

      <CommandPalette
        open={paletteOpen}
        pullRequests={repoPullRequests}
        onClose={() => setPaletteOpen(false)}
        onSelectPullRequest={setSelectedPrId}
        onOpenSettings={() => {
          setPaletteOpen(false);
          setSettingsOpen(true);
        }}
        onPromoteCodex={() => selectedPr && promoteCodexReaction(selectedPr.id)}
        onPinSelected={() => selectedPr && toggleReviewPin(selectedPr.id)}
        onSnoozeSelected={() => selectedPr && snoozeReview(selectedPr.id)}
        onMarkReady={() => selectedPr && setReviewDecision(selectedPr.id, "ready")}
        onSetQuery={setQuery}
        onSmartMerge={() => selectedPr && smartMerge(selectedPr.id)}
        onRunAutomationPlan={runAutomationPlan}
        onOpenWorkspaceBrief={openWorkspaceBriefing}
        onOpenLaunchStudio={openLaunchStudio}
        onOpenConnectionCenter={openConnectionCenter}
        onOpenAttentionInbox={openAttentionInbox}
        onOpenDecisionSimulator={openDecisionSimulator}
        onOpenActionJournal={openActionJournal}
        onOpenDailyDigest={openDailyDigest}
        onOpenOutboundComms={openOutboundComms}
        onOpenBatchCommandCart={openBatchCommandCart}
        onOpenChangeRadar={openChangeRadar}
        onOpenStackTopology={openStackTopology}
        onOpenStackReviewNavigator={openStackReviewNavigator}
        onOpenReviewThreadResolver={openReviewThreadResolver}
        onOpenAutopilotPlaybook={openAutopilotPlaybookCenter}
        onOpenTriageBoard={openTriageBoard}
        onModeChange={(mode) => {
          changeWorkMode(mode);
          setPaletteOpen(false);
        }}
      />

      <SettingsDialog
        open={settingsOpen}
        config={config}
        onClose={() => setSettingsOpen(false)}
        onSave={saveConfig}
      />
    </div>
  );
}

function LazyFeature({
  label,
  children,
  open,
  onOpenChange,
}: {
  label: string;
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <section className="workspace-stage operating-panels-stage">
      <details
        className="operating-panels"
        open={open}
        onToggle={(event) => onOpenChange(event.currentTarget.open)}
      >
        <summary>
          <span>Advanced panels</span>
          <strong>Stack review, triage, digests, connection tools</strong>
          <em>{open ? "Hide" : "Show"}</em>
        </summary>
        <div className="operating-panels-body">
          <Suspense fallback={<FeatureLoading label={label} />}>
            {children}
          </Suspense>
        </div>
      </details>
    </section>
  );
}

function FeatureLoading({ label }: { label: string }) {
  return (
    <section className="workspace-stage">
      <div className="feature-loading">
        <span>Loading</span>
        <strong>{label}</strong>
      </div>
    </section>
  );
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function loadStoredConfig(): TrackerConfig {
  try {
    const raw = readDatabaseValue(STORAGE_KEY);
    return raw ? { ...defaultConfig, ...JSON.parse(raw) } : defaultConfig;
  } catch {
    return defaultConfig;
  }
}

function loadStoredLocalGitPath() {
  try {
    return readDatabaseValue(LOCAL_GIT_PATH_KEY) ?? "";
  } catch {
    return "";
  }
}

function loadStoredLocalGitBookmarks(): string[] {
  try {
    const raw = readDatabaseValue(LOCAL_GIT_BOOKMARKS_KEY);
    if (!raw) return [];

    const saved = JSON.parse(raw) as unknown;
    return Array.isArray(saved) ? saved.filter((path) => typeof path === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
}

function loadStoredBranchCleanupDecisions(): BranchCleanupDecisionByRef {
  try {
    const raw = readDatabaseValue(BRANCH_CLEANUP_KEY);
    if (!raw) return {};

    const saved = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(saved)
        .filter((entry): entry is [string, { status: BranchCleanupStatus; updatedAt: string }] =>
          isBranchCleanupDecision(entry[1]),
        ),
    );
  } catch {
    return {};
  }
}

function loadStoredTestingBranchSuites(): TestingBranchSuite[] {
  try {
    const raw = readDatabaseValue(TESTING_BRANCH_SUITES_KEY);
    if (!raw) return [];

    const saved = JSON.parse(raw) as unknown;
    return Array.isArray(saved) ? saved.filter(isTestingBranchSuite) : [];
  } catch {
    return [];
  }
}

function loadStoredWorkMode(): WorkMode {
  try {
    const value = readDatabaseValue(WORK_MODE_KEY);
    return value === "focus" || value === "ship" || value === "risk" || value === "ai" ? value : "focus";
  } catch {
    return "focus";
  }
}

function loadStoredWorkspaceLens(): WorkspaceLens {
  try {
    const value = readDatabaseValue(WORKSPACE_LENS_KEY);
    return isWorkspaceLens(value) ? value : "all";
  } catch {
    return "all";
  }
}

function loadStoredAutomationRules(): AutomationRule[] {
  try {
    const raw = readDatabaseValue(AUTOMATION_RULES_KEY);
    if (!raw) return defaultAutomationRules;

    const saved = JSON.parse(raw) as AutomationRule[];
    return defaultAutomationRules.map((rule) => ({
      ...rule,
      enabled: saved.find((savedRule) => savedRule.id === rule.id)?.enabled ?? rule.enabled,
    }));
  } catch {
    return defaultAutomationRules;
  }
}

function loadStoredShipRoomMode(): ShipRoomBriefMode {
  try {
    const value = readDatabaseValue(SHIP_ROOM_MODE_KEY);
    return isShipRoomMode(value) ? value : "standup";
  } catch {
    return "standup";
  }
}

function loadStoredShipRoomBriefs(): ShipRoomBriefSnapshot[] {
  try {
    const raw = readDatabaseValue(SHIP_ROOM_BRIEFS_KEY);
    if (!raw) return [];

    const saved = JSON.parse(raw) as unknown;
    return Array.isArray(saved) ? saved.filter(isShipRoomBrief).slice(0, 12) : [];
  } catch {
    return [];
  }
}

function loadStoredReviewNudges(): ReviewNudgeMemoryById {
  try {
    const raw = readDatabaseValue(REVIEW_NUDGES_KEY);
    if (!raw) return {};

    const saved = JSON.parse(raw) as Record<string, Partial<ReviewNudgeMemory>>;
    return Object.fromEntries(
      Object.entries(saved)
        .filter(([, memory]) => isReviewNudgeStatus(memory.status))
        .map(([id, memory]) => [
          id,
          {
            status: memory.status as ReviewNudgeStatus,
            updatedAt: typeof memory.updatedAt === "string" ? memory.updatedAt : new Date(0).toISOString(),
          },
        ]),
    );
  } catch {
    return {};
  }
}

function loadStoredStackPlans(): StackPlanByRepo {
  try {
    const raw = readDatabaseValue(STACK_PLANS_KEY);
    if (!raw) return {};

    const saved = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(saved).filter(([, plan]) => isStackPlanSnapshot(plan)),
    ) as StackPlanByRepo;
  } catch {
    return {};
  }
}

function loadStoredMergeImpact(): MergeImpactMemoryByRepo {
  try {
    const raw = readDatabaseValue(MERGE_IMPACT_KEY);
    if (!raw) return {};

    const saved = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(saved).filter(([, memory]) => isMergeImpactMemory(memory)),
    ) as MergeImpactMemoryByRepo;
  } catch {
    return {};
  }
}

function loadStoredCodexSignalMemory(): CodexSignalMemoryByPr {
  try {
    const raw = readDatabaseValue(CODEX_SIGNAL_MEMORY_KEY);
    if (!raw) return {};

    const saved = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(saved).filter(([, memory]) => isCodexSignalMemory(memory)),
    ) as CodexSignalMemoryByPr;
  } catch {
    return {};
  }
}

function loadStoredReleaseForecasts(): ReleaseForecastByRepo {
  try {
    const raw = readDatabaseValue(RELEASE_FORECASTS_KEY);
    if (!raw) return {};

    const saved = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(saved).filter(([, forecast]) => isReleaseForecastSnapshot(forecast)),
    ) as ReleaseForecastByRepo;
  } catch {
    return {};
  }
}

function loadStoredReviewerRoutes(): ReviewerRouteMemoryByPr {
  try {
    const raw = readDatabaseValue(REVIEWER_ROUTES_KEY);
    if (!raw) return {};

    const saved = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(saved).filter(([, memory]) => isReviewerRouteMemory(memory)),
    ) as ReviewerRouteMemoryByPr;
  } catch {
    return {};
  }
}

function loadStoredReviewRuns(): ReviewRunByRepo {
  try {
    const raw = readDatabaseValue(REVIEW_RUNS_KEY);
    if (!raw) return {};

    const saved = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(saved).filter(([, run]) => isReviewRunSnapshot(run)),
    ) as ReviewRunByRepo;
  } catch {
    return {};
  }
}

function loadStoredWorkspaceBriefActions(): WorkspaceBriefActionMemoryById {
  try {
    const raw = readDatabaseValue(WORKSPACE_BRIEF_ACTIONS_KEY);
    if (!raw) return {};

    const saved = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(saved).filter(([, memory]) => isWorkspaceBriefActionMemory(memory)),
    ) as WorkspaceBriefActionMemoryById;
  } catch {
    return {};
  }
}

function loadStoredLaunchCommands(): LaunchCommandMemoryById {
  try {
    const raw = readDatabaseValue(LAUNCH_COMMANDS_KEY);
    if (!raw) return {};

    const saved = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(saved).filter(([, memory]) => isLaunchCommandMemory(memory)),
    ) as LaunchCommandMemoryById;
  } catch {
    return {};
  }
}

function loadStoredConnectionChecks(): ConnectionCheckMemoryById {
  try {
    const raw = readDatabaseValue(CONNECTION_CHECKS_KEY);
    if (!raw) return {};

    const saved = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(saved).filter(([, memory]) => isConnectionCheckMemory(memory)),
    ) as ConnectionCheckMemoryById;
  } catch {
    return {};
  }
}

function loadStoredConnectionDiagnosticAt(): string | undefined {
  try {
    const value = readDatabaseValue(CONNECTION_DIAGNOSTIC_KEY);
    return value || undefined;
  } catch {
    return undefined;
  }
}

function loadStoredAttentionItems(): AttentionItemMemoryById {
  try {
    const raw = readDatabaseValue(ATTENTION_ITEMS_KEY);
    if (!raw) return {};

    const saved = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(saved).filter(([, memory]) => isAttentionItemMemory(memory)),
    ) as AttentionItemMemoryById;
  } catch {
    return {};
  }
}

function loadStoredDecisionScenario(): DecisionScenarioMemory {
  try {
    const raw = readDatabaseValue(DECISION_SCENARIO_KEY);
    if (!raw) return createDecisionScenario();

    const saved = JSON.parse(raw) as unknown;
    return isDecisionScenarioMemory(saved) ? saved : createDecisionScenario();
  } catch {
    return createDecisionScenario();
  }
}

function createDecisionScenario(seed: Partial<DecisionScenarioMemory> = {}): DecisionScenarioMemory {
  return {
    mode: isDecisionScenarioMode(seed.mode) ? seed.mode : "ship",
    selectedPrIds: Array.isArray(seed.selectedPrIds)
      ? seed.selectedPrIds.filter((id) => typeof id === "string")
      : undefined,
    updatedAt: typeof seed.updatedAt === "string" ? seed.updatedAt : new Date(0).toISOString(),
  };
}

function loadStoredActionJournal(): ActionJournalEntry[] {
  try {
    const raw = readDatabaseValue(ACTION_JOURNAL_KEY);
    if (!raw) return [];

    const saved = JSON.parse(raw) as unknown;
    return Array.isArray(saved) ? saved.filter(isActionJournalEntry).slice(0, 80) : [];
  } catch {
    return [];
  }
}

function loadStoredDailyDigest(): DigestComposerMemory {
  try {
    const raw = readDatabaseValue(DAILY_DIGEST_KEY);
    if (!raw) return createDailyDigestMemory();

    const saved = JSON.parse(raw) as unknown;
    return isDigestComposerMemory(saved) ? saved : createDailyDigestMemory();
  } catch {
    return createDailyDigestMemory();
  }
}

function createDailyDigestMemory(seed: Partial<DigestComposerMemory> = {}): DigestComposerMemory {
  return {
    mode: isDigestComposerMode(seed.mode) ? seed.mode : "slack",
    audience: isDigestComposerAudience(seed.audience) ? seed.audience : "team",
    includeAi: typeof seed.includeAi === "boolean" ? seed.includeAi : true,
    includeBlockers: typeof seed.includeBlockers === "boolean" ? seed.includeBlockers : true,
    includeShip: typeof seed.includeShip === "boolean" ? seed.includeShip : true,
    includeJournal: typeof seed.includeJournal === "boolean" ? seed.includeJournal : true,
    updatedAt: typeof seed.updatedAt === "string" ? seed.updatedAt : new Date(0).toISOString(),
  };
}

function loadStoredOutboundUpdates(): OutboundUpdate[] {
  try {
    const raw = readDatabaseValue(OUTBOUND_UPDATES_KEY);
    if (!raw) return [];

    const saved = JSON.parse(raw) as unknown;
    return Array.isArray(saved) ? saved.filter(isOutboundUpdate).slice(0, 36) : [];
  } catch {
    return [];
  }
}

function loadStoredBatchCommandCart(): BatchExecutionMemory {
  try {
    const raw = readDatabaseValue(BATCH_COMMAND_CART_KEY);
    if (!raw) return createBatchCommandCart();

    const saved = JSON.parse(raw) as unknown;
    return isBatchExecutionMemory(saved) ? saved : createBatchCommandCart();
  } catch {
    return createBatchCommandCart();
  }
}

function loadStoredStackReviewNavigator(): StackReviewNavigatorMemory {
  try {
    const raw = readDatabaseValue(STACK_REVIEW_NAVIGATOR_KEY);
    if (!raw) return createStackReviewNavigator();

    const saved = JSON.parse(raw) as unknown;
    return isStackReviewNavigatorMemory(saved) ? saved : createStackReviewNavigator();
  } catch {
    return createStackReviewNavigator();
  }
}

function loadStoredReviewThreads(): ReviewThreadMemoryById {
  try {
    const raw = readDatabaseValue(REVIEW_THREADS_KEY);
    if (!raw) return {};

    const saved = JSON.parse(raw) as unknown;
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};

    return Object.fromEntries(
      Object.entries(saved as Record<string, unknown>)
        .filter((entry): entry is [string, ReviewThreadMemory] => isReviewThreadMemory(entry[1])),
    );
  } catch {
    return {};
  }
}

function loadStoredAutopilotPlaybook(): AutopilotPlaybookMemory {
  try {
    const raw = readDatabaseValue(AUTOPILOT_PLAYBOOK_KEY);
    if (!raw) return createAutopilotPlaybook();

    const saved = JSON.parse(raw) as unknown;
    return isAutopilotPlaybookMemory(saved) ? saved : createAutopilotPlaybook();
  } catch {
    return createAutopilotPlaybook();
  }
}

function loadStoredChangeRadar(): ChangeRadarMemory {
  try {
    const raw = readDatabaseValue(CHANGE_RADAR_KEY);
    if (!raw) return createChangeRadar();

    const saved = JSON.parse(raw) as unknown;
    return isChangeRadarMemory(saved) ? saved : createChangeRadar();
  } catch {
    return createChangeRadar();
  }
}

function loadStoredNotificationSeenIds(): string[] {
  try {
    const raw = readDatabaseValue(NOTIFICATION_SEEN_KEY);
    if (!raw) return [];

    const saved = JSON.parse(raw) as unknown;
    return Array.isArray(saved) ? saved.filter((id) => typeof id === "string").slice(0, 240) : [];
  } catch {
    return [];
  }
}

function createBatchCommandCart(seed: Partial<BatchExecutionMemory> = {}): BatchExecutionMemory {
  return {
    mode: isBatchExecutionMode(seed.mode) ? seed.mode : "ship",
    selectedPrIds: Array.isArray(seed.selectedPrIds)
      ? seed.selectedPrIds.filter((id) => typeof id === "string")
      : [],
    updatedAt: typeof seed.updatedAt === "string" ? seed.updatedAt : new Date(0).toISOString(),
  };
}

function createStackReviewNavigator(seed: Partial<StackReviewNavigatorMemory> = {}): StackReviewNavigatorMemory {
  return {
    selectedStackKey: typeof seed.selectedStackKey === "string" ? seed.selectedStackKey : undefined,
    mode: isStackReviewMode(seed.mode) ? seed.mode : "bottom_up",
    includeMerged: typeof seed.includeMerged === "boolean" ? seed.includeMerged : false,
    updatedAt: typeof seed.updatedAt === "string" ? seed.updatedAt : new Date(0).toISOString(),
  };
}

function createAutopilotPlaybook(seed: Partial<AutopilotPlaybookMemory> = {}): AutopilotPlaybookMemory {
  return {
    activePlaybookId: isAutopilotPlaybookId(seed.activePlaybookId) ? seed.activePlaybookId : "morning_review",
    completedStepIds: Array.isArray(seed.completedStepIds)
      ? seed.completedStepIds.filter((id) => typeof id === "string")
      : [],
    lastRunAt: typeof seed.lastRunAt === "string" ? seed.lastRunAt : undefined,
    updatedAt: typeof seed.updatedAt === "string" ? seed.updatedAt : new Date(0).toISOString(),
  };
}

function createChangeRadar(seed: Partial<ChangeRadarMemory> = {}): ChangeRadarMemory {
  return {
    mode: isChangeRadarMode(seed.mode) ? seed.mode : "unseen",
    acknowledgedSignalIds: Array.isArray(seed.acknowledgedSignalIds)
      ? seed.acknowledgedSignalIds.filter((id) => typeof id === "string").slice(0, 240)
      : [],
    trackedPrIds: Array.isArray(seed.trackedPrIds)
      ? seed.trackedPrIds.filter((id) => typeof id === "string").slice(0, 80)
      : [],
    lastCheckpointAt: typeof seed.lastCheckpointAt === "string" ? seed.lastCheckpointAt : undefined,
    updatedAt: typeof seed.updatedAt === "string" ? seed.updatedAt : new Date(0).toISOString(),
  };
}

function createTestingSuite(summary: LocalGitSummary | undefined, repoPath: string): TestingBranchSuite {
  const now = new Date().toISOString();
  const candidateBranches =
    summary?.localBranches
      .filter((branch) => !branch.current && branch.name !== summary.defaultBranch)
      .slice(0, 4)
      .map((branch) => branch.name) ?? [];
  const fallbackBranch = summary?.currentBranch && summary.currentBranch !== "detached" ? [summary.currentBranch] : [];

  return {
    id: `suite-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    repoPath: summary?.root ?? repoPath,
    name: "UI flag sweep",
    branches: candidateBranches.length ? candidateBranches : fallbackBranch,
    command: "npm run test:ui -- --branch=$BRANCH",
    flags: [
      { id: `flag-${Date.now()}-ui`, key: "VITE_UI_TEST_MODE", value: "true", enabled: true },
      { id: `flag-${Date.now()}-branch`, key: "VITE_BRANCH_UNDER_TEST", value: "$BRANCH", enabled: true },
    ],
    notes: "Stores the branch matrix and env flags to run against each selected branch.",
    updatedAt: now,
  };
}

function buildTestingSuiteRunMatrix(suite: TestingBranchSuite) {
  const branches = suite.branches.length ? suite.branches : ["$BRANCH"];
  const envPrefix = suite.flags
    .filter((flag) => flag.enabled && flag.key.trim())
    .map((flag) => `${flag.key.trim()}=${quoteShellValue(flag.value)}`)
    .join(" ");
  const command = suite.command.trim() || "npm run test:ui -- --branch=$BRANCH";

  return branches
    .map((branch) => {
      const resolvedCommand = command.split("$BRANCH").join(branch);
      const resolvedEnv = envPrefix.split("$BRANCH").join(branch);
      return [resolvedEnv, resolvedCommand].filter(Boolean).join(" ");
    })
    .join("\n");
}

function quoteShellValue(value: string) {
  if (!value) return "''";
  if (/^[A-Za-z0-9_./:@-]+$/.test(value)) return value;
  return `'${value.split("'").join("'\"'\"'")}'`;
}

function isTestingBranchSuite(value: unknown): value is TestingBranchSuite {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const suite = value as Partial<TestingBranchSuite>;
  return (
    typeof suite.id === "string" &&
    typeof suite.name === "string" &&
    typeof suite.repoPath === "string" &&
    typeof suite.command === "string" &&
    typeof suite.notes === "string" &&
    typeof suite.updatedAt === "string" &&
    Array.isArray(suite.branches) &&
    suite.branches.every((branch) => typeof branch === "string") &&
    Array.isArray(suite.flags) &&
    suite.flags.every(isTestingBranchFlag)
  );
}

function isTestingBranchFlag(value: unknown): value is TestingBranchFlag {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const flag = value as Partial<TestingBranchFlag>;
  return (
    typeof flag.id === "string" &&
    typeof flag.key === "string" &&
    typeof flag.value === "string" &&
    typeof flag.enabled === "boolean"
  );
}

function isBranchCleanupDecision(value: unknown): value is { status: BranchCleanupStatus; updatedAt: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const decision = value as { status?: unknown; updatedAt?: unknown };
  return isBranchCleanupStatus(decision.status) && typeof decision.updatedAt === "string";
}

function isBranchCleanupStatus(value: unknown): value is BranchCleanupStatus {
  return value === "review" || value === "keep" || value === "delete";
}

function loadStoredReviewMemory(): ReviewMemoryByPr {
  try {
    const raw = readDatabaseValue(REVIEW_MEMORY_KEY);
    if (!raw) return {};

    const saved = JSON.parse(raw) as Record<string, Partial<ReviewMemory>>;
    return Object.fromEntries(
      Object.entries(saved).map(([id, memory]) => [id, createReviewMemory(memory)]),
    );
  } catch {
    return {};
  }
}

function createReviewMemory(seed: Partial<ReviewMemory> = {}): ReviewMemory {
  return {
    decision: isReviewDecision(seed.decision) ? seed.decision : "watch",
    note: typeof seed.note === "string" ? seed.note : "",
    checklist: {
      ...checklistDefaults,
      ...(seed.checklist ?? {}),
    },
    chat: Array.isArray(seed.chat) ? seed.chat.filter(isReviewChatMessage) : [],
    pinned: Boolean(seed.pinned),
    snoozedUntil: typeof seed.snoozedUntil === "string" ? seed.snoozedUntil : undefined,
    updatedAt: typeof seed.updatedAt === "string" ? seed.updatedAt : new Date(0).toISOString(),
  };
}

function isReviewDecision(value: unknown): value is ReviewDecision {
  return value === "watch" || value === "ready" || value === "blocked";
}

function isWorkspaceLens(value: unknown): value is WorkspaceLens {
  return value === "all" || value === "focus" || value === "ai" || value === "ship" || value === "ops";
}

function isShipRoomMode(value: unknown): value is ShipRoomBriefMode {
  return value === "standup" || value === "slack" || value === "release";
}

function isReviewNudgeStatus(value: unknown): value is ReviewNudgeStatus {
  return value === "open" || value === "copied" || value === "done" || value === "muted";
}

function isStackPlanStepKind(value: unknown): value is StackPlanStepKind {
  return value === "rebase" || value === "resolve" || value === "test" || value === "review" || value === "merge";
}

function isShipRoomBrief(value: unknown): value is ShipRoomBriefSnapshot {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<ShipRoomBriefSnapshot>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.repo === "string" &&
    isShipRoomMode(candidate.mode) &&
    typeof candidate.title === "string" &&
    Array.isArray(candidate.body) &&
    candidate.body.every((line) => typeof line === "string") &&
    Boolean(candidate.metrics) &&
    typeof candidate.metrics?.open === "number" &&
    typeof candidate.metrics.ready === "number" &&
    typeof candidate.metrics.blocked === "number" &&
    typeof candidate.metrics.codexPending === "number" &&
    typeof candidate.createdAt === "string"
  );
}

function isStackPlanSnapshot(value: unknown): value is StackPlanSnapshot {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<StackPlanSnapshot>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.repo === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.createdAt === "string" &&
    Array.isArray(candidate.steps) &&
    candidate.steps.every(isStackPlanStep)
  );
}

function isStackPlanStep(value: unknown): value is StackPlanStep {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<StackPlanStep>;
  return (
    typeof candidate.id === "string" &&
    isStackPlanStepKind(candidate.kind) &&
    typeof candidate.title === "string" &&
    typeof candidate.detail === "string" &&
    typeof candidate.done === "boolean" &&
    (candidate.targetId === undefined || typeof candidate.targetId === "string") &&
    (candidate.targetLabel === undefined || typeof candidate.targetLabel === "string")
  );
}

function isMergeImpactMemory(value: unknown): value is MergeImpactMemory {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<MergeImpactMemory>;
  return (
    Array.isArray(candidate.selectedPrIds) &&
    candidate.selectedPrIds.every((id) => typeof id === "string") &&
    typeof candidate.updatedAt === "string"
  );
}

function isCodexSignalMemory(value: unknown): value is CodexSignalMemory {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<CodexSignalMemory>;
  return isCodexSignalMemoryStatus(candidate.status) && typeof candidate.updatedAt === "string";
}

function isCodexSignalMemoryStatus(value: unknown): value is CodexSignalMemoryStatus {
  return value === "open" || value === "acknowledged" || value === "muted";
}

function isReleaseForecastSnapshot(value: unknown): value is ReleaseForecastSnapshot {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<ReleaseForecastSnapshot>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.repo === "string" &&
    typeof candidate.committedAt === "string" &&
    typeof candidate.etaMinutes === "number" &&
    typeof candidate.confidence === "number" &&
    Array.isArray(candidate.readyPrIds) &&
    candidate.readyPrIds.every((id) => typeof id === "string") &&
    Array.isArray(candidate.blockerPrIds) &&
    candidate.blockerPrIds.every((id) => typeof id === "string") &&
    typeof candidate.headline === "string"
  );
}

function isReviewerRouteMemory(value: unknown): value is ReviewerRouteMemory {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<ReviewerRouteMemory>;
  return (
    isReviewerRouteStatus(candidate.status) &&
    (candidate.targetReviewer === undefined || typeof candidate.targetReviewer === "string") &&
    typeof candidate.updatedAt === "string"
  );
}

function isReviewerRouteStatus(value: unknown): value is ReviewerRouteStatus {
  return value === "open" || value === "drafted" || value === "rerouted" || value === "done" || value === "muted";
}

function isReviewRunSnapshot(value: unknown): value is ReviewRunSnapshot {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<ReviewRunSnapshot>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.repo === "string" &&
    typeof candidate.startedAt === "string" &&
    (candidate.activeStepId === undefined || typeof candidate.activeStepId === "string") &&
    Array.isArray(candidate.completedStepIds) &&
    candidate.completedStepIds.every((id) => typeof id === "string")
  );
}

function isWorkspaceBriefActionMemory(value: unknown): value is WorkspaceBriefActionMemory {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<WorkspaceBriefActionMemory>;
  return isWorkspaceBriefActionStatus(candidate.status) && typeof candidate.updatedAt === "string";
}

function isWorkspaceBriefActionStatus(value: unknown): value is WorkspaceBriefActionStatus {
  return value === "open" || value === "queued" || value === "done";
}

function isLaunchCommandMemory(value: unknown): value is LaunchCommandMemory {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<LaunchCommandMemory>;
  return isLaunchCommandStatus(candidate.status) && typeof candidate.updatedAt === "string";
}

function isLaunchCommandStatus(value: unknown): value is LaunchCommandStatus {
  return value === "open" || value === "copied" || value === "done";
}

function isConnectionCheckMemory(value: unknown): value is ConnectionCheckMemory {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<ConnectionCheckMemory>;
  return isConnectionCheckStatus(candidate.status) && typeof candidate.updatedAt === "string";
}

function isConnectionCheckStatus(value: unknown): value is ConnectionCheckStatus {
  return value === "open" || value === "verified" || value === "muted";
}

function isAttentionItemMemory(value: unknown): value is AttentionItemMemory {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<AttentionItemMemory>;
  return isAttentionItemStatus(candidate.status) && typeof candidate.updatedAt === "string";
}

function isAttentionItemStatus(value: unknown): value is AttentionItemStatus {
  return value === "open" || value === "acknowledged" || value === "done" || value === "muted";
}

function isDecisionScenarioMemory(value: unknown): value is DecisionScenarioMemory {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<DecisionScenarioMemory>;
  return (
    isDecisionScenarioMode(candidate.mode) &&
    (candidate.selectedPrIds === undefined ||
      (Array.isArray(candidate.selectedPrIds) && candidate.selectedPrIds.every((id) => typeof id === "string"))) &&
    typeof candidate.updatedAt === "string"
  );
}

function isDecisionScenarioMode(value: unknown): value is DecisionScenarioMode {
  return value === "ship" || value === "unblock" || value === "ai" || value === "review";
}

function isDigestComposerMemory(value: unknown): value is DigestComposerMemory {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<DigestComposerMemory>;
  return (
    isDigestComposerMode(candidate.mode) &&
    isDigestComposerAudience(candidate.audience) &&
    typeof candidate.includeAi === "boolean" &&
    typeof candidate.includeBlockers === "boolean" &&
    typeof candidate.includeShip === "boolean" &&
    typeof candidate.includeJournal === "boolean" &&
    typeof candidate.updatedAt === "string"
  );
}

function isDigestComposerMode(value: unknown): value is DigestComposerMode {
  return value === "standup" || value === "slack" || value === "release" || value === "executive";
}

function isDigestComposerAudience(value: unknown): value is DigestComposerAudience {
  return value === "self" || value === "team" || value === "leadership";
}

function isOutboundUpdate(value: unknown): value is OutboundUpdate {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<OutboundUpdate>;
  return (
    typeof candidate.id === "string" &&
    (candidate.kind === "daily_digest" ||
      candidate.kind === "journal" ||
      candidate.kind === "ship_room" ||
      candidate.kind === "triage") &&
    isOutboundUpdateStatus(candidate.status) &&
    typeof candidate.title === "string" &&
    typeof candidate.summary === "string" &&
    typeof candidate.body === "string" &&
    isDigestComposerMode(candidate.channel) &&
    isDigestComposerAudience(candidate.audience) &&
    typeof candidate.sourceCount === "number" &&
    typeof candidate.lineCount === "number" &&
    Array.isArray(candidate.relatedPrIds) &&
    candidate.relatedPrIds.every((id) => typeof id === "string") &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

function isOutboundUpdateStatus(value: unknown): value is OutboundUpdateStatus {
  return value === "drafted" || value === "queued" || value === "sent" || value === "archived";
}

function isBatchExecutionMemory(value: unknown): value is BatchExecutionMemory {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<BatchExecutionMemory>;
  return (
    isBatchExecutionMode(candidate.mode) &&
    Array.isArray(candidate.selectedPrIds) &&
    candidate.selectedPrIds.every((id) => typeof id === "string") &&
    typeof candidate.updatedAt === "string"
  );
}

function isBatchExecutionMode(value: unknown): value is BatchExecutionMode {
  return value === "ship" || value === "review" || value === "ai" || value === "unblock";
}

function isStackReviewNavigatorMemory(value: unknown): value is StackReviewNavigatorMemory {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<StackReviewNavigatorMemory>;
  return (
    (typeof candidate.selectedStackKey === "string" || typeof candidate.selectedStackKey === "undefined") &&
    isStackReviewMode(candidate.mode) &&
    typeof candidate.includeMerged === "boolean" &&
    typeof candidate.updatedAt === "string"
  );
}

function isStackReviewMode(value: unknown): value is StackReviewMode {
  return value === "bottom_up" || value === "risk_first" || value === "ship_ready";
}

function isReviewThreadMemory(value: unknown): value is ReviewThreadMemory {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<ReviewThreadMemory>;
  return isReviewThreadStatus(candidate.status) && typeof candidate.updatedAt === "string";
}

function isReviewThreadStatus(value: unknown): value is ReviewThreadStatus {
  return value === "open" || value === "drafted" || value === "resolved" || value === "muted";
}

function isAutopilotPlaybookMemory(value: unknown): value is AutopilotPlaybookMemory {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<AutopilotPlaybookMemory>;
  return (
    isAutopilotPlaybookId(candidate.activePlaybookId) &&
    Array.isArray(candidate.completedStepIds) &&
    candidate.completedStepIds.every((id) => typeof id === "string") &&
    (candidate.lastRunAt === undefined || typeof candidate.lastRunAt === "string") &&
    typeof candidate.updatedAt === "string"
  );
}

function isAutopilotPlaybookId(value: unknown): value is AutopilotPlaybookId {
  return value === "morning_review" || value === "pre_merge" || value === "ai_sweep" || value === "release_handoff";
}

function isChangeRadarMemory(value: unknown): value is ChangeRadarMemory {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<ChangeRadarMemory>;
  return (
    isChangeRadarMode(candidate.mode) &&
    Array.isArray(candidate.acknowledgedSignalIds) &&
    candidate.acknowledgedSignalIds.every((id) => typeof id === "string") &&
    Array.isArray(candidate.trackedPrIds) &&
    candidate.trackedPrIds.every((id) => typeof id === "string") &&
    (candidate.lastCheckpointAt === undefined || typeof candidate.lastCheckpointAt === "string") &&
    typeof candidate.updatedAt === "string"
  );
}

function isChangeRadarMode(value: unknown): value is ChangeRadarMode {
  return value === "unseen" || value === "codex" || value === "risk" || value === "ship";
}

function isActionJournalEntry(value: unknown): value is ActionJournalEntry {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<ActionJournalEntry>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.message === "string" &&
    isActionJournalScope(candidate.scope) &&
    isActionJournalTone(candidate.tone) &&
    (candidate.repo === undefined || typeof candidate.repo === "string") &&
    (candidate.prNumber === undefined || typeof candidate.prNumber === "number") &&
    typeof candidate.createdAt === "string"
  );
}

function isActionJournalScope(value: unknown): value is ActionJournalScope {
  return (
    value === "decision" ||
    value === "attention" ||
    value === "review" ||
    value === "ship" ||
    value === "ai" ||
    value === "ops" ||
    value === "connection" ||
    value === "system"
  );
}

function isActionJournalTone(value: unknown): value is ActionJournalTone {
  return value === "blue" || value === "green" || value === "amber" || value === "red" || value === "purple";
}

function isReviewChatMessage(value: unknown): value is ReviewChatMessage {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<ReviewChatMessage>;
  return (
    (candidate.role === "user" || candidate.role === "assistant") &&
    typeof candidate.id === "string" &&
    typeof candidate.body === "string" &&
    typeof candidate.createdAt === "string"
  );
}

function applyPrFilters(
  prs: PullRequestSummary[],
  filter: FilterId,
  query: string,
  reviewMemory: ReviewMemoryByPr,
) {
  const search = query.trim().toLowerCase();

  return prs.filter((pr) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "waiting" && pr.state === "waiting_review") ||
      (filter === "needs-review" && pr.reviewers.length === 0 && !pr.isDraft) ||
      (filter === "drafts" && pr.isDraft) ||
      (filter === "changes" && pr.state === "changes_requested") ||
      (filter === "approved" && pr.state === "approved") ||
      (filter === "codex" && pr.codex.exists) ||
      (filter === "high-risk" && (pr.ci === "failure" || pr.state === "changes_requested"));

    if (!matchesFilter) return false;
    if (!search) return true;

    const memory = reviewMemory[pr.id];
    const isSnoozed = memory?.snoozedUntil && new Date(memory.snoozedUntil).getTime() > Date.now();

    return [
      pr.title,
      pr.branch,
      pr.repo,
      String(pr.number),
      pr.codex.statusText,
      memory?.decision,
      memory?.pinned ? "pinned" : "",
      isSnoozed ? "snoozed" : "",
      memory?.note,
      ...(memory?.chat ?? []).map((message) => message.body),
    ]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
}

function formatBriefForClipboard(brief: ShipRoomBriefSnapshot) {
  return [
    brief.title,
    `Generated ${new Date(brief.createdAt).toLocaleString()}`,
    "",
    ...brief.body.map((line) => `- ${line}`),
  ].join("\n");
}

function createOutboundUpdate(
  body: string,
  lineCount: number,
  meta: DigestCopyMeta,
  pullRequests: PullRequestSummary[],
): OutboundUpdate {
  const createdAt = new Date().toISOString();
  const referencedNumbers = new Set(
    [...body.matchAll(/#(\d+)/g)]
      .map((match) => Number(match[1]))
      .filter((number) => Number.isFinite(number)),
  );
  const relatedPrIds = pullRequests
    .filter((pr) => referencedNumbers.has(pr.number))
    .map((pr) => pr.id);

  return {
    id: `outbound-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: "daily_digest",
    status: "drafted",
    title: `${capitalize(meta.mode)} update · ${capitalize(meta.audience)}`,
    summary: meta.summary,
    body,
    channel: meta.mode,
    audience: meta.audience,
    sourceCount: meta.sources.length,
    lineCount,
    relatedPrIds,
    createdAt,
    updatedAt: createdAt,
  };
}

function createActionJournalEntry(
  message: string,
  activeRepo: string,
  selectedPr?: PullRequestSummary,
): ActionJournalEntry {
  const { scope, tone } = inferActionJournalMeta(message);
  const prNumber = extractPrNumber(message) ?? selectedPr?.number;

  return {
    id: `journal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message,
    scope,
    tone,
    repo: selectedPr?.repo ?? activeRepo,
    prNumber,
    createdAt: new Date().toISOString(),
  };
}

function inferActionJournalMeta(message: string): { scope: ActionJournalScope; tone: ActionJournalTone } {
  const lower = message.toLowerCase();
  const scope: ActionJournalScope = lower.includes("decision")
    ? "decision"
    : lower.includes("attention")
      ? "attention"
      : lower.includes("codex") || lower.includes("ai ") || lower.includes("thumbs")
        ? "ai"
        : lower.includes("merge") || lower.includes("ship") || lower.includes("release") || lower.includes("queue")
          ? "ship"
          : lower.includes("connection") || lower.includes("github") || lower.includes("token") || lower.includes("repos")
            ? "connection"
            : lower.includes("review") || lower.includes("nudge") || lower.includes("snooz") || lower.includes("pin")
              ? "review"
              : lower.includes("stack") ||
                  lower.includes("branch") ||
                  lower.includes("workspace") ||
                  lower.includes("autopilot") ||
                  lower.includes("radar")
                ? "ops"
                : "system";
  const tone: ActionJournalTone =
    lower.includes("blocked") || lower.includes("failed") || lower.includes("failure")
      ? "red"
      : scope === "ai"
        ? "purple"
        : lower.includes("ready") ||
            lower.includes("done") ||
            lower.includes("copied") ||
            lower.includes("queued") ||
            lower.includes("passed") ||
            lower.includes("verified") ||
            lower.includes("saved") ||
            lower.includes("completed") ||
            lower.includes("promoted")
          ? "green"
          : lower.includes("acknowledged") || lower.includes("snoozed") || lower.includes("reopened")
            ? "amber"
            : "blue";

  return { scope, tone };
}

function extractPrNumber(message: string) {
  const match = message.match(/#(\d+)/);
  return match ? Number(match[1]) : undefined;
}

function formatStackPlanForClipboard(plan: StackPlanSnapshot) {
  return [
    plan.title,
    `Saved ${new Date(plan.createdAt).toLocaleString()}`,
    "",
    ...plan.steps.map((step) => `${step.done ? "[x]" : "[ ]"} ${step.kind}: ${step.title} - ${step.detail}`),
  ].join("\n");
}

function pluralize(label: string, count: number) {
  return count === 1 ? label : `${label}s`;
}

function playbookLabel(id: AutopilotPlaybookId) {
  if (id === "pre_merge") return "Pre-merge train";
  if (id === "ai_sweep") return "AI sweep";
  if (id === "release_handoff") return "Release handoff";
  return "Morning review";
}

function modeLabel(mode: ChangeRadarMode) {
  if (mode === "codex") return "Codex";
  if (mode === "risk") return "Risk";
  if (mode === "ship") return "Ship";
  return "Unseen";
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function scrollWorkspaceElementIntoView(id: string) {
  window.requestAnimationFrame(() => {
    const target = document.getElementById(id);
    const workspace = document.querySelector<HTMLElement>(".workspace");
    const topbar = document.querySelector<HTMLElement>(".topbar");

    if (!target || !workspace || window.innerWidth <= 900 || workspace.scrollHeight <= workspace.clientHeight + 1) {
      target?.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }

    const workspaceRect = workspace.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    workspace.scrollTo({
      top: workspace.scrollTop + targetRect.top - workspaceRect.top - (topbar?.offsetHeight ?? 0) - 10,
      behavior: "auto",
    });
  });
}

function isRecommendedForImpact(
  pr: PullRequestSummary,
  index: number,
  reviewMemory: ReviewMemoryByPr,
) {
  const memory = reviewMemory[pr.id];
  const snoozed = Boolean(memory?.snoozedUntil && new Date(memory.snoozedUntil).getTime() > Date.now());
  const readinessTotal = pr.readinessTotal ?? 6;
  const readiness =
    pr.readiness ??
    Math.max(
      0,
      readinessTotal -
        (pr.ci === "failure" ? 2 : 0) -
        (pr.state === "changes_requested" ? 2 : 0) -
        (pr.isDraft ? 1 : 0) -
        (index % 2),
    );

  return (
    !pr.isDraft &&
    !snoozed &&
    pr.ci === "success" &&
    pr.state !== "changes_requested" &&
    memory?.decision !== "blocked" &&
    (pr.state === "approved" || memory?.decision === "ready" || readiness >= readinessTotal - 1)
  );
}

function buildFilters(prs: PullRequestSummary[]): FilterItem[] {
  return [
    { id: "all", label: "Needs your review", count: prs.length },
    {
      id: "waiting",
      label: "Waiting for review",
      count: prs.filter((pr) => pr.state === "waiting_review").length,
    },
    {
      id: "needs-review",
      label: "Waiting for author",
      count: prs.filter((pr) => pr.reviewers.length === 0 && !pr.isDraft).length,
    },
    { id: "drafts", label: "Drafts", count: prs.filter((pr) => pr.isDraft).length },
    {
      id: "changes",
      label: "Returned to you",
      count: prs.filter((pr) => pr.state === "changes_requested").length,
    },
    {
      id: "approved",
      label: "Approved",
      count: prs.filter((pr) => pr.state === "approved").length,
    },
    { id: "codex", label: "Codex reviewed", count: prs.filter((pr) => pr.codex.exists).length },
    {
      id: "high-risk",
      label: "High risk",
      count: prs.filter((pr) => pr.ci === "failure" || pr.state === "changes_requested").length,
    },
  ];
}

function promoteCodex(pr: PullRequestSummary): CodexSignal {
  const event: ReviewEvent = {
    id: `codex-promoted-${Date.now()}`,
    reviewer: { login: "Codex", role: "Bot", isCodex: true },
    state: "approved",
    reaction: "thumbs_up",
    body: "Reaction moved from eyes to thumbs up.",
    submittedAt: new Date().toISOString(),
  };

  const previousEvents = pr.codex.events.length
    ? pr.codex.events
    : [
        {
          id: `codex-eyes-${Date.now()}`,
          reviewer: { login: "Codex", role: "Bot", isCodex: true },
          state: "commented" as const,
          reaction: "eyes" as const,
          body: "Codex reviewed this PR.",
          submittedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
        },
      ];

  return {
    exists: true,
    reaction: "changed",
    statusText: "Changed from eyes to thumbs up",
    lastSeenAt: event.submittedAt,
    events: [...previousEvents, event],
  };
}

type WorkspacePanel =
  | "deck"
  | "run"
  | "codex"
  | "release"
  | "reviewer"
  | "brief"
  | "sla"
  | "freshness"
  | "surgery"
  | "impact"
  | "queue"
  | "ops"
  | "automation"
  | "timeline"
  | "graph";

function isPanelVisible(lens: WorkspaceLens, panel: WorkspacePanel) {
  if (lens === "all") return true;

  const visibleByLens: Record<Exclude<WorkspaceLens, "all">, WorkspacePanel[]> = {
    focus: ["deck", "run", "reviewer", "sla", "freshness", "brief"],
    ai: ["run", "codex", "ops", "automation"],
    ship: ["release", "impact", "queue", "surgery", "brief"],
    ops: ["ops", "automation", "timeline", "graph", "sla"],
  };

  return visibleByLens[lens].includes(panel);
}
