import { describe, expect, it } from "vitest";
import {
  createGenerationGuard,
  createPreviewScheduler,
  type SchedulerTimers,
} from "./previewScheduler";

// 可控定时器：手动 tick，避免测试依赖真实时间
function createFakeTimers() {
  let nextHandle = 1;
  const scheduled = new Map<number, () => void>();

  const timers: SchedulerTimers = {
    clearTimeout: (handle) => {
      scheduled.delete(handle);
    },
    setTimeout: (callback) => {
      const handle = nextHandle;
      nextHandle += 1;
      scheduled.set(handle, callback);
      return handle;
    },
  };

  return {
    timers,
    get pendingTimers() {
      return scheduled.size;
    },
    runAll() {
      const callbacks = [...scheduled.values()];
      scheduled.clear();
      for (const callback of callbacks) {
        callback();
      }
    },
  };
}

// onFlush 经由 Promise 链发出，断言前需让微任务队列跑完
async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("preview scheduler", () => {
  it("collapses rapid requests into a single flush", async () => {
    const fake = createFakeTimers();
    const flushed: string[] = [];
    const scheduler = createPreviewScheduler<string>({
      onFlush: async (payload) => {
        flushed.push(payload);
      },
      scheduler: fake.timers,
    });

    scheduler.request("a");
    scheduler.request("b");
    scheduler.request("c");
    fake.runAll();
    await flushMicrotasks();

    expect(flushed).toEqual(["c"]);
  });

  it("drops the pending batch when cancelled", () => {
    const fake = createFakeTimers();
    const flushed: string[] = [];
    const scheduler = createPreviewScheduler<string>({
      onFlush: async (payload) => {
        flushed.push(payload);
      },
      scheduler: fake.timers,
    });

    scheduler.request("a");
    scheduler.cancel();
    fake.runAll();

    expect(flushed).toEqual([]);
    expect(scheduler.pendingCount).toBe(0);
  });

  it("ignores requests after dispose", () => {
    const fake = createFakeTimers();
    const flushed: string[] = [];
    const scheduler = createPreviewScheduler<string>({
      onFlush: async (payload) => {
        flushed.push(payload);
      },
      scheduler: fake.timers,
    });

    scheduler.dispose();
    scheduler.request("a");
    fake.runAll();

    expect(flushed).toEqual([]);
    expect(fake.pendingTimers).toBe(0);
  });

  it("flushes immediately when asked", async () => {
    const fake = createFakeTimers();
    const flushed: string[] = [];
    const scheduler = createPreviewScheduler<string>({
      onFlush: async (payload) => {
        flushed.push(payload);
      },
      scheduler: fake.timers,
    });

    scheduler.request("only");
    scheduler.flushNow();
    await flushMicrotasks();

    expect(flushed).toEqual(["only"]);
    expect(fake.pendingTimers).toBe(0);
  });

  it("keeps a rejected flush from escaping as an unhandled rejection", async () => {
    const fake = createFakeTimers();
    const scheduler = createPreviewScheduler<string>({
      onFlush: async () => {
        throw new Error("helper unavailable");
      },
      scheduler: fake.timers,
    });

    scheduler.request("a");
    expect(() => fake.runAll()).not.toThrow();
    await Promise.resolve();
  });
});

describe("generation guard", () => {
  it("treats the newest batch as current and older ones as stale", () => {
    const guard = createGenerationGuard();

    const first = guard.begin();
    const second = guard.begin();

    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });

  it("invalidates every in-flight batch", () => {
    const guard = createGenerationGuard();
    const inFlight = guard.begin();

    guard.invalidate();

    expect(inFlight()).toBe(false);
  });
});
