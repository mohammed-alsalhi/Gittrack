import { CheckCircle2, GitPullRequest, MessageSquareText, ShieldAlert, TimerReset } from "lucide-react";

export interface Metric {
  label: string;
  value: string;
  delta: string;
  tone: "blue" | "green" | "amber" | "red" | "slate";
  points: number[];
}

export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <section className="metrics" aria-label="Repository metrics">
      {metrics.map((metric) => (
        <article className="metric-card" key={metric.label}>
          <div className="metric-top">
            <span>{metric.label}</span>
            {metricIcon(metric.label)}
          </div>
          <strong>{metric.value}</strong>
          <small className={`metric-delta ${metric.tone}`}>{metric.delta}</small>
          <Sparkline points={metric.points} tone={metric.tone} />
        </article>
      ))}
    </section>
  );
}

function metricIcon(label: string) {
  if (label.includes("Open")) return <GitPullRequest size={16} />;
  if (label.includes("Waiting")) return <TimerReset size={16} />;
  if (label.includes("Approved")) return <CheckCircle2 size={16} />;
  if (label.includes("Changes")) return <ShieldAlert size={16} />;
  return <MessageSquareText size={16} />;
}

function Sparkline({ points, tone }: { points: number[]; tone: Metric["tone"] }) {
  const width = 118;
  const height = 32;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const spread = Math.max(1, max - min);
  const d = points
    .map((point, index) => {
      const x = (index / Math.max(1, points.length - 1)) * width;
      const y = height - ((point - min) / spread) * 24 - 4;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg className={`spark spark-${tone}`} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={`${d} L ${width} ${height} L 0 ${height} Z`} className="spark-fill" />
      <path d={d} className="spark-line" />
    </svg>
  );
}
