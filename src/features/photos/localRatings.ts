import type { CameraPhoto, PickStatus, Rating } from "./types";

type LocalRatings = Record<string, Rating>;
type LocalPickStatuses = Record<string, Exclude<PickStatus, "none">>;

const storagePrefix = "nikon-connector:local-ratings:";
const pickStoragePrefix = "nikon-connector:local-picks:";

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

export function readLocalPickStatuses(
  storage: Storage,
  cameraId: string,
): LocalPickStatuses {
  const raw = storage.getItem(pickStorageKey(cameraId));

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, Exclude<PickStatus, "none">] =>
          isStoredPickStatus(entry[1]),
      ),
    );
  } catch {
    return {};
  }
}

export function writeLocalPickStatus(
  storage: Storage,
  cameraId: string,
  photoId: string,
  status: PickStatus,
) {
  const statuses = readLocalPickStatuses(storage, cameraId);

  if (status === "none") {
    delete statuses[photoId];
  } else {
    statuses[photoId] = status;
  }

  if (Object.keys(statuses).length === 0) {
    storage.removeItem(pickStorageKey(cameraId));
    return;
  }

  storage.setItem(pickStorageKey(cameraId), JSON.stringify(statuses));
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

export function applyLocalPickStatuses(
  photos: CameraPhoto[],
  statuses: LocalPickStatuses,
): CameraPhoto[] {
  return photos.map((photo) => ({
    ...photo,
    pickStatus: statuses[photo.id] ?? photo.pickStatus ?? "none",
  }));
}

export function isLocalOnlyRatingError(error: unknown) {
  void error;
  return false;
}

function storageKey(cameraId: string) {
  return `${storagePrefix}${cameraId}`;
}

function pickStorageKey(cameraId: string) {
  return `${pickStoragePrefix}${cameraId}`;
}

function isRating(value: unknown): value is Rating {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 5
  );
}

function isStoredPickStatus(value: unknown): value is Exclude<PickStatus, "none"> {
  return value === "picked" || value === "rejected";
}
