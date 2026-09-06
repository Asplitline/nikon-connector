# Nikon Connector TODO

## 当前产品定位

现阶段 Nikon Connector 的核心价值仍然是：

> **连接 Nikon Z6III，在不完整导入整张卡的前提下快速做第一轮初筛。**

相机直连阶段优先速度，允许使用相机 thumbnail / embedded preview / display preview 完成快速浏览、Pick/Reject、星级和初筛。

下一阶段增加第二条核心能力：

> **一旦图片已经在本地，预览质量必须进入 Native Quality，不再接受 WebView、中间 JPEG 或低分辨率 preview 带来的清晰度妥协。**

质量基线：

1. Finder Quick Look（Space）——主实现基线。
2. Preview.app ——视觉对比基线。

设计文档：

- `docs/superpowers/specs/2026-09-06-native-preview-engine-design.md`
- `docs/superpowers/specs/2026-09-06-source-switch-local-state-metadata-design.md`
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

# P0 — Source Switch / Local Photo Browser

## 3. 同一工作区支持 Z6III ↔ 本地目录切换

目标交互：

```text
Source
├── Nikon Z6III    ● Connected
└── Local Folder   /Users/.../Photos
```

- [ ] 相机连接成功后，Z6III 作为一个可切换 source 展示。
- [ ] 用户切换到 `Local Folder` 时，如果当前 session 还没有目录，则弹出文件夹选择器。
- [ ] 选择目录后在原有 workspace 中直接切成本地 catalog + Native Quality preview。
- [ ] 从本地目录切回 Z6III 时恢复相机 catalog 和之前的选中位置。
- [ ] 切换 source 不主动断开相机，健康的相机 session 保持连接。
- [ ] Camera 和 Local Folder 各自保存 selectedPhoto / filmstrip scroll / filter / sort 状态。
- [ ] 支持 macOS 正常目录和有效的软链目录。
- [ ] 软链目录使用 canonical path 做文件 identity/cache 去重；断开的软链给出明确错误。

**验收：** 用户可以在一个窗口里反复 `Z6III -> Local Folder -> Z6III`，不需要重新连接相机，也不会丢失之前的相机选片位置。

---

## 4. 支持加载本地图片目录

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

## 5. 本地 filmstrip 缩略图走 `QLThumbnailGenerator`

- [ ] 使用 QuickLookThumbnailing 生成本地 thumbnail。
- [ ] 根据 Retina backing scale 请求实际像素密度。
- [ ] thumbnail cache key 包含 canonical path + file size + modified time + requested size + scale。
- [ ] 文件变更后自动失效旧 thumbnail。
- [ ] 只加载 visible window + buffer 范围。
- [ ] 2000+ 图片继续保持 DOM virtualization。

**目标：** 本地 filmstrip 清晰度、orientation 和 Finder 缩略图一致性达到系统级表现。

---

# P0 — Local State / Unified Photo Source

## 6. 相机图片下载/导出后，在原条目上标记为“本地”

相机图片下载到 managed cache 或导出到用户目录后，不能创建一个与原照片无关的新条目。

状态模型至少包括：

```ts
type PhotoLocalState =
  | { status: "none" }
  | { status: "downloading"; progress?: number }
  | {
      status: "available";
      preferredPath: string;
      copies: Array<{
        kind: "cache" | "export";
        filePath: string;
        canonicalPath: string;
      }>;
    }
  | { status: "missing"; previousPath: string };
```

- [ ] 相机原条目保留 cameraId/storageId/objectHandle identity。
- [ ] 下载完成后把 local path 挂回原 camera item。
- [ ] 导出完成后把 exported path 挂回原 camera item。
- [ ] filmstrip 缩略图显示小型“本地”标记。
- [ ] inspector 显示 `Local` 状态以及 Cache / Exported 路径来源。
- [ ] 下载中显示 `下载中` 状态。
- [ ] 本地文件被移动/删除后显示 `本地文件丢失`。
- [ ] 不能因为存在本地副本就在 camera catalog 里再复制一个 thumbnail/item。
- [ ] localState 从 none -> available 的过程中保持 rating / Pick / Reject / selection 不变。

**验收：** Z6III 上的一张照片下载成功后，原来的那张照片立即出现“本地”状态，并在不重新选择的情况下切到 Native Quality。

---

## 7. 统一 Camera / Local / Exported 显示模型

推荐：

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
    };

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
localState.available / localFilePath exists
    ↓
Native Quality / QLPreviewView

