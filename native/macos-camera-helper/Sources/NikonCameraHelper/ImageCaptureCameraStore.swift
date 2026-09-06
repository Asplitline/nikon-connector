import Foundation
import ImageCaptureCore

final class ImageCaptureCameraStore: NSObject, ICDeviceBrowserDelegate, ICCameraDeviceDelegate, ICCameraDeviceDownloadDelegate {
    private let browser = ICDeviceBrowser()
    private var cameraDevices: [ICCameraDevice] = []
    private var initialScanFinished = false
    private var contentCatalogFinished = false
    private var downloadFinished = false
    private var downloadError: Error?

    // 常驻模式下浏览器与相机会话跨请求复用：设备扫描（实测占满整个 timeout，
    // 3~8s）与「打开会话 + 等目录」只在首次请求时付一次。
    // 一次性 argv 模式不开这个开关，行为与改造前完全一致。
    private var keepsSessionAlive = false
    private var browserRunning = false

    // 由 Daemon 在启动时调用，声明本进程要长期持有浏览器与会话
    func enablePersistentSession() {
        keepsSessionAlive = true
        log("persistent session enabled")
    }

    // 进程退出前收尾：关掉仍然打开的会话并停掉浏览器
    func shutdown() {
        for camera in cameraDevices where camera.hasOpenSession {
            camera.requestCloseSession()
        }
        keepsSessionAlive = false
        stopBrowser()
        log("store shutdown")
    }

    func listCameras(timeout: TimeInterval) -> [CameraDevice] {
        log("list-cameras started timeout=\(timeout)s")
        startBrowser(timeout: timeout)
        defer { stopBrowser() }

        let cameras = cameraDevices
            .map { device in
                CameraDevice(
                    id: device.persistentIDString ?? device.uuidString ?? device.name ?? "Nikon Camera",
                    name: device.name ?? "Nikon Camera",
                    model: device.productKind ?? "Unknown",
                    connection: "image_capture"
                )
            }
            .sorted { lhs, rhs in
                isNikonOrZ6(lhs) && !isNikonOrZ6(rhs)
            }
        log("list-cameras finished count=\(cameras.count)")
        for camera in cameras {
            log("camera id=\(camera.id) name=\(camera.name) model=\(camera.model) connection=\(camera.connection)")
        }
        return cameras
    }

    func listPhotos(cameraId: String, cacheDir: String, timeout: TimeInterval) -> [CameraPhoto] {
        log("list-photos started cameraId=\(cameraId) cacheDir=\(cacheDir) timeout=\(timeout)s")
        startBrowser(timeout: timeout)
        defer { stopBrowser() }

        guard let camera = cameraDevices.first(where: { cameraIdentifier(for: $0) == cameraId }) else {
            log("list-photos camera not found cameraId=\(cameraId) available=\(cameraDevices.map { cameraIdentifier(for: $0) })")
            return []
        }

        openSessionIfNeeded(camera, timeout: timeout)

        let cacheURL = URL(fileURLWithPath: cacheDir, isDirectory: true)
        let items = readableItems(for: camera)
        let files = cameraFiles(in: items)
        log("list-photos catalogFinished=\(contentCatalogFinished) contentItems=\((camera.contents ?? []).count) mediaFiles=\((camera.mediaFiles ?? []).count) supportedFiles=\(files.count)")
        logCameraState(camera, context: "list-photos-after-catalog")
        let cachedImages = cacheImages(
            for: files,
            from: camera,
            cameraId: cameraId,
            in: cacheURL,
            previewPhotoIds: [],
            previewFilesByPhotoId: [:],
            timeout: timeout
        )
        let photos = flatten(
            items: items,
            cameraId: cameraId,
            cachedImages: cachedImages
        )
        closeSessionIfNeeded(camera)
        log("list-photos finished photoCount=\(photos.count)")
        return photos
    }

