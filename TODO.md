# Nikon Connector TODO

## 当前产品定位

现阶段 Nikon Connector 的核心价值仍然是：

> **连接 Nikon 相机，在不完整导入整张卡的前提下快速做第一轮初筛。**

相机直连阶段优先速度，允许使用相机 thumbnail / embedded preview / display preview 完成快速浏览、Pick/Reject、星级和初筛。

下一阶段增加第二条核心能力：

> **一旦图片已经在本地，预览质量必须进入 Native Quality，不再接受 WebView、中间 JPEG 或低分辨率 preview 带来的清晰度妥协。**

质量基线：

1. Finder Quick Look（Space）——主实现基线。
2. Preview.app ——视觉对比基线。

设计文档：

- `docs/superpowers/specs/2026-09-06-native-preview-engine-design.md`
- `docs/superpowers/plans/2026-09-06-native-preview-engine.md`

---

# P0 — Native Preview Engine

## 1. 在 Tauri 主窗口内嵌 `QLPreviewView`

- [ ] 在 Tauri 主进程加入 macOS QuickLookUI/AppKit bridge。
- [ ] 使用 `QLPreviewView`，不使用独立 `QLPreviewPanel`。
- [ ] Native preview 作为 `NSView` 嵌在现有 Nikon Connector 窗口中。
- [ ] React 继续负责 toolbar/sidebar/filmstrip/inspector/rating/pick/filter。
- [ ] React preview placeholder 与 native view frame 实时同步。
- [ ] 处理窗口 resize、sidebar 折叠、filmstrip 高度变化、fullscreen。
- [ ] 保证 native view 不遮挡其他 React 控件。
- [ ] 验证 native preview 与现有键盘选片工作流共存。

**第一道 Gate：**

使用同一张高分辨率 JPG 和一张 Nikon Z6III NEF，对比：

```text
Nikon Connector
Finder Quick Look
Preview.app
```

必须验证：

- fit-to-window 清晰度；
- 100% 焦点细节；
- 色彩观感；
- EXIF orientation；
- Retina 缩放；
- 窗口 resize；
- 快速切图；
- 整个预览始终在软件内部。

---

## 2. 本地主预览禁止中间转码

Native Quality 的硬规则：

```text
Original Local File
        ↓
    NSURL
        ↓
  QLPreviewView
```

- [ ] JPG/HEIC/PNG/TIFF 直接传原文件 URL。
- [ ] NEF/NRW 直接传本地 RAW 文件 URL。
- [ ] 本地主预览禁止为了显示而生成中间 JPEG/PNG。
- [ ] `<img>` / WebKit 不作为 Native Quality 最终渲染器。
- [ ] ImageIO 只用于 metadata、fallback、相机侧 preview 等辅助场景。

**验收：** 有本地 original file path 时，主预览永远优先 native path。

---

# P0 — Local Photo Browser

## 3. 支持加载本地图片目录

流程：

```text
Open Folder
-> enumerate files
-> build catalog
-> Quick Look thumbnails
-> select
-> QLPreviewView(original)
```

首期格式：

- [ ] JPG/JPEG
- [ ] HEIC/HEIF
- [ ] PNG
- [ ] TIFF/TIF
- [ ] NEF/NRW

要求：

- [ ] 使用原有 review workspace，不新建第二套浏览器 UI。
- [ ] 使用现有 filmstrip virtualization。
- [ ] 使用现有筛选、排序、Pick/Reject、rating 基础能力。
- [ ] 第一版先支持一个文件夹的直接子文件扫描。
- [ ] 本地图片切换直接进入 Native Quality。
- [ ] 文件消失/移动时给出明确状态。

---

## 4. 本地 filmstrip 缩略图走 `QLThumbnailGenerator`

- [ ] 使用 QuickLookThumbnailing 生成本地 thumbnail。
- [ ] 根据 Retina backing scale 请求实际像素密度。
- [ ] thumbnail cache key 包含 path + file size + modified time + requested size + scale。
- [ ] 文件变更后自动失效旧 thumbnail。
- [ ] 只加载 visible window + buffer 范围。
- [ ] 2000+ 图片继续保持 DOM virtualization。

**目标：** 本地 filmstrip 清晰度、orientation 和 Finder 缩略图一致性达到系统级表现。

---

