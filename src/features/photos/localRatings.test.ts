import { describe, expect, it } from "vitest";
import {
  applyLocalPickStatuses,
  applyLocalRatings,
  isLocalOnlyRatingError,
  readLocalPickStatuses,
  readLocalRatings,
  writeLocalPickStatus,
  writeLocalRating,
} from "./localRatings";
import type { CameraPhoto } from "./types";

const photos: CameraPhoto[] = [
  {
    cameraId: "camera-1",
    capturedAt: "2026-08-31T10:15:00.000Z",
    fileName: "DSC_1001.JPG",
    fileType: "jpg",
    height: 4024,
    id: "camera-1:1001",
    previewUrl: "",
    rating: 0,
    sizeMb: 18.4,
    thumbnailUrl: "",
    width: 6048,
  },
  {
    cameraId: "camera-1",
    capturedAt: "2026-08-31T10:18:00.000Z",
    fileName: "DSC_1002.NEF",
    fileType: "nef",
    height: 4024,
    id: "camera-1:1002",
    previewUrl: "",
    rating: 2,
    sizeMb: 34.7,
    thumbnailUrl: "",
    width: 6048,
  },
];

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  length = 0;

  clear(): void {
    this.values.clear();
    this.length = 0;
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
    this.length = this.values.size;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
    this.length = this.values.size;
  }
}

describe("local ratings", () => {
  it("stores ratings per camera and applies them to listed photos", () => {
    const storage = new MemoryStorage();

    writeLocalRating(storage, "camera-1", "camera-1:1001", 4);
    writeLocalRating(storage, "camera-2", "camera-1:1002", 5);

    expect(
      applyLocalRatings(photos, readLocalRatings(storage, "camera-1")).map(
        (photo) => photo.rating,
      ),
    ).toEqual([4, 2]);
  });

  it("removes a local rating when the user clears it", () => {
    const storage = new MemoryStorage();

    writeLocalRating(storage, "camera-1", "camera-1:1001", 4);
    writeLocalRating(storage, "camera-1", "camera-1:1001", 0);

    expect(readLocalRatings(storage, "camera-1")).toEqual({});
  });

  it("stores pick status independently from star ratings", () => {
    const storage = new MemoryStorage();

    writeLocalRating(storage, "camera-1", "camera-1:1001", 3);
    writeLocalPickStatus(storage, "camera-1", "camera-1:1001", "picked");
    writeLocalPickStatus(storage, "camera-1", "camera-1:1002", "rejected");

    const marked = applyLocalPickStatuses(
      applyLocalRatings(photos, readLocalRatings(storage, "camera-1")),
      readLocalPickStatuses(storage, "camera-1"),
    );

    expect(marked.map((photo) => [photo.rating, photo.pickStatus])).toEqual([
      [3, "picked"],
      [2, "rejected"],
    ]);
  });

  it("removes local pick status when the user clears the mark", () => {
    const storage = new MemoryStorage();

    writeLocalPickStatus(storage, "camera-1", "camera-1:1001", "picked");
    writeLocalPickStatus(storage, "camera-1", "camera-1:1001", "none");

    expect(readLocalPickStatuses(storage, "camera-1")).toEqual({});
  });

  it("treats unsupported SDK write-back errors as local-only rating results", () => {
    expect(
      isLocalOnlyRatingError(
        new Error("Nikon SDK rating write-back is not connected yet."),
      ),
    ).toBe(true);
    expect(isLocalOnlyRatingError(new Error("Camera disconnected."))).toBe(false);
  });
});