    func cachePhotoPreview(
        cameraId: String,
        photoId: String,
        cacheDir: String,
        timeout: TimeInterval
    ) -> CachedPhotoPreview {
        cachePhotoPreviews(
            cameraId: cameraId,
            photoIds: [photoId],
            previewPhotoIds: [photoId],
            cacheDir: cacheDir,
            timeout: timeout
        ).first ?? CachedPhotoPreview(photoId: photoId, previewUrl: "", thumbnailUrl: "")
    }

    func cachePhotoPreviews(
        cameraId: String,
        photoIds: [String],
        previewPhotoIds: [String],
        cacheDir: String,
        timeout: TimeInterval
    ) -> [CachedPhotoPreview] {
        log("cache-photo-previews started cameraId=\(cameraId) photoIds=\(photoIds.count) previewPhotoIds=\(previewPhotoIds.count) cacheDir=\(cacheDir) timeout=\(timeout)s")
        startBrowser(timeout: timeout)
        defer { stopBrowser() }

        guard let camera = cameraDevices.first(where: { cameraIdentifier(for: $0) == cameraId }) else {
            log("cache-photo-previews camera not found cameraId=\(cameraId)")
            return photoIds.map { CachedPhotoPreview(photoId: $0, previewUrl: "", thumbnailUrl: "") }
        }

        openSessionIfNeeded(camera, timeout: timeout)

        let items = readableItems(for: camera)
        let allFiles = cameraFiles(in: items)
        let requestedIds = Set(photoIds)
        let files = allFiles.filter { requestedIds.contains(photoIdentifier(for: $0, cameraId: cameraId)) }
        let filesByPhotoId = Dictionary(uniqueKeysWithValues: files.map { (photoIdentifier(for: $0, cameraId: cameraId), $0) })
        let previewFilesByPhotoId = previewSourceFiles(
            for: files,
            from: allFiles,
            cameraId: cameraId
        )

        for photoId in photoIds where filesByPhotoId[photoId] == nil {
            log("cache-photo-previews photo not found photoId=\(photoId)")
        }

        let cacheURL = URL(fileURLWithPath: cacheDir, isDirectory: true)
        let cachedImages = cacheImages(
            for: files,
            from: camera,
            cameraId: cameraId,
            in: cacheURL,
            previewPhotoIds: Set(previewPhotoIds),
            previewFilesByPhotoId: previewFilesByPhotoId,
            timeout: timeout
        )
        closeSessionIfNeeded(camera)
        let previews = photoIds.map { photoId in
            let file = filesByPhotoId[photoId]
            let cachedImage = file.map { cachedImages[ObjectIdentifier($0)] } ?? nil
            return CachedPhotoPreview(
                photoId: photoId,
                previewUrl: cachedImage?.previewPath ?? "",
                thumbnailUrl: cachedImage?.thumbnailPath ?? ""
            )
        }
        log("cache-photo-previews finished requested=\(photoIds.count) found=\(files.count) cached=\(previews.filter { !$0.previewUrl.isEmpty || !$0.thumbnailUrl.isEmpty }.count)")
        return previews
    }

