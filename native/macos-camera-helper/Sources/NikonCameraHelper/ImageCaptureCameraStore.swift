import Foundation
import ImageCaptureCore

final class ImageCaptureCameraStore: NSObject, ICDeviceBrowserDelegate, ICCameraDeviceDelegate {
    private let browser = ICDeviceBrowser()
    private var cameraDevices: [ICCameraDevice] = []
    private var initialScanFinished = false
    private var contentCatalogFinished = false

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
        _ = cacheDir
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

        let photos = flatten(items: camera.contents ?? [], cameraId: cameraId)
        camera.requestCloseSession()
        camera.delegate = nil
        return photos
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

    private func flatten(items: [ICCameraItem], cameraId: String, storageId: String? = nil) -> [CameraPhoto] {
        items.flatMap { item in
            if let folder = item as? ICCameraFolder {
                return flatten(
                    items: folder.contents ?? [],
                    cameraId: cameraId,
                    storageId: storageId ?? folder.name
                )
            }

            guard let file = item as? ICCameraFile,
                  let fileName = file.name,
                  supportedExtensions.contains(URL(fileURLWithPath: fileName).pathExtension.lowercased()) else {
                return []
            }

            let objectHandle = file.ptpObjectHandle == 0 ? nil : String(file.ptpObjectHandle)
            let identifier = objectHandle ?? fileName
            let capturedAt = file.creationDate.map { ISO8601DateFormatter().string(from: $0) } ?? ""
            return [CameraPhoto(
                id: "\(cameraId):\(identifier)",
                cameraId: cameraId,
                fileName: fileName,
                capturedAt: capturedAt,
                rating: 0,
                fileType: URL(fileURLWithPath: fileName).pathExtension.lowercased(),
                width: file.width > 0 ? Int(file.width) : 0,
                height: file.height > 0 ? Int(file.height) : 0,
                sizeMb: Double(file.fileSize) / 1024.0 / 1024.0,
                previewUrl: "",
                thumbnailUrl: "",
                objectHandle: objectHandle,
                storageId: storageId,
                canDownloadOriginal: true,
                hasEmbeddedPreview: false
            )]
        }
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
