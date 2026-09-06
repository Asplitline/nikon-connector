import type { Rating } from "./types";
import { starButtonClass } from "./photoStyles";

interface StarRatingProps {
  value: Rating;
  onChange: (rating: Rating) => void;
  disabled?: boolean;
  labels?: {
    clear: string;
    rating: (value: Rating) => string;
    star: (value: Rating) => string;
  };
  variant?: "panel" | "overlay";
}

const defaultLabels = {
  clear: "Clear",
  rating: (value: Rating) => `Rating ${value} stars`,
  star: (value: Rating) => `${value} star${value === 1 ? "" : "s"}`,
};

export function StarRating({
  value,
  onChange,
  disabled,
  labels = defaultLabels,
  variant = "panel",
}: StarRatingProps) {
  const isOverlay = variant === "overlay";

  return (
    <div
      className={
        isOverlay
          ? "flex items-center gap-0.5 whitespace-nowrap"
          : "flex items-center gap-1 rounded-[10px] border border-line bg-surface p-[3px] whitespace-nowrap shadow-[0_1px_0_color-mix(in_oklch,var(--app-ink)_4%,transparent)] max-sm:max-w-full max-sm:overflow-x-auto"
      }
      aria-label={labels.rating(value)}
    >
      {[1, 2, 3, 4, 5].map((rating) => {
        const nextRating = rating as Rating;
        const isActive = rating <= value;

        return (
          <button
            className={starButtonClass(isActive, disabled, variant)}
            disabled={disabled}
            key={rating}
            onClick={() => onChange(nextRating)}
            title={labels.star(nextRating)}
            type="button"
          >
            {isActive ? "★" : "☆"}
          </button>
        );
      })}
      <button
        aria-label={labels.clear}
        className={
          isOverlay
            ? "ml-2 grid h-8 w-8 place-items-center rounded-md text-base text-on-image/75 transition hover:bg-[color-mix(in_oklch,currentColor_12%,transparent)] hover:text-on-image focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-35"
            : "ml-2 min-h-10 rounded-md px-3 text-xs font-semibold text-muted transition-[background-color,border-color,color,opacity,transform,box-shadow] duration-[180ms] ease-[ease] active:translate-y-px hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-45"
        }
        disabled={disabled || value === 0}
        onClick={() => onChange(0)}
        type="button"
      >
        {isOverlay ? "⌫" : labels.clear}
      </button>
    </div>
  );
}
