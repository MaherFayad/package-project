import { Badge } from "@/components/ui/Badge";
import { formatNumber } from "@/lib/format";

/** Delivered orders needed before the health score is judged (smaller samples swing 0 to 100). */
export const HEALTH_MIN_DELIVERED = 5;

/**
 * Vendor health score 0–100 as a toned badge: below 50 critical, below 80 attention, else success.
 * With fewer than HEALTH_MIN_DELIVERED delivered orders it stays neutral and says "early data", so
 * one late or disputed first job does not brand a new vendor as failing.
 */
export function HealthBadge({ score, label, delivered, earlyLabel }: { score: number; label: string; delivered: number; earlyLabel: string }) {
  const early = delivered < HEALTH_MIN_DELIVERED;
  const tone = early ? undefined : score < 50 ? "critical" : score < 80 ? "attention" : "success";
  return (
    <Badge tone={tone} progress={early || score < 80 ? "incomplete" : "complete"} toneAndProgressLabel={label}>
      {formatNumber(score)}/100{early ? ` · ${earlyLabel}` : ""}
    </Badge>
  );
}
