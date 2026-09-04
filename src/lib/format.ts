import { convertFileSrc } from "@tauri-apps/api/core";

// 把缓存文件路径转成 WebView 可加载的 asset URL；已带协议的地址原样返回
export function imageSource(url: string) {
  return !url || /^(https?:|asset:|data:|blob:)/i.test(url)
    ? url
    : convertFileSrc(url);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
