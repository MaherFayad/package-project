import { Badge } from "@/components/ui";
import { formatNumber } from "@/lib/format";

/** Vendor health score 0–100 as a toned badge: below 50 critical, below 80 attention, else success. */
export function HealthBadge({ score, label }: { score: number; label: string }) {
  const tone = score < 50 ? "critical" : score < 80 ? "attention" : "success";
  return (
    <Badge tone={tone} progress={score < 80 ? "incomplete" : "complete"} toneAndProgressLabel={label}>
      {formatNumber(score)}/100
    </Badge>
  );
}
