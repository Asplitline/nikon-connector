# Nikon Connector TODO

下一阶段目标：把当前可用的 Nikon Z6III 开发版本推进到一个可以稳定分发、快速浏览大容量相机卡、完成选片后选择性导出的 macOS 工具。

## 当前阶段判断

核心链路已经成立：

`Nikon Z6III -> ImageCaptureCore -> Swift helper -> Rust/Tauri -> React`

当前已经具备真机发现、照片枚举、本地缩略图/预览缓存、键盘选片、Pick/Reject、本地星级、筛选排序、选择性导出、EXIF 展示、filmstrip 虚拟化和 preview 调度。

下一阶段先解决发布和性能基础，再继续扩功能。

---

## P0 — Release Ready

### 1. 将 Swift camera helper 作为 Tauri sidecar 打进应用包

- [ ] 增加 release helper build 脚本，产物使用 `release` 配置。
- [ ] 将 `nikon-camera-helper` 放入 Tauri 可识别的 sidecar/binary 目录。
- [ ] 在 `tauri.conf.json` 中声明 external binary / sidecar。
- [ ] Rust 运行时优先解析应用包内 helper 路径。
- [ ] 保留 `NIKON_CAMERA_HELPER` 作为开发与诊断覆盖入口。
- [ ] 删除发布版本对 `native/macos-camera-helper/.build/debug/...` 的依赖。
- [ ] DMG 安装后在一台干净环境 Mac 上完成：启动 -> 识别相机 -> 浏览照片 -> 导出原图。

**验收：** 从 GitHub Release 下载 DMG 后，不需要源码、Swift build 目录或开发环境即可连接 Z6III。

### 2. 补齐 macOS 签名与公证

- [ ] helper 与主 App 使用一致的发布签名链路。
- [ ] 配置 Hardened Runtime / 必需 entitlement。
- [ ] 完成 Developer ID 签名。
- [ ] 完成 Apple notarization 与 stapling。
- [ ] 验证 Gatekeeper 下首次安装体验。

**验收：** 用户正常打开 DMG 安装，无“来源不明/已损坏”类阻断。

---

## P0 — 真正的渐进式照片加载

### 3. 打通 Swift -> Rust -> React 全链路 streaming

当前 `photos:batch` 只在 Rust 已拿到完整 `Vec<CameraPhoto>` 后分批发送。下一步让 Swift helper 在枚举过程中直接发送 progress batch。

- [ ] Swift daemon 为 `list-photos` 输出 `type=progress` 照片批次。
- [ ] Rust `HelperDaemon` 将 progress 消息暴露给调用方，而不是直接跳过。
- [ ] Tauri 在收到 native batch 后立即 emit `photos:batch`。
- [ ] terminal result 仅返回结束状态和 total/count 信息。
- [ ] 支持取消旧相机/旧 generation 的照片流。
- [ ] 保证同一 PTP session 上相机操作仍然串行。

**验收：** 大卡枚举时，第一批照片可以在完整目录处理结束前出现在 UI。

### 4. 将 `listPhotos` 降级为轻量 catalog 枚举

加载分层：

1. L0 catalog：文件名、handle、storage、大小、拍摄时间、类型。
2. L1 thumbnail：当前可视窗口及 buffer。
3. L2 display preview：当前选中图片和少量前后预取。
4. L3 EXIF：选中项优先，空闲时渐进补齐。

- [ ] `listPhotos` 阶段不再批量请求整卡 shooting metadata。
- [ ] `listPhotos` 阶段不再固定预缓存前 80 张图片。
- [ ] thumbnail 加载完全由 visible window 驱动。
- [ ] preview 加载继续沿用 `previewQueue` / `previewScheduler`。
- [ ] EXIF 改成按需请求，并缓存到 catalog。
- [ ] UI 对 metadata/thumbnail/preview 的缺失状态分别展示 skeleton/fallback。

**建议性能目标：**

- App 已运行且相机已连接：首次可见照片尽量控制在 1–2 秒内。
- 已缓存图片切换：< 100 ms。
- 未缓存 JPG display preview：尽量 < 1 秒。
- 连续按方向键时，后台最多保留当前 generation 所需请求。

---

## P1 — Culling 工作流可靠性

### 5. 稳定照片身份与本地状态