    func exportPhotos(
        cameraId: String,
        destinationDir: String,
        photoIds: [String],
        timeout: TimeInterval
    ) -> ExportPhotosSummary {
        guard !photoIds.isEmpty else {
            return ExportPhotosSummary(copied: 0, skipped: 0, failed: 0)
        }

        log("export-photos started cameraId=\(cameraId) requested=\(photoIds.count) destinationDir=\(destinationDir) timeout=\(timeout)s")
        startBrowser(timeout: timeout)
        defer { stopBrowser() }

        guard let camera = cameraDevices.first(where: { cameraIdentifier(for: $0) == cameraId }) else {
            log("export-photos camera not found cameraId=\(cameraId)")
            return ExportPhotosSummary(copied: 0, skipped: 0, failed: photoIds.count)
        }

        openSessionIfNeeded(camera, timeout: timeout)
        let items = readableItems(for: camera)
        log("export-photos catalogFinished=\(contentCatalogFinished) contentItems=\((camera.contents ?? []).count) mediaFiles=\((camera.mediaFiles ?? []).count)")
        logCameraState(camera, context: "export-photos-after-catalog")

        let destinationURL = URL(fileURLWithPath: destinationDir, isDirectory: true)
        guard (try? FileManager.default.createDirectory(
            at: destinationURL,
            withIntermediateDirectories: true
        )) != nil else {
            log("export-photos failed to create destinationDir=\(destinationDir)")
            closeSessionIfNeeded(camera)
            return ExportPhotosSummary(copied: 0, skipped: 0, failed: photoIds.count)
        }

        let requestedIds = Set(photoIds)
        let filesById = Dictionary(
            uniqueKeysWithValues: cameraFiles(in: items).map { file in
                (photoIdentifier(for: file, cameraId: cameraId), file)
            }
        )
        var copied = 0
        var skipped = 0
        var failed = 0

        for photoId in photoIds {
            guard let file = filesById[photoId], let fileName = file.name else {
                failed += 1
                continue
            }

            guard requestedIds.contains(photoId) else {
                continue
            }

            if FileManager.default.fileExists(atPath: destinationURL.appendingPathComponent(fileName).path) {
                skipped += 1
                continue
            }

            if download(file: file, from: camera, to: destinationURL, fileName: fileName, timeout: timeout) {
                copied += 1
            } else {
                failed += 1
            }
        }

        closeSessionIfNeeded(camera)
        log("export-photos finished copied=\(copied) skipped=\(skipped) failed=\(failed)")
        return ExportPhotosSummary(copied: copied, skipped: skipped, failed: failed)
    }

    func deviceBrowser(_ browser: ICDeviceBrowser, didAdd device: ICDevice, moreComing: Bool) {
        if let camera = device as? ICCameraDevice {
            camera.delegate = self
            cameraDevices.append(camera)
            log("device added name=\(camera.name ?? "Unknown") model=\(camera.productKind ?? "Unknown") id=\(cameraIdentifier(for: camera)) moreComing=\(moreComing)")
            logCameraState(camera, context: "device-added")
        } else {
            log("non-camera device ignored type=\(String(describing: type(of: device))) name=\(device.name ?? "Unknown") moreComing=\(moreComing)")
        }

        if !moreComing {
            initialScanFinished = true
            log("initial scan marked finished devices=\(cameraDevices.count)")
        }
    }

    func deviceBrowser(_ browser: ICDeviceBrowser, didRemove device: ICDevice, moreGoing: Bool) {
        guard let camera = device as? ICCameraDevice else { return }
        cameraDevices.removeAll { $0 === camera }
        log("device removed name=\(camera.name ?? "Unknown") id=\(cameraIdentifier(for: camera)) moreGoing=\(moreGoing)")
    }

    func deviceDidBecomeReady(withCompleteContentCatalog device: ICCameraDevice) {
        contentCatalogFinished = true
        log("content catalog ready name=\(device.name ?? "Unknown") items=\((device.contents ?? []).count)")
    }

    func cameraDevice(_ camera: ICCameraDevice, didAdd items: [ICCameraItem]) {
        log("camera didAdd items name=\(camera.name ?? "Unknown") count=\(items.count)")
        for item in items.prefix(20) {
            log("item added \(itemDescription(item))")
        }
    }

    func cameraDevice(_ camera: ICCameraDevice, didRemove items: [ICCameraItem]) {
        log("camera didRemove items name=\(camera.name ?? "Unknown") count=\(items.count)")
    }

    func cameraDevice(
        _ camera: ICCameraDevice,
        didReceiveThumbnail thumbnail: CGImage?,
        for item: ICCameraItem,
        error: Error?
    ) {}

    func cameraDevice(
        _ camera: ICCameraDevice,
        didReceiveMetadata metadata: [AnyHashable: Any]?,
        for item: ICCameraItem,
        error: Error?
    ) {}

    func cameraDevice(_ camera: ICCameraDevice, didRenameItems items: [ICCameraItem]) {}

