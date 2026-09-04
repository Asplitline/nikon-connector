# 照片加载性能：架构诊断与相对最优解

## 目的

回答两个问题：

1. 为什么浏览相机卡上的照片这么卡 —— 根因在哪，量化多少
2. **在不换掉整个 app 的前提下**，如何对标挑片领域的最优实现（而非仅仅追平原生）

结论先行：当前卡顿不是「代码没调优」，而是**架构选型限定了优化上限**。
在现有架构内做前端优化，最多把「卡得难以使用」变成「卡得可以忍受」。

**标杆不是 Nikon 官方软件。** 它们在 1000+ NEF 时普遍崩溃（第 8 节实证），
是「不能比它差」的下限，不是目标。真正要对标的是挑片领域的最优实现
（Photo Mechanic / FastRawViewer 一类以「快」为核心卖点的专业工具）。

而「超越」同样可达：这些工具都没有利用 `ICCameraFile.fingerprint`
做**跨会话、跨重连的内容级缓存** —— 它们付的是「每次连接」的成本，
我们可以只付「每张照片一次」的成本。详见第九节。

**画质是硬约束，不是可调项。** 挑片的核心动作是判断对焦是否准，
降采样会直接导致误判。任何「为了快而降画质」的方案不予采纳 ——
快用缓存与预取换，不用画质换。

本文所有性能数字都是实测或来自 SDK 头文件原文，推断与未验证项显式标注。

---

## 一、当前架构

```
React (App.tsx)
  │  invoke（阻塞式请求-响应）
  ▼
Rust (lib.rs → camera/mod.rs → helper_bridge.rs)
  │  Command::new(helper).output()   ← 每次调用新建子进程
  ▼
Swift nikon-camera-helper（一次性进程，跑完即退出）
  │  ICDeviceBrowser.start() + requestOpenSession()
  ▼
ImageCaptureCore → USB → Nikon Z6III
```

关键性质：**helper 是一次性子进程**。每个 `list_photos` / `cache_photo_previews`
都要重新走一遍「启动进程 → 扫描设备 → 打开会话 → 等待目录」。

---

## 二、根因实测

### 2.1 本机实测（2026-09-04，Apple Silicon，无相机连接）

| 命令 | timeout | real 耗时 | 其中 browser scan | initialScanFinished |
|---|---|---|---|---|
| `list-cameras` | 3.0s | **3.38s** | 3.03s | false |
| `cache-photo-previews`（5 个 id） | 8.0s | **8.01s** | 8.01s | false |