# P0 — Unified Photo Source

## 5. 统一 Camera / Local / Exported 数据模型

目标模型：

```ts
type PhotoSource =
  | {
      kind: "camera";
      cameraId: string;
      storageId?: string;
      objectHandle?: number;
    }
  | {
      kind: "local";
      filePath: string;
    }
  | {
      kind: "exported";
      filePath: string;
      sourceCameraId?: string;
      sourceObjectHandle?: number;
    };
```

显示能力：

```ts
type DisplayAsset = {
  source: PhotoSource;
  localFilePath?: string;
  reviewPreviewUrl?: string;
  thumbnailUrl?: string;
  quality: "review" | "native";
};
```

路由规则：

```text
localFilePath exists
    ↓
Native Quality / QLPreviewView

no localFilePath
    ↓
Camera Review Quality
```

- [ ] 切换渲染路径不改变 photo selection identity。
- [ ] 切换质量不丢失 rating / Pick / Reject。
- [ ] 后续 RAW+JPG pairing 也建立在同一 source/display 模型上。

---

# P0 — Camera -> Native Quality

## 6. 支持下载原图后高清查看

相机初筛阶段保持快速 preview。

用户明确要求高清查看时：

```text
Camera Photo
-> Download Original
-> Managed Local Cache
-> localFilePath
-> QLPreviewView
-> Native Quality
```

- [ ] 新增下载原图用于预览的命令。
- [ ] 保留 camera/storage/objectHandle 等 source identity。
- [ ] 下载完成前继续显示 Review Quality。
- [ ] 完整下载成功后再切 Native Quality。
- [ ] 失败/取消不破坏原有相机 preview。
- [ ] 不因为左右快速切图自动下载大量 NEF 原图。
- [ ] managed original cache 可清理、可失效、有大小策略。

**验收：** 下载后的 NEF/JPG 与 Finder Quick Look / Preview.app 使用同一份文件比较，预览不再受当前 camera display preview 清晰度限制。

---

## 7. 批量导出图片后直接进入 Native Quality

```text
Selected Camera Photos
-> Export Originals
-> User Folder
-> exported localFilePath
-> QLPreviewView
```

- [ ] 每个成功导出的结果返回最终绝对文件路径。
- [ ] 导出后将路径挂回对应 catalog item。
- [ ] 点击已导出图片时直接读取导出 original。
- [ ] 不再复制一份预览 JPEG 到 app cache 才显示。
- [ ] 保留 “Show in Finder”。
- [ ] 后续补齐 export progress / cancel / duplicate / error handling。

---

# P0 — Native Quality Regression Gate

## 8. 固化清晰度与色彩测试集

至少准备：

- [ ] 高分辨率 sRGB JPG
- [ ] Display P3 JPG/HEIC
- [ ] 带 EXIF orientation 的竖图
- [ ] 超大 JPG
- [ ] 透明 PNG
- [ ] TIFF
- [ ] Nikon Z6III NEF
- [ ] 相机导出的 JPG
- [ ] 相机导出的 NEF

每次 Native Preview 相关变更都比较：

```text
Nikon Connector
vs Finder Quick Look
vs Preview.app
```

检查：

- [ ] fit 清晰度
- [ ] 100% 细节
- [ ] orientation
- [ ] 色彩
- [ ] Retina scaling
- [ ] resize
- [ ] 连续切图
- [ ] fullscreen

---

# P1 — Camera Performance

Native Preview Foundation 通过后继续优化相机初筛性能。

## 9. Swift -> Rust -> React 真 streaming

当前 `photos:batch` 仍然是在 Rust 拿到完整 native catalog 后再 chunk。

- [ ] Swift daemon 在 `list-photos` 过程中直接 emit progress batches。
- [ ] Rust 不再跳过 helper progress。
- [ ] Tauri 收到 native batch 后立即 emit `photos:batch`。
- [ ] terminal result 只返回 count/completion。
- [ ] 支持旧 generation 取消/忽略。

**验收：** 大卡第一批照片无需等待整卡枚举结束。

---

## 10. 轻量 Camera Catalog

相机加载分层：

```text
L0 catalog     filename/handle/storage/size/date/type
L1 thumbnail   visible window + buffer
L2 preview     selected + small lookahead
L3 EXIF        selected first, lazy enrichment
```

