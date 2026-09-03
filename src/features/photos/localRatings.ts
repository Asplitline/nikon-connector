import type { CameraPhoto, Rating } from "./types";

type LocalRatings = Record<string, Rating>;

const storagePrefix = "nikon-connector:local-ratings:";

export function readLocalRatings(storage: Storage, cameraId: string): LocalRatings {
  const raw = storage.getItem(storageKey(cameraId));

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, Rating] =>
        isRating(entry[1]),
      ),
    );
  } catch {
    return {};
  }
}

export function writeLocalRating(
  storage: Storage,
  cameraId: string,
  photoId: string,
  rating: Rating,
) {
  const ratings = readLocalRatings(storage, cameraId);

  if (rating === 0) {
    delete ratings[photoId];
  } else {
    ratings[photoId] = rating;
  }

  if (Object.keys(ratings).length === 0) {
    storage.removeItem(storageKey(cameraId));
    return;
  }

  storage.setItem(storageKey(cameraId), JSON.stringify(ratings));
}

export function applyLocalRatings(
  photos: CameraPhoto[],
  ratings: LocalRatings,
): CameraPhoto[] {
  return photos.map((photo) => {
    const rating = ratings[photo.id];
    return rating === undefined ? photo : { ...photo, rating };
  });
}

export function isLocalOnlyRatingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /Nikon SDK rating write-back is not connected yet|unsupported/i.test(message);
}

function storageKey(cameraId: string) {
  return `${storagePrefix}${cameraId}`;
}

function isRating(value: unknown): value is Rating {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 5
  );
}
