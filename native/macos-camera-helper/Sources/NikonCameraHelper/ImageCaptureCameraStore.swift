import Foundation
import ImageCaptureCore

final class ImageCaptureCameraStore: NSObject, ICDeviceBrowserDelegate {
    private let browser = ICDeviceBrowser()
    private var cameraDevices: [ICCameraDevice] = []
    private var initialScanFinished = false

    func listCameras(timeout: TimeInterval) -> [CameraDevice] {
        cameraDevices = []
        initialScanFinished = false
        browser.delegate = self
        browser.browsedDeviceTypeMask = .camera
        browser.start()

        let deadline = Date().addingTimeInterval(timeout)
        while !initialScanFinished && Date() < deadline {
            RunLoop.current.run(mode: .default, before: min(deadline, Date().addingTimeInterval(0.1)))
        }

        browser.stop()
        browser.delegate = nil

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

    private func isNikonOrZ6(_ camera: CameraDevice) -> Bool {
        [camera.name, camera.model].contains { value in
            value.localizedCaseInsensitiveContains("Nikon") || value.localizedCaseInsensitiveContains("Z6")
        }
    }
}
