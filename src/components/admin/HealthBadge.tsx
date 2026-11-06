import { Badge } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { adminStyles } from "./charts";

/** Delivered orders needed before the health score is judged (smaller samples swing 0 to 100). */
export const HEALTH_MIN_DELIVERED = 5;

/**
 * Vendor health score 0–100 as a toned badge: below 50 critical, below 80 attention, else success.
 * With fewer than HEALTH_MIN_DELIVERED delivered orders it stays neutral and says "early data", so
 * one late or disputed first job does not brand a new vendor as failing.
 */
export function HealthBadge({ score, label, delivered, earlyLabel, stacked = false }: { score: number; label: string; delivered: number; earlyLabel: string; stacked?: boolean }) {
  const early = delivered < HEALTH_MIN_DELIVERED;
  const tone = early ? undefined : score < 50 ? "critical" : score < 80 ? "attention" : "success";
  // R5-AD: in a narrow metric tile the "· early data" suffix wrapped the pill onto two lines; the
  // stacked form keeps the score in the pill and the caveat as a caption under it.
  if (stacked)
    return (
      <span className={adminStyles.MetricStack}>
        <span>
          <Badge tone={tone} progress={early || score < 80 ? "incomplete" : "complete"} toneAndProgressLabel={label}>
            {`${formatNumber(score)}/100`}
          </Badge>
        </span>
        {early ? <span className={adminStyles.MetricSub}>{earlyLabel.charAt(0).toUpperCase() + earlyLabel.slice(1)}</span> : null}
      </span>
    );
  return (
    <Badge tone={tone} progress={early || score < 80 ? "incomplete" : "complete"} toneAndProgressLabel={label}>
      {formatNumber(score)}/100{early ? ` · ${earlyLabel}` : ""}
    </Badge>
  );
}
