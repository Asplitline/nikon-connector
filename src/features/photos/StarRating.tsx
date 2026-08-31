import type { Rating } from "./types";

interface StarRatingProps {
  value: Rating;
  onChange: (rating: Rating) => void;
  disabled?: boolean;
}

export function StarRating({ value, onChange, disabled }: StarRatingProps) {
  return (
    <div className="flex items-center gap-1" aria-label={`Rating ${value} stars`}>
      {[1, 2, 3, 4, 5].map((rating) => {
        const nextRating = rating as Rating;
        const isActive = rating <= value;

        return (
          <button
            className={[
              "grid h-9 w-9 place-items-center rounded-md text-[19px] transition",
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
        className="ml-2 rounded-md px-2 py-1 text-xs font-medium text-[var(--color-muted)] transition hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled || value === 0}
        onClick={() => onChange(0)}
        type="button"
      >
        Clear
      </button>
    </div>
  );
}