- [ ] 明确定义 `CameraPhoto.id` 的稳定性规则。
- [ ] 本地 rating / pick 状态使用 camera + storage + object identity 形成稳定 key。
- [ ] 相机拔插、App 重启后验证本地标记恢复。
- [ ] 卡内文件变化后避免旧状态错误关联到新照片。
- [ ] 为 cache 增加版本/失效策略。

### 6. 完善选择性导出

- [ ] 导出增加逐项/整体进度事件。
- [ ] 支持取消长时间导出。
- [ ] 完善 duplicate 检测结果展示。
- [ ] 导出结束后提供“在 Finder 中显示”。
- [ ] 断连、空间不足、目标目录无权限时给出明确错误状态。
- [ ] 导出过程中锁定会破坏 selection 的关键操作。

**验收：** 2000+ 张卡完成选片后，可稳定只导出几十张 keeper，并清楚知道 copied / skipped / failed。

---

## P1 — 工程与回归基础

### 7. 建立三层 CI / Release Gate

每次 PR 至少运行：

- [ ] `bun run lint`
- [ ] `bun run test`
- [ ] `bun run build`
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] `swift test --package-path native/macos-camera-helper`
- [ ] release helper build smoke check

发布前额外运行：

- [ ] Tauri app/DMG build。
- [ ] updater metadata 校验。
- [ ] helper 是否存在于最终 `.app` 内的结构检查。
- [ ] 签名、公证检查。

### 8. 固化真机回归清单

至少覆盖：

- [ ] 冷启动识别 Z6III。
- [ ] 相机先开后启动 App。
- [ ] App 先开后连接相机。
- [ ] 100 / 1000 / 2000+ 张照片目录。
- [ ] JPG-only / NEF-only / RAW+JPG。
- [ ] 快速连续左右切图。
- [ ] 放大查看焦点细节。
- [ ] Pick / Reject / Rating 后重启恢复。
- [ ] 导出单张 / 多张 / 高星筛选结果。
- [ ] 浏览期间拔线再重连。

---

## P2 — Rating 写回 Nikon

### 9. 完成 Nikon SDK Rating API 验证

- [ ] 在官方 Nikon Remote Module SDK 2.0.0 中确认 Z6III rating capability/API。
- [ ] 真机验证 0–5 星写回后能在相机/NX Studio 中看到。
- [ ] 将 SDK 能力检测从硬编码 `false` 改成真实 capability probe。
- [ ] Rating command 使用真实 camera identity，而不是从 mock catalog 查 photo。

建议 command 契约演进为：

```ts
setPhotoRating({
  cameraId,
  storageId,
  objectHandle,
  photoId,
  rating,
})
```

- [ ] SDK 不支持时继续保留 local-only rating。
- [ ] UI 明确区分 Local / Camera metadata 两种保存状态。

---

## P2 — 产品增强

### 10. RAW + JPG Pair

- [ ] 同 stem `.NEF + .JPG` 合并为一个 review item。
- [ ] JPG 优先作为快速 display preview。
- [ ] rating / pick 一次作用于 pair。
- [ ] 导出支持只导 RAW、只导 JPG、RAW+JPG。

### 11. Shooting Review

- [ ] EXIF 异步补齐后更新 shooting review。
- [ ] 按 lens / focal length / aperture / shutter / ISO 聚合。
- [ ] 将 keeper rate 与拍摄参数关联。
- [ ] 标记高 ISO、低快门等风险区间。

---

## 建议版本节奏

### v0.2.0 — Production Foundation

完成：

- sidecar 打包
- 签名/公证
- 真 streaming catalog
- 分层 thumbnail/preview/EXIF
- CI + 真机回归基线

### v0.3.0 — Culling & Export

完成：

- 稳定本地 selection 状态
- 导出进度/取消/错误恢复
- Finder handoff
- 大卡选片体验打磨

### v0.4.0 — Nikon Metadata & RAW Workflow

完成：

- Nikon rating write-back（SDK 验证通过后）
- RAW+JPG pairing
- shooting review 深化

---

## 当前执行顺序

1. **Tauri sidecar / DMG 可分发性**
2. **Swift -> Rust -> React 真 streaming**
3. **轻量 catalog + viewport thumbnail + lazy EXIF**
4. **CI + 真机回归**
5. **导出可靠性**
6. **Nikon SDK rating**
7. **RAW+JPG 与 Shooting Review**

前四项完成前，优先控制新 UI/功能范围，把基础链路做稳定、做快、做到可发布。
