import { Star } from "lucide-react";
import styles from "./store.module.css";

/** Five stars (decorative) + the rating as text for everyone (colour/shape never carry meaning alone). */
export function RatingStars({ rating, label }: { rating: number; label: string }) {
  const full = Math.round(rating);
  return (
    <span className={styles.stars}>
      <span aria-hidden="true" className={styles.stars}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} size={16} fill={i <= full ? "currentColor" : "none"} strokeWidth={1.75} />
        ))}
      </span>
      <span className="visually-hidden">{label}</span>
    </span>
  );
}