`initialScanFinished=false` 是决定性证据：
[`ImageCaptureCameraStore.swift:327-339`](../../native/macos-camera-helper/Sources/NikonCameraHelper/ImageCaptureCameraStore.swift#L327-L339)
的 `startBrowser` 死等 `didAdd(moreComing: false)` 回调，**没有提前退出路径**，
所以会跑满整个 timeout。

这段耗时发生在**任何图像字节传输之前**，与照片数量、文件大小完全无关。

### 2.2 真机数据（本仓库既有，2477 张卡，USB 2.0）

来自 [`gphoto2-ptp-z6iii.md`](gphoto2-ptp-z6iii.md)：

| gphoto2 命令 | 耗时 | 数据量 |
|---|---|---|
| `--get-thumbnail 1` | 11.20s | 8.7 KB |
| `--get-thumbnail 1-10` | 11.29s | 10 张 |
| `--get-file 1` | 11.72s | 8.3 MB |

取 8.7KB 和取 8.3MB 耗时几乎相同 → **固定开销压倒实际传输**。
批量取 10 张几乎不比取 1 张贵 → **批量摊薄非常有效**。

### 2.3 当前架构的理论下限

预览队列 `radius=2`，每批最多 5 张
（[`previewQueue.ts`](../../src/features/photos/previewQueue.ts)）：

```
2477 张 ÷ 5 张/批 = 495 批
495 批 × 8s 固定开销 = 66 分钟
```

**浏览完一张卡需要 66 分钟的纯等待**，不含任何图像传输时间。

这就是「优化上限被架构固定」的具体含义。前端再怎么调，这 495 次子进程冷启动都省不掉。

---

## 三、三个放大器（前端）

### 3.1 无防抖、无取消

[`App.tsx:322`](../../src/App.tsx#L322) 的预览 effect 依赖 `catalogView.selectedPhotoId`，
既没有 debounce 也没有 `AbortController`。

`createSingleFlight` 只包裹了 `runCameraLoad`（[`App.tsx:182`](../../src/App.tsx#L182)），
**没有包裹预览路径**。

后果：每按一次方向键就叠加一个 8 秒子进程，连按 10 次 → 10 个并发子进程同时抢 USB。
体感是「越用越卡，最后完全无响应」。

### 3.2 首屏被 80 张缩略图阻塞

[`ImageCaptureCameraStore.swift:60`](../../native/macos-camera-helper/Sources/NikonCameraHelper/ImageCaptureCameraStore.swift#L60)
在 `list_photos` 内部同步执行 `cacheImages(prefix(80))`，跑完才 return。
照片列表在此期间一张都显示不出来。

### 3.3 胶片条全量渲染

[`App.tsx:878`](../../src/App.tsx#L878) 直接 `catalogView.photos.map(...)`，
无虚拟化；`<img>` 也没有 `loading="lazy"`。
2477 张 → 2477 个 DOM 节点 + 2477 个并发图片解码。

---

## 四、结构性天花板（这是重点）

前面三个是「可以修的 bug」。下面两个是**架构决策**，不换掉就永远达不到流畅。

### 4.1 契约层：一次性全量返回

```ts
// src/lib/cameraApi.ts
listPhotos(cameraId: string): Promise<CameraPhoto[]>
```

```ts
// src/features/photos/types.ts
interface PhotoCatalogState {
  photos: CameraPhoto[];        // 单一扁平数组
  selectedPhotoId: string | null;
}
```

这个签名**在契约层面就排除了渐进式交付**。即使后端改成流式，
`Promise<CameraPhoto[]>` 也只能等全部就绪后一次性 resolve。

而 Tauri 2 的 `emit`/`listen` 事件通道**现成可用但全项目零使用**
（`rg` 确认无任何 `emit`/`listen`）。
`tauri.conf.json` 的 `assetProtocol` 已启用且 scope 为 `$APPCACHE/**`，
渐进式投递缓存预览**不需要改任何安全配置**。

### 4.2 进程模型：一次性子进程

`Command::new(helper).output()`（[`helper_bridge.rs:104`](../../src-tauri/src/camera/helper_bridge.rs#L104)）
决定了每批必付一次会话冷启动。这是 66 分钟的直接来源。

---

## 五、ImageCaptureCore 能力核对（SDK 头文件原文）

来源：`$(xcrun --show-sdk-path)/System/Library/Frameworks/ImageCaptureCore.framework/Headers/`

### 5.1 缩略图缓存语义 —— 解释了「为什么反复看同一张还是慢」

`ICCameraItem.h` 原文：

> "Only the embedded EXIF thumbnail, or a created thumbnail of EXIF standard
> size (160x120) will be cached."
> "**Custom thumbnail requests will never be cached.**"
> "Use of this key will be ignored if `ICImageSourceShouldCache` has also been passed in."

当前代码用的 512px（[:482](../../native/macos-camera-helper/Sources/NikonCameraHelper/ImageCaptureCameraStore.swift#L482)）
和 2400px（[:503](../../native/macos-camera-helper/Sources/NikonCameraHelper/ImageCaptureCameraStore.swift#L503)）
**都属于 custom size → 框架层永不缓存**，每次都重新向相机取。

→ app 侧自建磁盘缓存是**必须**的（现在已有，方向正确），但不能指望框架帮忙缓存。

### 5.2 增量投递：API 层面已支持，当前代码放弃了

`cameraDevice(_:didAdd items:)` 与 `deviceDidBecomeReady(withCompleteContentCatalog:)`
是**两个独立回调**。前者在目录逐步枚举时就会触发。

当前代码只等后者（`while !contentCatalogFinished ...`，
[:51](../../native/macos-camera-helper/Sources/NikonCameraHelper/ImageCaptureCameraStore.swift#L51)），
**整个增量窗口被丢弃**。

已写探针工具 [`Tools/catalog-timing-probe.swift`](../../native/macos-camera-helper/Tools/catalog-timing-probe.swift)
用于真机测量这个窗口有多大（无相机时干净退出，输出全 `never`，exit 0；
接相机后输出 `INCREMENTAL WINDOW: N.NNs`）。**窗口具体秒数待真机验证。**

### 5.3 未使用但关键的 API

| API | 可用性 | 用途 |
|---|---|---|
| `requestReadDataAtOffset:length:` | macOS 10.15+ | **ranged read**。只读 NEF 头部取内嵌 JPEG 预览，不拉整个 40MB RAW |
| `requestSecurityScopedURLWithCompletion` | macOS 14.0+ | 大容量存储（读卡器）直接拿 file URL，**完全绕过 PTP 逐张传输** |
| `ICCameraItem.isRaw` | 10.4+ | 正确的 RAW 判定，替代扩展名白名单 |
| `ICCameraItem.fileSystemPath` | 10.4+ | MassStorage 时的直读路径 |
| `requestMetadataDictionaryWithOptions:` | 10.15+ | 取 EXIF 不必下整图 |
| `requestDownloadWithOptions:` | 10.15+ | 返回 `NSProgress` → 导出进度条 |
| `burstUUID` / `groupUUID` / `relatedUUID` / `firstPicked` | — | 连拍分组、RAW+JPEG 配对**免费可得**，不必解析文件名 |
| `flushThumbnailCache` / `flushMetadataCache` | 10.15+ | 显式驱逐框架内缓存，配合 `ICImageSourceShouldCache` 控制内存 |
| `addedAfterContentCatalogCompleted` | 10.4+ | 区分「目录枚举完成后新拍的照片」，L3 增量合并时用于正确插入新照片 |

补充语义（`ICCameraItem.h` 原文）：

> "Multiple calls to both cache the EXIF thumbnail, and subsequently retrieve a
> larger thumbnail will work as defined."

即「先拿 EXIF 缩略图（会被缓存）→ 再按需拿大图」是**框架明确支持的两段式模式**，
正好对应第 7.2 节 L4 的分层设计。

helper 的编译 target 已是 `arm64-apple-macosx14.0`（见 `package.json` 的 `helper:build`），
所以 macOS 14 API 可以直接用。

### 5.4 三条数据通道，速度差一个数量级

由 `ICDevice.transportType` 决定（`ICTransportTypeUSB` / `ICTransportTypeMassStorage` / `ICTransportTypeTCPIP` 等）：

1. **MassStorage + `requestSecurityScopedURL`** → 本地文件直读（最快，读卡器场景）
2. **PTP + `requestReadDataAtOffset`** → ranged read 取内嵌预览（中）
3. **PTP + `requestThumbnailData(custom size)`** → 慢，且框架不缓存

**当前代码只用了第 3 条。**

---

## 六、附带发现的功能缺陷

`canRequestPreview`（[:542](../../native/macos-camera-helper/Sources/NikonCameraHelper/ImageCaptureCameraStore.swift#L542)）
白名单为 `["jpg","jpeg","heif","hif"]`，**排除了 nef/nrw**；
而 `supportedExtensions`（[:589](../../native/macos-camera-helper/Sources/NikonCameraHelper/ImageCaptureCameraStore.swift#L589)）
包含 `nef`/`nrw`。

后果：**RAW 文件会被列出，但永远拿不到 2400px 预览**，
loupe 里只能看 512px 缩略图放大。对 RAW 直出工作流是硬伤。

`requestReadDataAtOffset` + `isRaw` 正是解决这个问题的正确工具。

---

## 七、相对最优解

### 7.1 目标状态

```
React
  │  invoke（命令）+ listen（渐进式结果推送）
  ▼
Rust：单一串行化相机队列 + 常驻 helper 生命周期管理
  │  长驻 stdin/stdout JSONL 协议
  ▼
Swift helper（常驻进程，持有单个长生命周期 session）
  │  按 transportType 选通道
  ▼
① MassStorage 直读  ② ranged read 内嵌预览  ③ thumbnail 兜底
```

### 7.2 四层改动，按「收益/风险」排序

**L1 — 前端止血（不动原生层）**

- 预览 effect 加 debounce（建议 120–180ms）+ `AbortController`
- 把 `createSingleFlight` 或一个带取消的队列套到预览路径上
- 胶片条虚拟化（仅渲染可视窗口 ± 缓冲）
- `<img loading="lazy" decoding="async">`

价值：立刻消除「越按越卡」和 2477 个 DOM 节点。
**但省不掉 8 秒固定开销** —— 这是 L2 的事。
风险：低，纯前端，可独立发布。

**L2 — helper 常驻化（治本，最大收益）**

把 `Command::new().output()` 换成长驻进程 + JSONL 协议：
`list-cameras` / `list-photos` / `cache-photo-previews` / `export-photos` /
`diagnose-camera` / `shutdown`。

Rust 侧持有 helper 句柄，所有相机操作串行化通过一个 worker 队列
（PTP 会话不能并发；Rapid Photo Downloader 明确记录「同一时刻只有一个程序能访问」）；
相机断开或不可恢复错误时重启 helper。

Swift 侧照 Entangle 的形状写（第 8.1 节）：
持久 camera 对象 + 幂等连接守卫（`if camera != nil { return }`）+
一把锁串行化所有相机操作 + 后台线程投递、结果 marshal 回来。

**并且实现 `shouldGetThumbnailOfItem:`**（第 8.4 节）：
框架内部本来就是一条串行队列，所以正确做法不是「每批 5 个」，
而是**把可见项全部入队，滚出视口的通过这个回调返回 `NO` 取消**。
这一步同时解决了 L1 的 debounce 只能「延迟」而不能「撤回」的问题。

价值：8 秒只在连接时付一次。**固定成本改善约 495 倍**（2477 张卡口径）。
风险：中。需处理进程生命周期、崩溃重启、僵尸进程。
注意：session/browser 的 delegate 回调在主线程，helper 需要显式 `CFRunLoopRun()`；
不建议用 XPC service（空闲即回收，与「保温 session」冲突，见第 8.6 节）。

**L3 — 渐进式投递（解掉契约天花板）**

- 后端不再等完整 catalog，在 `didAdd(items:)` 到达时就分片 emit
- 前端从 `listPhotos(): Promise<CameraPhoto[]>` 改为
  「命令触发 + `listen` 增量合并」
- 缩略图逐张 ready 就 emit，不再批量等齐

价值：首屏时间从「等全部就绪」变成「等第一批」。这是体感上最像原生 app 的一步。
风险：中。契约变更影响 `App.tsx` 状态模型和现有测试。

**L4 — 数据通道分级 + 缩略图分层（画质不妥协）**

**原则：网格档位可以小，loupe 档位不降级。** 挑片的核心动作是判断
「对焦是否准、有没有糊」，这需要真实像素，不是「差不多能看」。
省带宽不能牺牲这一点 —— 带宽问题用**缓存与预取**解决，不用降画质解决。

| 用途 | 尺寸 | 取法 |
|---|---|---|
| 胶片条 / 网格 | 默认档（不传 options） | 命中框架 EXIF 缩略图缓存（160×120，唯一会被缓存的一档） |
| 网格 Retina | ~360–512px | custom size，落自建磁盘缓存 |
| **Loupe（适应窗口）** | **≥ 3456px 长边** | **NEF 走全画幅 `JpgFromRaw`**；JPEG/HEIF 走原文件 |
| **100% / 对焦检查** | **原始全尺寸** | 全画幅内嵌 JPEG（6048×4024）或原文件 |

**为什么 loupe 不能降到 1620 甚至 2400**（Z6III 传感器 6048×4024）：

| 档位 | 有效像素 | 在 16" MBP（3456px 长边）全屏 |
|---|---|---|
| 1620px | 1.7MP | **仅 47% 覆盖，明显模糊** |
| 2400px | 3.8MP | 69% 覆盖，仍不足 1:1 |
| 3456px | 8.0MP | 刚好 1:1 |
| 6048px（全画幅） | 24.4MP | 支持 100% 像素级对焦检查 |

→ **2400px 在 Retina 上本来就不够**，降到 1620 是错误方向。
NEF 应当直接取**全画幅 `JpgFromRaw`**（约占 NEF 体积 9–10%，
[Jeffrey Friedl](https://regex.info/blog/2006-12-08/303)）：
24.5MP 相机上约 3–5MB，而非整个 ~40MB RAW。
**这既是最高画质，又只付 10% 的传输量** —— 不是取舍，是双赢。

实现要点：

- 用 `requestReadDataAtOffset` 定位并只读 `JpgFromRaw` 段（注意 4MB 单次读上限，分片）
- **不要**用 `requestThumbnailData(maxPixelSize:)` 取 loupe 档 ——
  它永不缓存（第 5.1 节）且尺寸受相机上报限制（第 8.3 节）
- 按 `transportType` 选通道（MassStorage 走 `requestSecurityScopedURL`，全尺寸零成本）
- 缓存 key 用 `fingerprint` 或 `originalFilename` + `fileSize` + `exifCreationDate`，
  **不要只用 `ptpObjectHandle`**（跨 session 不稳定）
- 分档缓存**各存一份**，loupe 档命中后不再回传

价值：读卡器场景快一个数量级；**RAW 预览从「不可用」直接变为「全画质可用」**；
loupe 传输量降到 RAW 的 ~10% 而画质反而提升。
风险：中高。需真机验证 NEF 内嵌段定位与 4MB 分片读。

### 7.3 为什么不是「换 gphoto2」

仓库既有 [`2026-09-04-gphoto2-ptp-backend.md`](../superpowers/plans/2026-09-04-gphoto2-ptp-backend.md)
已规划 libgphoto2 后端，结论也是「持久 helper」。但要注意：

- 该 plan 的**核心价值是持久化 session，不是 gphoto2 本身**
- 持久化这件事对**现有 ImageCaptureCore 后端同样适用**，不必等 gphoto2
- 该 plan 明确写了「Keep the existing frontend camera API stable」，
  **完全没有涉及 `App.tsx`** → 即使实施完，第三节的三个前端放大器依然存在
- gphoto2 需要 bundle、签名、且与 macOS `ptpcamerad` 抢设备（该文档已记录此冲突）

所以：**L2 应该先用 ImageCaptureCore 实现**，gphoto2 作为后续可选后端。

**L5 — 超越最优（跨会话缓存 + 预测性预取）**

见第九节。三个杠杆：`fingerprint` 跨会话持久缓存、按滚动方向预测性预取、
大容量存储直通。

价值：**这是「优于原生」的唯一来源** —— 原生软件每次连接都从零开始，
我们可以让二次插卡近乎瞬时。
风险：中。依赖 9.5 的第 1、2 条真机验证结论。

### 7.4 建议顺序

```
L1（前端止血，独立可发布）
  → L2（helper 常驻，最大收益，性能拐点）
  → L3（渐进式投递）
  → L4（通道分级 + RAW 预览修复）
  → L5（跨会话缓存 + 预测性预取 = 超越最优）
```

L1 与 L2 互不冲突，L1 可以先合。

**分界线：L1–L4 的终点是「对齐最优」，L5 才是「优于最优」。**
L2 完成后应先用探针工具取真机数据（9.5），
再决定 L3/L4/L5 的顺序 —— 若 9.5 第 2 条（`fingerprint` 可用且廉价）成立，
L5 的性价比可能高于 L3。

---

## 八、外部软件对照

调研覆盖了 Apple 官方文档、digiKam、darktable、Rapid Photo Downloader、Entangle、
libgphoto2 源码与 Nikon NX Studio 用户报告（约 30 次检索/抓取）。
**以下区分「已确认」与「未能验证」，未验证项不作为决策依据。**

### 8.1 已确认

**Entangle（libgphoto2 桌面客户端）——持久会话 + 互斥锁**

从抓取到的 Entangle 源码可见其相机对象持有 `GMutex lock`，
用 `g_mutex_lock` / `g_mutex_unlock` 包裹相机操作，并在生命周期结束时
调用 `gp_camera_exit`；同时维护 `hasPreview` 属性。

→ 印证第 7.2 节 L2 的设计：**持久 camera 对象 + 互斥串行化**，而非每次操作新建会话。

**libgphoto2 —— 目录枚举是独立的高成本操作**

源码中 `ptp_list_folder(storage, handle, children)` 表明 PTP 侧目录列举
本身就是一次独立往返，与取图分离。这与本仓库真机数据
（`--list-files` 11.76s）一致。

**PTP `GetPartialObject (0x101b)`**

确认为标准 PTP 操作，Nikon 相机支持，可用于**部分对象提取**。
这是 ImageCaptureCore `requestReadDataAtOffset` 在协议层的对应能力
→ 佐证「ranged read 取 NEF 内嵌预览」在 PTP 层可行。

**NX Studio 在大量 NEF 场景下同样慢**

dpreview / NikonForums 存在大量「NX Studio 很慢」「如何加速 NX Studio」
「快速手动挑选 NEF」的讨论帖。

→ 说明这是 **RAW + PTP 领域的公共难题**，不是本项目独有；
也说明不宜把 NX Studio 当作性能标杆。

**digiKam —— 独立缩略图库 + 严格的内嵌预览级联**

四个 SQLite 库刻意分离，其中缩略图单独一个 `thumbnails-digikam.db`，
存的是**小波压缩（PGF）**而非原始像素
（[官方手册](https://docs.digikam.org/en/setup_application/database_settings.html)）。

取图级联（`thumbnailcreator_engine.cpp`，
[KDE invent](https://invent.kde.org/graphics/digikam/-/raw/master/core/libs/threadimageio/thumb/thumbnailcreator_engine.cpp)）：

1. `loadImagePreview` —— 先试 Exif/IPTC 内嵌预览
2. 按扩展名走**缩放解码**（JPEG 用 `loadJPEGScaled`，非全解码）
3. RAW → `loadEmbeddedPreview()`
4. RAW 兜底 → `loadHalfPreview()`（半尺寸解码）
5. DNG → Exiv2 预览，**小于目标尺寸则拒绝**
6. 最后才全图解码

每一级之间都插入 `observer->continueQuery()` 协作式取消检查
—— 与 ImageCaptureCore 的 `shouldGetThumbnailOfItem:` 完全同构。

**darktable —— 11 级磁盘 mipmap，档位对齐屏幕分辨率**

档位表原文注释 "selected for coverage of most screen sizes"
（[mipmap_cache.c:724-737](https://raw.githubusercontent.com/darktable-org/darktable/master/src/common/mipmap_cache.c)）：

| 级 | 像素 | 用途 |
|---|---|---|
| mip0–2 | 180×110 / 360×225 / 720×450 | 网格 |
| mip3–4 | 1440×900 / 1920×1200 | 720p / 1080p |
| mip5–9 | 2560×1600 → 7680×4320 | 2K→8K |
| mip10 | 无上限 | 全尺寸预览 |

磁盘布局：`mipmaps-<hash>.d/<mip>/<imgid>.jpg` —— **每级一个目录，存 JPEG**。
解码失败直接 `unlink` 该文件。

内嵌预览**只在低档位使用**，且有三重闸门：
请求档位 ≤ 阈值、图片未被编辑（`!altered`）、相机不在黑名单
（[mipmap_cache.c:1545-1553](https://raw.githubusercontent.com/darktable-org/darktable/master/src/common/mipmap_cache.c)）。

Ansel 分支的复盘尤其值得看
（[Ansel](https://ansel.photos/en/news/redesigning-lighttable-and-mipmap-cache/)）：
原设计中「处理线程与 GUI 争抢 mipmap/image cache 锁，导致 pipeline 一跑 GUI 就卡」，
修法是把取缩略图推到后台任务，并让**任务在其服务的 widget 消失时自我取消**。

**Rapid Photo Downloader —— 多进程 + 0MQ + 三级缓存**

多个 OS 级进程通过 0MQ 通信，用 load balancer 分派到最多 4 核并行生成缩略图
（[docs](https://damonlynch.net/rapid/documentation/)）。三级缓存：
自有缓存（JPEG，75% 质量，30 天未访问清理）、
**相机文件临时缓存（进程退出前一直保留）**、freedesktop 系统缓存（128/256px）。

那个「相机文件缓存到进程退出」正是「相机读取昂贵、必须在单次运行内复用」的直接体现。

同时明确记录 PTP 独占约束：「同一时刻只有一个程序能访问」
→ **两个并发 ImageCaptureCore session 会互相争抢**。

**Nikon NX Studio —— 有持久磁盘缓存，但大量 NEF 仍然卡**

官方偏好设置里有 Thumbnail Cache 区块，含 Clear Cache 与**可重定位的 Cache Location**
（[Nikon 官方帮助](https://nikonimglib.com/nxstdo/onlinehelp/en/general_67.html)）。
社区实测「NX Studio 读内嵌 JPEG，所以不必花时间渲染 NEF」
（[dpreview](https://www.dpreview.com/forums/threads/how-to-really-speed-up-nx-studio.4738196/)）。

但单目录 >3000 张 NEF 依然「几乎不可用」，用户的解法是**减少单目录文件数**。
→ 不宜把 NX Studio 当性能标杆。

**Nikon Transfer 2 —— 同样的「先全量枚举再出缩略图」症状**

支持 MTP/PTP、PTP、大容量存储三种方式，官方**未给出速度对比**
（[Nikon 官方帮助](https://nikonimglib.com/nvnxi/onlinehelp/en/tr004000.html)）。
用户报告 1000+ 张时「缩略图要等很久」——与全目录枚举设计一致。

**Nikon 厂商 PTP 操作码（重要）**

libgphoto2 中存在 `PTP_OC_NIKON_GetLargeThumb = 0x90C4`，
是 Nikon 提供的**比 EXIF 缩略图更大的缩略图**专用操作码，
由 `thumbsize=large` 开关控制
（[library.c](https://raw.githubusercontent.com/gphoto/libgphoto2/master/camlibs/ptp2/library.c)）。

而 ImageCaptureCore 提供 `requestSendPTPCommand:outData:completion:`
（`ICCameraDevice.h`，macOS 10.15+）—— **可以在长生命周期 session 上直接发这个厂商操作码**。
这是「既要中等尺寸缩略图、又不想拉整文件」的理论最优路径。
ImageCaptureCore 内部是否已使用它 —— **UNVERIFIED**。

### 8.2 缩略图档位横向对照

| App | 网格档位 | Loupe/预览档位 | 档位数 | 存储 |
|---|---|---|---|---|
| digiKam | 32→256（默认 **142**） | **512 / 1024** | 10 档 | PGF 小波，独立 DB |
| darktable | 180×110 / 360×225 / 720×450 | 1440×900 → 7680×4320 | **11 LDR + 2 float** | 每档一目录，JPEG |
| Rapid Photo Downloader | 自有 + fdo 128/256 | — | ~2–3 | JPEG @75% |
| **ImageCaptureCore** | **仅 160×120（EXIF 标准）** | **无 —— 任何自定义尺寸都不缓存** | **1 档** | 框架内，可 flush |

**网格缩略图行业共识是 ~150–360px。但 loupe 档不要照抄这些数字** ——
digiKam 的 1024 与 darktable 的 1440 是**十多年前按当时屏幕定的**，
darktable 自己的档位表注释写的是 "selected for coverage of most screen sizes"，
并且一路排到 7680×4320（8K）。**对标应该对标它的最高档，而不是它的中间档。**

NEF 内嵌预览的实际档位是：160×120 TIFF 缩略图、~640×424 预览、
~1620×1080 中等预览，再往上就是**全画幅 `JpgFromRaw`**
（[metadata-extractor #262](https://github.com/drewnoakes/metadata-extractor/issues/262)、
[Jeffrey Friedl](https://regex.info/blog/2006-12-08/303)）。

→ **当前代码的 2400px 恰好落在「所有中等预览之上、只能靠全画幅 JPEG 满足」的空档里**：
既已经付了全画幅的传输代价，却只拿到 3.8MP 的降采样结果 —— **两头都不占**。
512px 也非 160×120，同样不被缓存。

**正确解法不是降档，而是升到全画幅**（见 L4）：既然 2400px 已经要触达
`JpgFromRaw`，就直接取完整的 6048×4024，代价相同而画质从 3.8MP 变 24.4MP。

### 8.3 PTP 协议层的硬约束（解释了为什么尺寸不能随便要）

libgphoto2 源码显示：缩略图的尺寸/格式是相机通过 `ObjectInfo` 上报的
**`ThumbFormat` / `ThumbSize` / `ThumbPixWidth` / `ThumbPixHeight`** 字段
（[ptp.h](https://raw.githubusercontent.com/gphoto/libgphoto2/master/camlibs/ptp2/ptp.h)），
而 `PTP_OC_GetThumb (0x100A)` **只接受 object handle，没有尺寸参数**。

→ **客户端无法向 PTP 索要任意尺寸的缩略图。** 超出相机上报尺寸的请求，
只能由 `GetObject` / `GetPartialObject` 从实际文件取。
这是第 5.1 节「custom size 永不缓存」在协议层的根本原因。

另有实测参考：某开发者测得 ImageCaptureCore `requestReadData`
读 50MB RAW 约 **0.9s**（对比本地 mmap 0.002s），并称其性能 "prohibitive"
（[openradar FB7663947](https://openradar.me/FB7663947)）。
同一 radar 提到历史上存在 **4MB 单次读取上限**（iPadOS 14 beta 1 移除）
—— 做 ranged read 分片时要注意。

### 8.4 ImageCaptureCore 有内部请求队列 + 取消钩子（关键补充）

这是本次调研最有价值的发现之一，直接否定「每批新建子进程」：

```objc
- (BOOL)cameraDevice:(ICCameraDevice *)cameraDevice
    shouldGetThumbnailOfItem:(ICCameraItem *)item;
```

SDK 原文（`ICCameraDevice.h`）：

> "This message is sent when the camera device is about to execute **queued
> requests** for the thumbnail of a specific item. If the request is no longer
> wanted, eg: the item is no longer displayed on the screen, the client can
> return NO and abort sending a request down to the camera device,
> **speeding up the execution queue**."

含义：

1. ImageCaptureCore **每个 session 维护一条串行请求队列**（PTP 传输本身就是单事务）
2. 框架**就是为「把可见项全部入队、滚出视口就取消」这个模式设计的**
3. 因为已经串行化，**每批只发 5 个毫无收益**，反而丢掉了重排优先级的能力
4. 这套队列与取消能力**只存在于单个长生命周期 session 内**，子进程一退全部丢失

`shouldGetMetadataOfItem:` 有完全对应的钩子。

另外还有一个未文档化的 session 选项：
`ICEnumerationChronologicalOrder`（`ICDevice.h`），配合
`requestOpenSessionWithOptions:` 使用。按名字推测可让目录按时间顺序枚举
（对挑片场景意味着最新照片先到）。**语义与实际效果 UNVERIFIED，值得实验。**

### 8.5 可安全采纳的结论

1. **长生命周期会话 + 单一串行化队列 + 协作式取消** —— Entangle（`GMutex` 锁 +
   `if (cam->cam != NULL) return TRUE` 幂等守卫）、digiKam（`continueQuery()`）、
   Ansel（自我取消的后台任务）、ImageCaptureCore（`shouldGetThumbnailOfItem:`）
   四个独立实现全部收敛到同一形状
2. **多档位缩略图**：网格 ~150–360px、loupe ~1000–1600px，各档独立缓存
3. **自建磁盘缓存存 JPEG**，因为源头（RAW 解码 / PTP 传输）才是贵的部分
4. **RAW 走内嵌预览 + 部分对象读取**，不做 RAW 解码
5. **缓存 key 不能只用 `ptpObjectHandle`** —— PTP handle 跨 session 不稳定；
   应用 `fingerprint`（macOS 15+）或 `originalFilename` + `fileSize` 组合

### 8.6 仍未验证（UNVERIFIED，不作为决策依据）

- `start()` → `didOpenSession` → `deviceDidBecomeReady` 在真实满卡上的绝对耗时
  —— Apple 未文档化，无第三方基准
- 在完整 catalog 就绪**之前**、对早期 `didAddItems:` 交付的 item 发
  `requestThumbnailData` 是否会被立即服务（还是排队/报错）
  —— **这一条决定 L3 流式设计是否成立**，必须实测
- 给定 `maxPixelSize` 实际传输多少字节
- `ICEnumerationChronologicalOrder` 的确切语义
- XPC service 持有长 session 是否会被 idle-exit / jetsam 杀掉
  —— XPC 设计上就是空闲即回收，对「必须保温的 session」不友好；
  倾向用 launchd 常驻 helper 或 stdin/stdout daemon
- NX Studio / Transfer 2 的缓存格式与是否持久 PTP session

---

## 九、对标最优

### 9.0 标杆选择：不要对标原生

原生 / 官方软件（Image Capture、Nikon Transfer 2、NX Studio）**是下限，不是目标**。
第 8 节调研已证明它们在 1000+ NEF 场景下普遍崩溃，
把它们当标杆会严重低估天花板。

**真正的标杆是挑片领域的最优实现** —— Photo Mechanic、FastRawViewer 一类
以「快」为核心卖点的专业挑片工具。它们的共同架构特征：
内嵌 JPEG 优先、不为浏览解码 RAW、激进后台预取、自建多档缓存。

> 对这些工具的具体架构与量化基准的调研正在进行，
> 补全后将替换 9.4 的目标数字（当前数字是保守下限估计）。

因此本节分两层论证：

1. **为什么原生慢**（9.1）—— 确立我们至少不会重复它们的错误
2. **凭什么能做到最优甚至更优**（9.2）—— 三个具体杠杆

### 9.1 原生软件的结构性弱点

第八节的调研给出了明确答案 —— 原生/官方软件都慢在同一个地方：

| 软件 | 观察到的行为 | 结构性原因 |
|---|---|---|
| Image Capture / Photos 导入 | 先长时间空白，然后网格才可用 | 每次连接重新全量枚举，**无跨会话缓存** |
| Nikon Transfer 2 | 1000+ 张「缩略图要等很久」 | 同上：先枚举全部再出缩略图 |
| NX Studio | 有磁盘缓存，但单目录 >3000 NEF「几乎不可用」 | 缓存是**按文件路径**的，换卡/重连即失效；且无虚拟化 |

共同点：**它们都是「每次连接从零开始」的无状态设计。**
Image Capture 甚至没有持久缩略图缓存 —— 拔线再插，全部重来。

这就是超越空间所在：**它们付的是「每次连接」的成本，我们可以只付「每张照片一次」的成本。**

### 9.2 超越标杆的三个杠杆

**杠杆一：跨会话持久缓存（原生没有，这是最大的一张牌）**

SDK 提供 `ICCameraFile.fingerprint`（`ICCameraFile.h:174-178`）：

> "A fingerprint generated from the camera file data"

**这是内容派生的指纹，不是 PTP handle。** 配合类方法：

```objc
+ (NSString* _Nullable)fingerprintForFileAtURL:(NSURL*)url;   // ICCameraFile.h:185
```

意味着：

- 缓存 key 可以做到**跨 session、跨重连、跨换卡稳定**
- 已导出到本地的文件可以用 `fingerprintForFileAtURL:` 算出同一个 key
  → **「卡上的这张」和「已导入的这张」能自动认亲**
- 第二次插同一张卡 → 缩略图**全部命中本地缓存，零 USB 传输**

原生软件在这一点上是空白的。**第二次打开同一张卡时，我们可以是瞬间的，
而 Image Capture 仍然要重新枚举。** 这不是「追平」，是「超越」。

需要注意：`fingerprint` 无 `IC_AVAILABLE` 标注（不同于同文件其他成员），
可用性与「读取它是否触发数据传输」**均待真机验证**（见 9.5）。
若代价过高，退化方案是 `originalFilename` + `fileSize` + `exifCreationDate` 组合键。

**杠杆二：预测性预取（原生是纯被动的）**

原生软件只在你点到某张时才去取。但挑片行为是**高度可预测的**：
方向键连续前进、或在胶片条上单向滚动。

配合 L2 的常驻 session 与框架自带的串行队列 + `shouldGetThumbnailOfItem:` 取消能力
（第 8.4 节），可以做到：

- 按**滚动方向与速度**预取（顺序挑片时提前取后 20–50 张的网格档）
- 当前选中项**先出低档、再无感替换为高档**（progressive refinement）
- 用户改变方向 → 立刻 `NO` 掉反方向的排队请求，队列不被污染

框架的队列本来就是为这个模式设计的（SDK 原文："the client can return NO and
abort sending a request down to the camera device, **speeding up the execution queue**"）。
原生 Image Capture 没有暴露挑片语义，也就无法做方向性预取。

**杠杆三：大容量存储直通（原生不区分，我们可以）**

`ICCameraDevice.mountPoint`（`ICCameraDevice.h:193-197`）：

> "Filesystem mount point for a device with transportType of
> ICTransportTypeMassStorage. **This will be NULL for all other devices.**"

加上 `requestSecurityScopedURL`（macOS 14+）与 `ICCameraItem.fileSystemPath`：

→ 读卡器 / 相机大容量模式下，**完全绕过 PTP 逐张传输，走本地文件直读**。
这条通道下性能上限就是磁盘 IO + 解码，与「原生 PTP 浏览」不在一个量级。

同时 `filesOfType:` 可按 UTI 直接取图片清单，不必自己递归 folder 树。

### 9.3 补充能力：`ptpEventHandler`（macOS 12+）

```objc
@property (nonatomic, copy) void (^ptpEventHandler)(NSData* eventData);  // :353
```

配合 `addedAfterContentCatalogCompleted`，可支持**联机拍摄即时入库**
（拍一张、立刻出现在网格里），无需重新枚举。
这是原生 Image Capture 做得到、但 NX Studio 浏览态做不到的场景。

属于产品加分项，不在性能主线上。

### 9.4 目标指标

**对标对象不是 Nikon 官方软件，而是挑片领域的最优实现**
（Photo Mechanic / FastRawViewer 一类）。原生软件只是「不能比它差」的下限，
不是目标。第 8 节调研已证明 NX Studio / Transfer 2 在 1000+ NEF 时都会崩，
把它们当标杆会严重低估天花板。

| 场景 | 目标 | 下限对照（原生） |
|---|---|---|
| 首屏出现第一批缩略图 | < 1s（增量窗口成立时） | Image Capture：全量枚举后才出 |
| 方向键连按响应 | **每步 < 100ms**（命中缓存） | NX Studio：3000+ NEF 明显卡顿 |
| loupe 适应窗口可见 | < 300ms（缓存命中）/ < 2s（首次取全画幅） | Transfer 2:1000+ 张「等很久」 |
| **100% 对焦检查** | **< 100ms 切换，真实像素** | 原生：需等全图或不支持 |
| **二次插同一张卡** | **缩略图近乎瞬时、零 USB** | **原生：完全重来** ← 超越点 |
| 读卡器模式 | 接近本地相册浏览 | 原生不区分通道 |

**画质是硬约束，不是可调项：**

- loupe 档不得低于显示器物理像素（16" MBP 需 ≥3456px 长边）
- 100% 查看必须是真实像素（NEF → 全画幅 6048×4024 内嵌 JPEG）
- **任何「为了快而降画质」的方案不予采纳** —— 挑片要判断对焦，
  降采样会直接导致误判。快用缓存和预取换，不用画质换。

这些数字须在 L2 落地后用真机校准；第 8 节所引的 digiKam 1024 /
darktable 1440 是历史屏幕年代的取值，**不作为 loupe 档位依据**。

### 9.5 待真机验证项

以下都**不能**在无相机环境下确认，必须接 Z6III 验证。
按「是否影响架构决策」排序：

**决策关键（做 L3 / 9.2 之前必须先答）**

1. **在完整 catalog 就绪之前，对早期 `didAdd(items:)` 交付的 item 发
   `requestThumbnailData`，是否会被立即服务？**
   还是排队到 catalog 完成、或直接报错？
   —— Apple 契约只说 `deviceDidBecomeReady` 之后才 "ready to receive requests"，
   但 `addedAfterContentCatalogCompleted` 的存在证明 `didAddItems:` 在两个阶段都会触发。
   **这一条决定 L3 流式设计与 9.4「首屏 < 1s」是否成立。**
   若不成立，退化为「一次性付清枚举成本 + 强缓存」，此时杠杆一仍然有效。
2. **`fingerprint` 的可用性与代价** —— 读取它是否触发额外数据传输？
   跨 session / 跨重连是否真的稳定？
   **这一条决定杠杆一（超越标杆的最大一张牌）能否成立。**
3. `didAdd(items:)` 与 `deviceDidBecomeReady` 之间的增量窗口有多少秒
   （用 `Tools/catalog-timing-probe.swift`）
4. `start()` → `didOpenSession` → `deviceDidBecomeReady` 在满卡上的绝对耗时
   —— L2 收益的分母，也是本文 66 分钟估算的真机校准

**实现参数**

5. 给定 `maxPixelSize`（512 / 1024 / 1620 / 2400）各自实际传输多少字节
   —— 用 `nettop` 或 USB 计数器测；决定 L4 档位取值
6. Z6III 通过 USB 报的 `transportType` 是 `USB` 还是 `MassStorage`，
   `mountPoint` 是否非空 —— 决定杠杆三是否可用
7. `requestReadDataAtOffset` 读 NEF 头部能否拿到可用内嵌 JPEG，是否仍受 4MB 单次读限制
8. `requestSendPTPCommand:` 发 Nikon `GetLargeThumb (0x90C4)` 是否可用、返回什么尺寸
9. `ICEnumerationChronologicalOrder` 是否真的让最新照片先到

**回归验证**

10. L2 落地后的真实首屏时间与方向键连按响应

---

## 十、结论

**根因是架构级的。** 一次性子进程 + 一次性全量契约，
使每批预览固定付 8 秒；浏览一张 2477 张的卡需要 66 分钟纯等待。
这个上限与代码质量无关，前端再怎么调都碰不到那 8 秒。

**分三段看目标：**

| 目标 | 需要做到 | 关键动作 |
|---|---|---|
| 不卡 | L1 + L2 | helper 常驻，8s 只付一次 |
| 对齐最优 | L3 + L4 | 渐进式投递、通道分级、**loupe 升到全画幅内嵌 JPEG** |
| **优于最优** | **L5** | **`fingerprint` 跨会话缓存 + 预测性预取** |

**「优于原生」的立论基础**（第九节）：Image Capture、Transfer 2、NX Studio
共同的结构性弱点是**无状态** —— 每次连接都重新全量枚举，
Image Capture 甚至没有持久缩略图缓存。它们付的是「每次连接」的成本。

而 SDK 提供了 `ICCameraFile.fingerprint`（内容派生指纹）+
`fingerprintForFileAtURL:`，让我们能把成本降到「每张照片一次」：
**第二次插同一张卡时缩略图全部命中本地缓存、零 USB 传输，
而原生仍然要从头枚举。** 这是超越点，不是追平点。

**下一步建议：**

1. 先做 L1（纯前端，低风险，独立可发布）
2. 做 L2（性能拐点，本文核心建议）
3. **在 L2 落地后立刻跑 9.5 的第 1、2 条真机验证** ——
   这两条分别决定 L3（流式首屏）与 L5（超越标杆）是否成立
4. 依真机数据排 L3/L4/L5，并用 9.4 的指标表验收

本文所有性能结论均为实测或 SDK 原文引用；
标注 UNVERIFIED 的项目（尤其 9.5）在真机验证前不应作为排期承诺的依据。