    func cameraDeviceDidChangeCapability(_ camera: ICCameraDevice) {}

    func cameraDevice(_ camera: ICCameraDevice, didReceivePTPEvent eventData: Data) {}

    @objc func didDownloadFile(
        _ file: ICCameraFile,
        error: Error?,
        options: [String: Any],
        contextInfo: UnsafeMutableRawPointer?
    ) {
        downloadError = error
        downloadFinished = true
    }

    func cameraDeviceDidRemoveAccessRestriction(_ device: ICDevice) {}

    func cameraDeviceDidEnableAccessRestriction(_ device: ICDevice) {}

    func device(_ device: ICDevice, didOpenSessionWithError error: Error?) {
        if error != nil {
            log("open session failed name=\(device.name ?? "Unknown") error=\(String(describing: error))")
            contentCatalogFinished = true
        } else {
            log("open session succeeded name=\(device.name ?? "Unknown")")
        }
        if let camera = device as? ICCameraDevice {
            logCameraState(camera, context: "session-opened")
        }
    }

    func device(_ device: ICDevice, didCloseSessionWithError error: Error?) {
        if let error {
            log("close session failed name=\(device.name ?? "Unknown") error=\(error)")
        } else {
            log("close session succeeded name=\(device.name ?? "Unknown")")
        }
    }

    func didRemove(_ device: ICDevice) {
        contentCatalogFinished = true
        log("device removed during session name=\(device.name ?? "Unknown")")
    }

    // 打开会话并等目录就绪。常驻模式下会话与目录只在首次付一次代价：
    // 已打开的会话直接复用，contentCatalogFinished 也不再重置——目录完成回调
    // 只会来一次，重置后再等就是等一个永不到来的回调。
    private func openSessionIfNeeded(_ camera: ICCameraDevice, timeout: TimeInterval) {
        if keepsSessionAlive && camera.hasOpenSession && contentCatalogFinished {
            return
        }

        if !camera.hasOpenSession {
            if !keepsSessionAlive || !contentCatalogFinished {
                contentCatalogFinished = false
            }
            camera.delegate = self
            camera.requestOpenSession()
        }

        let deadline = Date().addingTimeInterval(timeout)
        while !contentCatalogFinished && !hasReadableItems(camera) && Date() < deadline {
            RunLoop.current.run(mode: .default, before: min(deadline, Date().addingTimeInterval(0.1)))
        }
    }

    // 常驻模式下不关会话，留给 shutdown 收尾
    private func closeSessionIfNeeded(_ camera: ICCameraDevice) {
        if keepsSessionAlive {
            return
        }

        camera.requestCloseSession()
        camera.delegate = nil
    }

    private func startBrowser(timeout: TimeInterval) {
        // 常驻模式下浏览器只启动一次：didAdd/didRemove 会持续增量维护
        // cameraDevices，重扫一遍只是白白再等一个 timeout。
        if browserRunning {
            log("browser already running devices=\(cameraDevices.count) (reused)")
            return
        }

        cameraDevices = []
        initialScanFinished = false
        browser.delegate = self
        browser.browsedDeviceTypeMask = .camera
        let start = Date()
        log("browser starting mask=camera timeout=\(timeout)s")
        browser.start()
        browserRunning = true

        let deadline = Date().addingTimeInterval(timeout)
        while !initialScanFinished && Date() < deadline {
            RunLoop.current.run(mode: .default, before: min(deadline, Date().addingTimeInterval(0.1)))
        }
        let elapsed = Date().timeIntervalSince(start)
        log("browser scan complete initialScanFinished=\(initialScanFinished) devices=\(cameraDevices.count) elapsed=\(String(format: "%.2f", elapsed))s")
    }

    private func stopBrowser() {
        // 常驻模式下 defer 里的 stopBrowser 要变成 no-op，否则设备句柄失效、
        // 已枚举的目录元数据全部作废
        if keepsSessionAlive {
            return
        }

        browser.stop()
        browser.delegate = nil
        browserRunning = false
        log("browser stopped")
    }