- [ ] `listPhotos` 不再整卡请求 shooting metadata。
- [ ] `listPhotos` 不再固定缓存前 80 张。
- [ ] thumbnail 完全 viewport-driven。
- [ ] selected preview 最高优先级。
- [ ] EXIF lazy load。

---

# P1 — Release Ready

## 11. Swift camera helper Tauri sidecar

- [ ] release helper build。
- [ ] helper 作为 Tauri sidecar/external binary 打包。
- [ ] Runtime 优先寻找 app bundle helper。
- [ ] 保留 `NIKON_CAMERA_HELPER` 开发 override。
- [ ] 删除发布版本对源码 `.build/debug` 路径依赖。
- [ ] DMG 干净环境真机 smoke test。

## 12. Signing / Notarization

- [ ] Developer ID signing。
- [ ] Hardened Runtime / entitlements。
- [ ] helper + main app 同一发布签名链路。
- [ ] Apple notarization。
- [ ] stapling。
- [ ] Gatekeeper 验证。

---

# P1 — Export Reliability

## 13. 导出可靠性

- [ ] 整体/逐项 progress。
- [ ] cancel。
- [ ] duplicate detection。
- [ ] copied / skipped / failed 明细。
- [ ] 空间不足处理。
- [ ] 目录权限错误处理。
- [ ] 相机断连恢复。
- [ ] Finder handoff。

---

# P1 — Engineering Gate

## 14. CI

PR 至少运行：

- [ ] `bun run lint`
- [ ] `bun run test`
- [ ] `bun run build`
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] `swift test --package-path native/macos-camera-helper`
- [ ] release helper build smoke check

---

# P2 — Nikon Metadata / RAW Workflow

## 15. Nikon Rating Write-back

- [ ] 验证 Nikon Remote Module SDK 2.0.0 Z6III rating API。
- [ ] 真实 capability probe。
- [ ] rating command 使用 camera identity，而不是 mock catalog 查找。
- [ ] SDK 不支持时继续 local-only rating。
- [ ] UI 区分 Local / Camera metadata 保存状态。

## 16. RAW + JPG Pair

- [ ] 同 stem `.NEF + .JPG` 合并为一个 review item。
- [ ] camera review 阶段优先 JPG/embedded preview。
- [ ] 本地存在 original 后统一走 Native Quality。
- [ ] rating / Pick 一次作用于 pair。
- [ ] 导出支持 RAW / JPG / RAW+JPG。

## 17. Shooting Review

- [ ] lens / focal length / aperture / shutter / ISO 聚合。
- [ ] keeper rate 与拍摄参数关联。
- [ ] 高 ISO / 低快门风险提示。

---

# 建议版本节奏

## v0.2.0 — Native Photo Browser

核心交付：

- embedded `QLPreviewView`
- 本地目录加载
- Quick Look thumbnails
- 本地 original Native Quality
- camera original download -> Native Quality
- export original -> Native Quality
- Finder Quick Look + Preview.app regression gate

## v0.3.0 — Fast Camera Culling

核心交付：

- true native catalog streaming
- lightweight camera catalog
- viewport thumbnails
- lazy EXIF
- 大卡浏览性能

## v0.4.0 — Distribution & Export Reliability

核心交付：

- helper sidecar
- signing/notarization
- CI/release gate
- export progress/cancel/error recovery

## v0.5.0 — Nikon Metadata & RAW Workflow

核心交付：

- Nikon rating write-back（SDK 支持时）
- RAW+JPG pairing
- shooting review

---

# 当前执行顺序

1. **QLPreviewView Tauri 内嵌 Spike：JPG + NEF**
2. **Native Preview Bridge 稳定化**
3. **本地目录 + QLThumbnailGenerator**
4. **统一 Camera / Local / Exported source model**
5. **Camera original download -> Native Quality**
6. **Batch export -> Native Quality**
7. **Native Quality regression gate**
8. **Camera streaming / lightweight catalog**
9. **Sidecar / signing / CI / export reliability**
10. **Nikon SDK / RAW+JPG / Shooting Review**

下一阶段第一目标已经从“先发布”调整为：

> **先建立一条长期稳定、没有清晰度妥协的 macOS Native Preview 基础链路，再让相机、本地和导出工作流全部接入它。**
