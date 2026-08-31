import type { Rating } from "./types";

interface StarRatingProps {
  value: Rating;
  onChange: (rating: Rating) => void;
  disabled?: boolean;
}

export function StarRating({ value, onChange, disabled }: StarRatingProps) {
  return (
    <div
      className="rating-control flex items-center gap-1"
      aria-label={`Rating ${value} stars`}
    >
      {[1, 2, 3, 4, 5].map((rating) => {
        const nextRating = rating as Rating;
        const isActive = rating <= value;

        return (
          <button
            className={[
              "rating-star grid h-10 w-10 place-items-center rounded-md text-[20px] transition",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]",
              isActive
                ? "text-[var(--color-star)]"
                : "text-[var(--color-muted)] hover:text-[var(--color-ink)]",
              disabled ? "cursor-not-allowed opacity-50" : "hover:bg-[var(--color-hover)]",
            ].join(" ")}
            disabled={disabled}
            key={rating}
            onClick={() => onChange(nextRating)}
            title={`${rating} star${rating === 1 ? "" : "s"}`}
            type="button"
          >
            {isActive ? "★" : "☆"}
          </button>
        );
      })}
      <button
        className="clear-rating ml-2 min-h-10 rounded-md px-3 text-xs font-semibold text-[var(--color-muted)] transition hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] disabled:cursor-not-allowed disabled:opacity-45"
        disabled={disabled || value === 0}
        onClick={() => onChange(0)}
        type="button"
      >
        Clear
      </button>
    </div>
  );
}