    private func flatten(
        items: [ICCameraItem],
        cameraId: String,
        storageId: String? = nil,
        cachedImages: [ObjectIdentifier: CachedImagePaths]
    ) -> [CameraPhoto] {
        items.flatMap { item in
            if let folder = item as? ICCameraFolder {
                return flatten(
                    items: folder.contents ?? [],
                    cameraId: cameraId,
                    storageId: storageId ?? folder.name,
                    cachedImages: cachedImages
                )
            }

            guard let file = item as? ICCameraFile,
                  let fileName = file.name,
                  supportedExtensions.contains(URL(fileURLWithPath: fileName).pathExtension.lowercased()) else {
                return []
            }

            let objectHandle = file.ptpObjectHandle == 0 ? nil : String(file.ptpObjectHandle)
            let capturedAt = file.creationDate.map { ISO8601DateFormatter().string(from: $0) } ?? ""
            let cachedImage = cachedImages[ObjectIdentifier(file)]
            return [CameraPhoto(
                id: photoIdentifier(for: file, cameraId: cameraId),
                cameraId: cameraId,
                fileName: fileName,
                capturedAt: capturedAt,
                rating: 0,
                fileType: URL(fileURLWithPath: fileName).pathExtension.lowercased(),
                width: file.width > 0 ? Int(file.width) : 0,
                height: file.height > 0 ? Int(file.height) : 0,
                sizeMb: Double(file.fileSize) / 1024.0 / 1024.0,
                previewUrl: cachedImage?.previewPath ?? "",
                thumbnailUrl: cachedImage?.thumbnailPath ?? "",
                objectHandle: objectHandle,
                storageId: storageId,
                canDownloadOriginal: true,
                hasEmbeddedPreview: false,
                aperture: nil,
                exposureCompensation: nil,
                focalLength: nil,
                iso: nil,
                shutterSpeed: nil
            )]
        }
    }

    private func cameraFiles(in items: [ICCameraItem]) -> [ICCameraFile] {
        items.flatMap { item in
            if let folder = item as? ICCameraFolder {
                return cameraFiles(in: folder.contents ?? [])
            }

            guard let file = item as? ICCameraFile,
                  let fileName = file.name,
                  supportedExtensions.contains(URL(fileURLWithPath: fileName).pathExtension.lowercased()) else {
                return []
            }
            return [file]
        }
    }

    private func readableItems(for camera: ICCameraDevice) -> [ICCameraItem] {
        let contentItems = camera.contents ?? []
        if !contentItems.isEmpty {
            return contentItems
        }

        let mediaItems = camera.mediaFiles ?? []
        if !mediaItems.isEmpty {
            log("using mediaFiles fallback because contents is empty")
        }
        return mediaItems
    }

    private func hasReadableItems(_ camera: ICCameraDevice) -> Bool {
        !(camera.contents ?? []).isEmpty || !(camera.mediaFiles ?? []).isEmpty
    }

    private func itemDescription(_ item: ICCameraItem) -> String {
        if let folder = item as? ICCameraFolder {
            return "folder name=\(folder.name ?? "Unknown") children=\((folder.contents ?? []).count)"
        }

        if let file = item as? ICCameraFile {
            return "file name=\(file.name ?? "Unknown") size=\(file.fileSize) width=\(file.width) height=\(file.height) handle=\(file.ptpObjectHandle)"
        }

        return "item type=\(String(describing: type(of: item))) name=\(item.name ?? "Unknown")"
    }

