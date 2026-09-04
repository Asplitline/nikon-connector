export type MemoryOccupancy = {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
};

export type PerformanceMetrics = {
  fps: number | null;
  memory: MemoryOccupancy | null;
};

export function calculateFramesPerSecond(frameTimestamps: number[]) {
  if (frameTimestamps.length < 2) {
    return 0;
  }

  const first = frameTimestamps[0];
  const last = frameTimestamps[frameTimestamps.length - 1];
  const durationMs = last - first;

  if (durationMs <= 0) {
    return 0;
  }

  return Math.round(((frameTimestamps.length - 1) * 1000) / durationMs);
}

export function formatPerformanceOccupancy(memory: MemoryOccupancy | null) {
  if (!memory) {
    return "--";
  }

  return `${toMegabytes(memory.usedJSHeapSize)} / ${toMegabytes(
    memory.jsHeapSizeLimit,
  )} MB`;
}

function toMegabytes(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(1);
}
