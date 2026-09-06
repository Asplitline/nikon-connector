import type { CameraConnectionState } from "../photos/types";

// 连接状态的圆点标记:纯装饰,语义由同组的文字标签承担,故 aria-hidden。
// 用 Record 而非三元链,新增连接状态时 TypeScript 会强制补齐配色
const dotTone: Record<CameraConnectionState, string> = {
  connected: "bg-ready",
  error: "bg-danger",
  loading: "bg-muted",
  not_connected: "bg-muted",
};

export function StatusDot({ state }: { state: CameraConnectionState }) {
  return (
    <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dotTone[state]} opacity-75`} />
  );
}