    private func logCameraState(_ camera: ICCameraDevice, context: String) {
        let capabilities = camera.capabilities.isEmpty
            ? "none"
            : camera.capabilities.joined(separator: ",")
        log(
            "\(context) state name=\(camera.name ?? "Unknown") transport=\(camera.transportType ?? "unknown") " +
            "location=\(camera.locationDescription ?? "unknown") module=\(camera.modulePath) " +
            "openSession=\(camera.hasOpenSession) locked=\(camera.isLocked) ejectable=\(camera.isEjectable) " +
            "appleAccessRestricted=\(camera.isAccessRestrictedAppleDevice) mountPoint=\(camera.mountPoint ?? "none") " +
            "contents=\((camera.contents ?? []).count) mediaFiles=\((camera.mediaFiles ?? []).count) capabilities=\(capabilities)"
        )
    }

    private func cacheImages(
        for files: [ICCameraFile],
        from camera: ICCameraDevice,
        cameraId: String,
        in cacheURL: URL,
        previewPhotoIds: Set<String>,
        previewFilesByPhotoId: [String: ICCameraFile],
        timeout: TimeInterval
    ) -> [ObjectIdentifier: CachedImagePaths] {
        guard (try? FileManager.default.createDirectory(
            at: cacheURL,
            withIntermediateDirectories: true
        )) != nil else {
            return [:]
        }

        let group = DispatchGroup()
        let lock = NSLock()
        var paths: [ObjectIdentifier: CachedImagePaths] = [:]

        let filesToCache = Array(files.prefix(maxInitialCachedFiles))

        for file in filesToCache {
            guard let fileName = file.name else { continue }
            let identifier = file.ptpObjectHandle == 0 ? fileName : String(file.ptpObjectHandle)
            let cachePaths = PreviewCachePaths(
                cameraId: cameraId,
                fileIdentifier: identifier,
                cacheDirectory: cacheURL
            )
            let thumbnailURL = cachePaths.thumbnailURL
            let fileIdentifier = ObjectIdentifier(file)

            let existingThumbnailPath = cachePaths.existingThumbnailPath()
            if !existingThumbnailPath.isEmpty {
                var cachedImage = paths[fileIdentifier] ?? CachedImagePaths()
                cachedImage.thumbnailPath = existingThumbnailPath
                paths[fileIdentifier] = cachedImage
            } else {
                group.enter()
                file.requestThumbnailData(options: [
                    .imageSourceThumbnailMaxPixelSize: NSNumber(value: 512)
                ]) { data, error in
                    defer { group.leave() }
                    guard let data, error == nil else { return }

                    do {
                        try data.write(to: thumbnailURL, options: .atomic)
                        lock.lock()
                        var cachedImage = paths[fileIdentifier] ?? CachedImagePaths()
                        cachedImage.thumbnailPath = thumbnailURL.path
                        paths[fileIdentifier] = cachedImage
                        lock.unlock()
                    } catch {
                        return
                    }
                }
            }

            let photoId = photoIdentifier(for: file, cameraId: cameraId)
            if previewPhotoIds.contains(photoId),
               let previewFile = previewFilesByPhotoId[photoId],
               let previewFileName = previewFile.name {
                let previewExtension = URL(fileURLWithPath: previewFileName).pathExtension
                let originalPreviewURL = cachePaths.originalPreviewURL(forExtension: previewExtension)
                let hasOriginalPreview = FileManager.default.fileExists(atPath: originalPreviewURL.path) ||
                    download(
                        file: previewFile,
                        from: camera,
                        to: cacheURL,
                        fileName: originalPreviewURL.lastPathComponent,
                        timeout: timeout
                    )

                if hasOriginalPreview {
                    let previewPath = DisplayPreviewCache.previewPath(
                        for: originalPreviewURL,
                        cachePaths: cachePaths
                    )
                    lock.lock()
                    var cachedImage = paths[fileIdentifier] ?? CachedImagePaths()
                    cachedImage.previewPath = previewPath
                    paths[fileIdentifier] = cachedImage
                    lock.unlock()
                }
            }
        }

        _ = group.wait(timeout: .now() + timeout)
        log("cache-images finished files=\(files.count) requested=\(filesToCache.count) previewRequests=\(previewPhotoIds.count) cachedEntries=\(paths.count)")
        return paths
    }