camera-only
    ↓
Camera Review Quality
```

- [ ] 切换渲染路径不改变 photo selection identity。
- [ ] 切换质量不丢失 rating / Pick / Reject。
- [ ] 后续 RAW+JPG pairing 也建立在同一 source/display 模型上。

---

# P0 — Photo Metadata

## 8. 补齐照片基础拍摄元信息

元信息是预览器核心能力，不再只放到后续 Shooting Review。

至少统一以下字段：

```ts
type PhotoMetadata = {
  capturedAt?: string;
  width?: number;
  height?: number;

  cameraMake?: string;
  cameraModel?: string;
  lensModel?: string;

  focalLengthMm?: number;
  focalLength35mm?: number;
  apertureFNumber?: number;
  exposureTimeSeconds?: number;
  shutterSpeedLabel?: string;
  iso?: number;
  exposureCompensationEv?: number;

  orientation?: number;
  colorSpace?: string;
  whiteBalance?: string;
  meteringMode?: string;
};
```

Inspector 第一优先展示：

- [ ] 相机型号
- [ ] 镜头型号
- [ ] 焦段
- [ ] 光圈
- [ ] 快门
- [ ] ISO
- [ ] 拍摄时间
- [ ] 图片尺寸

可继续补：

- [ ] 35mm 等效焦段
- [ ] 曝光补偿
- [ ] 白平衡
- [ ] 测光模式
- [ ] 色彩空间
- [ ] orientation

显示示例：

```text
Nikon Z6III
NIKKOR Z 24-120mm f/4 S
70 mm
f/4
1/250 s
ISO 800
2026-09-06 18:42:31
6048 × 4032
```

### 本地文件 metadata

```text
Local Original
-> ImageIO / CGImageSource metadata
-> normalize PhotoMetadata
-> inspector/catalog
```

- [ ] 本地 JPG/HEIC/PNG/TIFF/NEF 尽可能从原文件读取 metadata。
- [ ] 相机下载/导出后，以本地原文件 metadata 为更高优先级来源。

### Camera-only metadata

```text
Camera catalog first
-> selected/visible photo
-> lazy metadata request
-> catalog merge
```

- [ ] 相机 catalog 首屏不能等待整卡 EXIF。
- [ ] selected photo metadata 优先加载。
- [ ] visible items 可低优先级加载。
- [ ] metadata merge 不得覆盖 rating / Pick / Reject / preview / localState。
- [ ] 明确区分 idle / loading / loaded / unavailable / error。

**验收：** 本地 JPG 和 Z6III NEF 在有相应 EXIF 的情况下，都能看到镜头、焦段、光圈、快门、ISO、拍摄时间和尺寸；相机直连 selected item 也能渐进得到这些字段。

---

# P0 — Camera -> Native Quality

## 9. 支持下载原图后高清查看

相机初筛阶段保持快速 preview。

用户明确要求高清查看时：

```text
Camera Photo
-> Download Original
-> Managed Local Cache
-> localState = available
-> Local badge
-> QLPreviewView
-> Native Quality
```

- [ ] 新增下载原图用于预览的命令。
- [ ] 保留 camera/storage/objectHandle 等 source identity。
- [ ] 下载完成前继续显示 Review Quality。
- [ ] 完整下载成功后原 camera item 自动切 Native Quality。
- [ ] 失败/取消不破坏原有相机 preview。
- [ ] 不因为左右快速切图自动下载大量 NEF 原图。
- [ ] managed original cache 可清理、可失效、有大小策略。

**验收：** 下载后的 NEF/JPG 与 Finder Quick Look / Preview.app 使用同一份文件比较，预览不再受当前 camera display preview 清晰度限制。

---

## 10. 批量导出图片后直接进入 Native Quality

```text
Selected Camera Photos
-> Export Originals
-> User Folder
-> localState = available
-> Local badge
-> QLPreviewView
```

- [ ] 每个成功导出的结果返回最终绝对文件路径。
- [ ] 导出后将路径挂回对应 camera catalog item。
- [ ] 点击已导出图片时直接读取导出 original。
- [ ] 不再复制一份预览 JPEG 到 app cache 才显示。
- [ ] 保留 “Show in Finder”。
- [ ] 后续补齐 export progress / cancel / duplicate / error handling。

---

# P0 — Native Quality Regression Gate

## 11. 固化清晰度与色彩测试集

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

## 12. Swift -> Rust -> React 真 streaming

当前 `photos:batch` 仍然是在 Rust 拿到完整 native catalog 后再 chunk。

- [ ] Swift daemon 在 `list-photos` 过程中直接 emit progress batches。
- [ ] Rust 不再跳过 helper progress。
- [ ] Tauri 收到 native batch 后立即 emit `photos:batch`。
- [ ] terminal result 只返回 count/completion。
- [ ] 支持旧 generation 取消/忽略。

**验收：** 大卡第一批照片无需等待整卡枚举结束。

---

## 13. 轻量 Camera Catalog

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
- [ ] EXIF lazy load，并复用统一 `PhotoMetadata` 模型。

---

# P1 — Release Ready

## 14. Swift camera helper Tauri sidecar

- [ ] release helper build。
- [ ] helper 作为 Tauri sidecar/external binary 打包。
- [ ] Runtime 优先寻找 app bundle helper。
- [ ] 保留 `NIKON_CAMERA_HELPER` 开发 override。
- [ ] 删除发布版本对源码 `.build/debug` 路径依赖。
- [ ] DMG 干净环境真机 smoke test。

## 15. Signing / Notarization

- [ ] Developer ID signing。
- [ ] Hardened Runtime / entitlements。
- [ ] helper + main app 同一发布签名链路。
- [ ] Apple notarization。
- [ ] stapling。
- [ ] Gatekeeper 验证。

---

# P1 — Export Reliability

## 16. 导出可靠性

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

## 17. CI

PR 至少运行：

- [ ] `bun run lint`
- [ ] `bun run test`
- [ ] `bun run build`
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] `swift test --package-path native/macos-camera-helper`
- [ ] release helper build smoke check

---

# P2 — Nikon Metadata / RAW Workflow

## 18. Nikon Rating Write-back

- [ ] 验证 Nikon Remote Module SDK 2.0.0 Z6III rating API。
- [ ] 真实 capability probe。
- [ ] rating command 使用 camera identity，而不是 mock catalog 查找。
- [ ] SDK 不支持时继续 local-only rating。
- [ ] UI 区分 Local / Camera metadata 保存状态。

## 19. RAW + JPG Pair

- [ ] 同 stem `.NEF + .JPG` 合并为一个 review item。
- [ ] camera review 阶段优先 JPG/embedded preview。
- [ ] 本地存在 original 后统一走 Native Quality。
- [ ] rating / Pick 一次作用于 pair。
- [ ] 导出支持 RAW / JPG / RAW+JPG。

## 20. Shooting Review

这里建立在已经完成的 `PhotoMetadata` 基础上，做分析而不是重新实现 EXIF：

- [ ] lens / focal length / aperture / shutter / ISO 聚合。
- [ ] keeper rate 与拍摄参数关联。
- [ ] 高 ISO / 低快门风险提示。

---

# 建议版本节奏

## v0.2.0 — Native Photo Browser

核心交付：

- embedded `QLPreviewView`
- Z6III / Local Folder source 切换
- 本地目录加载
- Quick Look thumbnails
- 统一 PhotoMetadata（光圈/焦段/快门/ISO/镜头等）
- 本地 original Native Quality
- camera original download -> 原条目 Local 标记 -> Native Quality
- export original -> 原条目 Local 标记 -> Native Quality
- Finder Quick Look + Preview.app regression gate

## v0.3.0 — Fast Camera Culling

核心交付：

- true native catalog streaming
- lightweight camera catalog
- viewport thumbnails
- camera lazy EXIF
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
- shooting review analytics

---

# 当前执行顺序

1. **QLPreviewView Tauri 内嵌 Spike：JPG + NEF**
2. **Native Preview Bridge 稳定化**
3. **Z6III / Local Folder source switch**
4. **本地目录 + QLThumbnailGenerator**
5. **统一 Camera / Local source + localState 模型**
6. **统一 PhotoMetadata + Inspector 展示**
7. **Camera original download -> Local 标记 -> Native Quality**
8. **Batch export -> Local 标记 -> Native Quality**
9. **Native Quality regression gate**
10. **Camera streaming / lightweight catalog / lazy EXIF**
11. **Sidecar / signing / CI / export reliability**
12. **Nikon SDK / RAW+JPG / Shooting Review**

下一阶段第一目标：

> **先建立一条长期稳定、没有清晰度妥协的 macOS Native Preview 基础链路，同时让 Z6III 与本地目录在同一工作区自由切换，并把“是否已有本地原图”和完整拍摄元信息变成照片的一等状态。**
