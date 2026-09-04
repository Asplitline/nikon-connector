import Foundation
import ImageCaptureCore

// 探测：ICCameraDevice 是否能在完整 catalog 就绪前增量拿到 item
final class Probe: NSObject, ICDeviceBrowserDelegate, ICCameraDeviceDelegate {
    var t0 = Date()
    var firstDeviceAt: TimeInterval?
    var firstItemsAt: TimeInterval?
    var catalogReadyAt: TimeInterval?
    var sessionOpenAt: TimeInterval?
    var itemCount = 0
    let browser = ICDeviceBrowser()

    func run() {
        browser.delegate = self
        browser.browsedDeviceTypeMask = .camera
        t0 = Date()
        browser.start()
        // 跑 25s 观察各回调的相对时序
        let deadline = Date().addingTimeInterval(25)
        while Date() < deadline {
            RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.2))
        }
        print("--- TIMELINE (s from browser.start) ---")
        print("firstDevice:  \(firstDeviceAt.map{String(format:"%.2f",$0)} ?? "never")")
        print("sessionOpen:  \(sessionOpenAt.map{String(format:"%.2f",$0)} ?? "never")")
        print("firstItems:   \(firstItemsAt.map{String(format:"%.2f",$0)} ?? "never")  (didAdd items)")
        print("catalogReady: \(catalogReadyAt.map{String(format:"%.2f",$0)} ?? "never")")
        print("itemsSeen:    \(itemCount)")
        if let fi = firstItemsAt, let cr = catalogReadyAt {
            print(">>> INCREMENTAL WINDOW: \(String(format:"%.2f", cr - fi))s of items available BEFORE full catalog")
        }
    }

    func deviceBrowser(_ b: ICDeviceBrowser, didAdd device: ICDevice, moreComing: Bool) {
        if firstDeviceAt == nil { firstDeviceAt = Date().timeIntervalSince(t0) }
        guard let cam = device as? ICCameraDevice else { return }
        cam.delegate = self
        cam.requestOpenSession()
    }
    func deviceBrowser(_ b: ICDeviceBrowser, didRemove d: ICDevice, moreGoing: Bool) {}
    func device(_ device: ICDevice, didOpenSessionWithError error: Error?) {
        if sessionOpenAt == nil { sessionOpenAt = Date().timeIntervalSince(t0) }
    }
    func device(_ device: ICDevice, didCloseSessionWithError error: Error?) {}
    func didRemove(_ device: ICDevice) {}
    func cameraDevice(_ c: ICCameraDevice, didAdd items: [ICCameraItem]) {
        if firstItemsAt == nil { firstItemsAt = Date().timeIntervalSince(t0) }
        itemCount += items.count
    }
    func cameraDevice(_ c: ICCameraDevice, didRemove items: [ICCameraItem]) {}
    func deviceDidBecomeReady(withCompleteContentCatalog d: ICCameraDevice) {
        if catalogReadyAt == nil { catalogReadyAt = Date().timeIntervalSince(t0) }
    }
    func cameraDevice(_ c: ICCameraDevice, didReceiveThumbnail t: CGImage?, for i: ICCameraItem, error: Error?) {}
    func cameraDevice(_ c: ICCameraDevice, didReceiveMetadata m: [AnyHashable:Any]?, for i: ICCameraItem, error: Error?) {}
    func cameraDevice(_ c: ICCameraDevice, didRenameItems items: [ICCameraItem]) {}
    func cameraDeviceDidChangeCapability(_ c: ICCameraDevice) {}
    func cameraDevice(_ c: ICCameraDevice, didReceivePTPEvent e: Data) {}
    func cameraDeviceDidRemoveAccessRestriction(_ d: ICDevice) {}
    func cameraDeviceDidEnableAccessRestriction(_ d: ICDevice) {}
}
Probe().run()