    private func previewSourceFiles(
        for files: [ICCameraFile],
        from allFiles: [ICCameraFile],
        cameraId: String
    ) -> [String: ICCameraFile] {
        let jpegFilesByStem = Dictionary(
            grouping: allFiles.filter { file in
                guard let fileName = file.name else { return false }
                return canCacheOriginalPreview(for: fileName)
            },
            by: { file in fileNameStem(file.name ?? "") }
        )
        .compactMapValues { files in
            files.sorted { ($0.name ?? "") < ($1.name ?? "") }.first
        }

        var sources: [String: ICCameraFile] = [:]
        for file in files {
            guard let fileName = file.name else { continue }

            let source = canDownloadForDisplayPreview(for: fileName)
                ? file
                : jpegFilesByStem[fileNameStem(fileName)]

            if let source {
                sources[photoIdentifier(for: file, cameraId: cameraId)] = source
            }
        }

        return sources
    }

    private func safeFileComponent(_ identifier: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
        let component = identifier
            .components(separatedBy: allowed.inverted)
            .filter { !$0.isEmpty }
            .joined(separator: "-")
        let readablePrefix = component.isEmpty ? "photo" : String(component.prefix(48))
        let encodedIdentifier = Data(identifier.utf8)
            .base64EncodedString()
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "=", with: "")
        return "\(readablePrefix)-\(encodedIdentifier)"
    }

    private func canCacheOriginalPreview(for fileName: String) -> Bool {
        let fileType = URL(fileURLWithPath: fileName).pathExtension.lowercased()
        return ["jpg", "jpeg"].contains(fileType)
    }

    private func canDownloadForDisplayPreview(for fileName: String) -> Bool {
        let fileType = URL(fileURLWithPath: fileName).pathExtension.lowercased()
        return ["jpg", "jpeg", "nef", "nrw"].contains(fileType)
    }

    private func fileNameStem(_ fileName: String) -> String {
        URL(fileURLWithPath: fileName).deletingPathExtension().lastPathComponent.lowercased()
    }

    private func download(
        file: ICCameraFile,
        from camera: ICCameraDevice,
        to destinationURL: URL,
        fileName: String,
        timeout: TimeInterval
    ) -> Bool {
        downloadFinished = false
        downloadError = nil
        camera.requestDownloadFile(
            file,
            options: [
                ICDownloadOption.downloadsDirectoryURL: destinationURL,
                ICDownloadOption.saveAsFilename: fileName
            ],
            downloadDelegate: self,
            didDownloadSelector: #selector(didDownloadFile(_:error:options:contextInfo:)),
            contextInfo: nil
        )

        let deadline = Date().addingTimeInterval(timeout)
        while !downloadFinished && Date() < deadline {
            RunLoop.current.run(mode: .default, before: min(deadline, Date().addingTimeInterval(0.1)))
        }

        return downloadFinished && downloadError == nil
    }

    private func log(_ message: String) {
        fputs("[nikon-camera-helper] \(message)\n", stderr)
    }

    private func photoIdentifier(for file: ICCameraFile, cameraId: String) -> String {
        let objectHandle = file.ptpObjectHandle == 0 ? nil : String(file.ptpObjectHandle)
        let identifier = objectHandle ?? file.name ?? "photo"
        return "\(cameraId):\(identifier)"
    }

    private func cameraIdentifier(for device: ICCameraDevice) -> String {
        device.persistentIDString ?? device.uuidString ?? device.name ?? "Nikon Camera"
    }

    private let supportedExtensions: Set<String> = ["jpg", "jpeg", "nef", "nrw", "heif", "hif"]
    private let maxInitialCachedFiles = 80

    private func isNikonOrZ6(_ camera: CameraDevice) -> Bool {
        [camera.name, camera.model].contains { value in
            value.localizedCaseInsensitiveContains("Nikon") || value.localizedCaseInsensitiveContains("Z6")
        }
    }
}

private struct CachedImagePaths {
    var thumbnailPath = ""
    var previewPath = ""
}
