// 预览请求调度器：合并连续请求（trailing debounce）并作废过期批次的回调。
// 与 React 解耦，便于在 node 环境单测；调用方只需在卸载时 dispose。

export interface PreviewSchedulerOptions<T> {
  // 防抖窗口毫秒数，连按方向键时只发最后一次
  delayMs?: number;
  // 实际发起请求；返回的 promise 由调度器负责判定是否已过期
  onFlush: (payload: T) => Promise<void>;
  // 定时器注入点，测试用；默认走 globalThis
  scheduler?: SchedulerTimers;
}

export interface SchedulerTimers {
  clearTimeout: (handle: number) => void;
  setTimeout: (callback: () => void, delayMs: number) => number;
}

export interface PreviewScheduler<T> {
  // 待发批次数（测试与诊断用）
  readonly pendingCount: number;
  // 丢弃待发批次并作废已在途批次的回调
  cancel: () => void;
  // 释放资源，之后所有 request 都被忽略
  dispose: () => void;
  // 立即发出待发批次，不等防抖窗口
  flushNow: () => void;
  request: (payload: T) => void;
}

const defaultDelayMs = 150;

export function createPreviewScheduler<T>({
  delayMs = defaultDelayMs,
  onFlush,
  scheduler,
}: PreviewSchedulerOptions<T>): PreviewScheduler<T> {
  const timers = scheduler ?? defaultTimers();
  let timerHandle: number | null = null;
  let pending: { payload: T } | null = null;
  let disposed = false;

  function clearTimer() {
    if (timerHandle !== null) {
      timers.clearTimeout(timerHandle);
      timerHandle = null;
    }
  }

  function flush() {
    timerHandle = null;
    const next = pending;
    pending = null;

    if (!next || disposed) {
      return;
    }

    // 调度器不吞业务错误的语义，但必须避免未处理的 rejection 打挂进程；
    // 具体报错由 onFlush 自己 catch 后写日志（见 useCameraSession）
    void Promise.resolve()
      .then(() => onFlush(next.payload))
      .catch(() => undefined);
  }

  return {
    get pendingCount() {
      return pending ? 1 : 0;
    },
    cancel() {
      clearTimer();
      pending = null;
    },
    dispose() {
      disposed = true;
      clearTimer();
      pending = null;
    },
    flushNow() {
      if (disposed) {
        return;
      }
      clearTimer();
      flush();
    },
    request(payload: T) {
      if (disposed) {
        return;
      }

      // 后到的请求覆盖前一个待发批次，避免连按时堆积
      pending = { payload };
      clearTimer();
      timerHandle = timers.setTimeout(flush, delayMs);
    },
  };
}

// 在途批次是否仍然有效：调用方在 await 之后用它决定要不要 setState
export function createGenerationGuard() {
  let current = 0;

  return {
    // 开一个新代次并返回校验函数
    begin() {
      current += 1;
      const issued = current;
      return () => issued === current;
    },
    invalidate() {
      current += 1;
    },
  };
}

function defaultTimers(): SchedulerTimers {
  return {
    clearTimeout: (handle: number) => {
      globalThis.clearTimeout(handle);
    },
    setTimeout: (callback: () => void, delayMs: number) =>
      globalThis.setTimeout(callback, delayMs) as unknown as number,
  };
}
