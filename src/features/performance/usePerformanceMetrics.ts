import { useEffect, useState } from "react";
import {
  calculateFramesPerSecond,
  type MemoryOccupancy,
  type PerformanceMetrics,
} from "./metrics";

type PerformanceWithMemory = Performance & {
  memory?: MemoryOccupancy;
};

const sampleWindowMs = 1000;
const updateIntervalMs = 500;
const initialMetrics: PerformanceMetrics = {
  fps: null,
  memory: null,
};

export function usePerformanceMetrics() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>(initialMetrics);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let animationFrameId = 0;
    let lastUpdateAt = 0;
    const frameTimestamps: number[] = [];

    function sample(timestamp: number) {
      frameTimestamps.push(timestamp);

      const cutoff = timestamp - sampleWindowMs;
      while (frameTimestamps.length > 0 && frameTimestamps[0] < cutoff) {
        frameTimestamps.shift();
      }

      if (timestamp - lastUpdateAt >= updateIntervalMs) {
        const memory = (window.performance as PerformanceWithMemory).memory ?? null;
        setMetrics({
          fps: calculateFramesPerSecond(frameTimestamps),
          memory,
        });
        lastUpdateAt = timestamp;
      }

      animationFrameId = window.requestAnimationFrame(sample);
    }

    animationFrameId = window.requestAnimationFrame(sample);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return metrics;
}
