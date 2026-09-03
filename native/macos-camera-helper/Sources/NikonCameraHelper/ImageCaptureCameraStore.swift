import Foundation
import ImageCaptureCore

final class ImageCaptureCameraStore: NSObject, ICDeviceBrowserDelegate, ICCameraDeviceDelegate, ICCameraDeviceDownloadDelegate {
    private let browser = ICDeviceBrowser()
    private var cameraDevices: [ICCameraDevice] = []
    private var initialScanFinished = false
    private var contentCatalogFinished = false
    private var downloadFinished = false
    private var downloadError: Error?

    func listCameras(timeout: TimeInterval) -> [CameraDevice] {
        startBrowser(timeout: timeout)
        defer { stopBrowser() }

        return cameraDevices
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
    }

    func listPhotos(cameraId: String, cacheDir: String, timeout: TimeInterval) -> [CameraPhoto] {
        startBrowser(timeout: timeout)
        defer { stopBrowser() }

        guard let camera = cameraDevices.first(where: { cameraIdentifier(for: $0) == cameraId }) else {
            return []
        }

        contentCatalogFinished = false
        camera.delegate = self
        camera.requestOpenSession()

        let deadline = Date().addingTimeInterval(timeout)
        while !contentCatalogFinished && Date() < deadline {
            RunLoop.current.run(mode: .default, before: min(deadline, Date().addingTimeInterval(0.1)))
        }

        let cacheURL = URL(fileURLWithPath: cacheDir, isDirectory: true)
        let files = cameraFiles(in: camera.contents ?? [])
        let cachedImages = cacheImages(
            for: files,
            cameraId: cameraId,
            in: cacheURL,
            timeout: timeout
        )
        let photos = flatten(
            items: camera.contents ?? [],
            cameraId: cameraId,
            cachedImages: cachedImages
        )
        camera.requestCloseSession()
        camera.delegate = nil
        return photos
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

        startBrowser(timeout: timeout)
        defer { stopBrowser() }

        guard let camera = cameraDevices.first(where: { cameraIdentifier(for: $0) == cameraId }) else {
            return ExportPhotosSummary(copied: 0, skipped: 0, failed: photoIds.count)
        }

        contentCatalogFinished = false
        camera.delegate = self
        camera.requestOpenSession()

        let deadline = Date().addingTimeInterval(timeout)
        while !contentCatalogFinished && Date() < deadline {
            RunLoop.current.run(mode: .default, before: min(deadline, Date().addingTimeInterval(0.1)))
        }

        let destinationURL = URL(fileURLWithPath: destinationDir, isDirectory: true)
        guard (try? FileManager.default.createDirectory(
            at: destinationURL,
            withIntermediateDirectories: true
        )) != nil else {
            camera.requestCloseSession()
            camera.delegate = nil
            return ExportPhotosSummary(copied: 0, skipped: 0, failed: photoIds.count)
        }

        let requestedIds = Set(photoIds)
        let filesById = Dictionary(
            uniqueKeysWithValues: cameraFiles(in: camera.contents ?? []).map { file in
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

        camera.requestCloseSession()
        camera.delegate = nil
        return ExportPhotosSummary(copied: copied, skipped: skipped, failed: failed)
    }

    func deviceBrowser(_ browser: ICDeviceBrowser, didAdd device: ICDevice, moreComing: Bool) {
        if let camera = device as? ICCameraDevice {
            cameraDevices.append(camera)
        }

        if !moreComing {
            initialScanFinished = true
        }
    }

    func deviceBrowser(_ browser: ICDeviceBrowser, didRemove device: ICDevice, moreGoing: Bool) {
        guard let camera = device as? ICCameraDevice else { return }
        cameraDevices.removeAll { $0 === camera }
    }

    func deviceDidBecomeReady(withCompleteContentCatalog device: ICCameraDevice) {
        contentCatalogFinished = true
    }

    func cameraDevice(_ camera: ICCameraDevice, didAdd items: [ICCameraItem]) {}

    func cameraDevice(_ camera: ICCameraDevice, didRemove items: [ICCameraItem]) {}

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
            contentCatalogFinished = true
        }
    }

    func device(_ device: ICDevice, didCloseSessionWithError error: Error?) {}

    func didRemove(_ device: ICDevice) {
        contentCatalogFinished = true
    }

    private func startBrowser(timeout: TimeInterval) {
        cameraDevices = []
        initialScanFinished = false
        browser.delegate = self
        browser.browsedDeviceTypeMask = .camera
        browser.start()

        let deadline = Date().addingTimeInterval(timeout)
        while !initialScanFinished && Date() < deadline {
            RunLoop.current.run(mode: .default, before: min(deadline, Date().addingTimeInterval(0.1)))
        }
    }

    private func stopBrowser() {
        browser.stop()
        browser.delegate = nil
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
                hasEmbeddedPreview: false
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

    private func cacheImages(
        for files: [ICCameraFile],
        cameraId: String,
        in cacheURL: URL,
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

        for file in files {
            guard let fileName = file.name else { continue }
            let identifier = file.ptpObjectHandle == 0 ? fileName : String(file.ptpObjectHandle)
            let cacheKey = safeFileComponent("\(cameraId)-\(identifier)")
            let thumbnailURL = cacheURL.appendingPathComponent("\(cacheKey)-thumb.jpg")
            let previewURL = cacheURL.appendingPathComponent("\(cacheKey)-preview.jpg")
            let fileIdentifier = ObjectIdentifier(file)

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

            if canRequestPreview(for: fileName) {
                group.enter()
                file.requestThumbnailData(options: [
                    .imageSourceThumbnailMaxPixelSize: NSNumber(value: 2400)
                ]) { data, error in
                    defer { group.leave() }
                    guard let data, error == nil else { return }

                    do {
                        try data.write(to: previewURL, options: .atomic)
                        lock.lock()
                        var cachedImage = paths[fileIdentifier] ?? CachedImagePaths()
                        cachedImage.previewPath = previewURL.path
                        paths[fileIdentifier] = cachedImage
                        lock.unlock()
                    } catch {
                        return
                    }
                }
            }
        }

        _ = group.wait(timeout: .now() + timeout)
        return paths
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

    private func canRequestPreview(for fileName: String) -> Bool {
        let fileType = URL(fileURLWithPath: fileName).pathExtension.lowercased()
        return ["jpg", "jpeg", "heif", "hif"].contains(fileType)
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

    private func photoIdentifier(for file: ICCameraFile, cameraId: String) -> String {
        let objectHandle = file.ptpObjectHandle == 0 ? nil : String(file.ptpObjectHandle)
        let identifier = objectHandle ?? file.name ?? "photo"
        return "\(cameraId):\(identifier)"
    }

    private func cameraIdentifier(for device: ICCameraDevice) -> String {
        device.persistentIDString ?? device.uuidString ?? device.name ?? "Nikon Camera"
    }

    private let supportedExtensions: Set<String> = ["jpg", "jpeg", "nef", "nrw", "heif", "hif"]

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
