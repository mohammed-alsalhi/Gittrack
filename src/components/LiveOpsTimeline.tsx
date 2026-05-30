import {
  Activity,
  ArrowRight,
  Clipboard,
  GitPullRequest,
  MessageSquareText,
  RadioTower,
  Users,
} from "lucide-react";
import { ActivityEvent, PullRequestSummary } from "../types";
import { buildStandupSummary, getReviewerLoads } from "../lib/insights";
import { formatRelativeTime } from "./ui";

interface LiveOpsTimelineProps {
  activity: ActivityEvent[];
  pullRequests: PullRequestSummary[];
  onSelectPullRequest: (id: string) => void;
  onCopyUpdate: () => void;
}

export function LiveOpsTimeline({
  activity,
  pullRequests,
  onSelectPullRequest,
  onCopyUpdate,
}: LiveOpsTimelineProps) {
  const reviewerLoads = getReviewerLoads(pullRequests);
  const standupSummary = buildStandupSummary(pullRequests, activity);

  return (
    <section className="live-ops">
      <div className="live-panel activity-feed">
        <div className="live-title">
          <RadioTower size={16} />
          <h2>Live ops timeline</h2>
          <span>streaming</span>
        </div>
        <div className="timeline-list">
          {activity.slice(0, 5).map((event) => (
            <div className="timeline-row" key={event.id}>
              <span className={`timeline-dot state-${event.state}`} />
              <div>
                <strong>{event.title}</strong>
                <p>{event.detail}</p>
              </div>
              <time>{formatRelativeTime(event.at)}</time>
            </div>
          ))}
        </div>
      </div>

      <div className="live-panel reviewer-load">
        <div className="live-title">
          <Users size={16} />
          <h2>Reviewer load</h2>
          <span>{reviewerLoads.length} people</span>
        </div>
        <div className="load-list">
          {reviewerLoads.map((item) => (
            <div className="load-row" key={item.reviewer.login}>
              <span className={item.reviewer.isCodex ? "avatar avatar-bot" : "avatar"}>
                {item.reviewer.login[0]?.toUpperCase()}
              </span>
              <div>
                <strong>{item.reviewer.login}</strong>
                <small>{item.pending} pending · {item.approved} approved</small>
              </div>
              <span className={`load-meter load-${item.tone}`}>
                <i style={{ width: `${Math.min(100, item.count * 28)}%` }} />
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="live-panel standup-card">
        <div className="live-title">
          <MessageSquareText size={16} />
          <h2>Generated update</h2>
          <button onClick={onCopyUpdate}>
            <Clipboard size={14} />
            Copy
          </button>
        </div>
        <ul>
          {standupSummary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {pullRequests[0] && (
          <button className="focus-pr" onClick={() => onSelectPullRequest(pullRequests[0].id)}>
            <GitPullRequest size={15} />
            <span>Open top priority</span>
            <ArrowRight size={15} />
          </button>
        )}
      </div>
    </section>
  );
}
