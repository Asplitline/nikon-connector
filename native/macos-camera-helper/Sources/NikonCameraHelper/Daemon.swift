import Foundation

// 常驻模式：一个进程服务整个 app 会话，持有单个 ImageCaptureCore 浏览器与会话，
// 把「扫描设备 + 打开会话 + 等目录」的固定开销从每批一次降到全程一次。
//
// 线程模型（已实测）：
//   - 后台线程阻塞读 stdin（readLine 会阻塞，不能放主线程）
//   - 请求派发到主线程执行（ImageCaptureCore 的 delegate 要求主线程）
//   - 主线程跑 CFRunLoopRun 保持 run loop 活着
//
// stdout 必须行缓冲（见 main.swift 的 setvbuf）：管道下默认是块缓冲，
// 响应会卡在 libc 缓冲区里直到进程退出，导致读端永久阻塞。
final class Daemon {
    private let store: ImageCaptureCameraStore
    private let defaultTimeout: TimeInterval

    init(store: ImageCaptureCameraStore, defaultTimeout: TimeInterval = 8.0) {
        self.store = store
        self.defaultTimeout = defaultTimeout
    }

    func run() {
        logDaemon("daemon starting")
        store.enablePersistentSession()

        let reader = Thread { [weak self] in
            self?.readLoop()
        }
        reader.stackSize = 512 * 1024
        reader.start()

        CFRunLoopRun()
        store.shutdown()
        logDaemon("daemon run loop exited")
    }

    private func readLoop() {
        while let line = readLine(strippingNewline: true) {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty {
                continue
            }

            guard let data = trimmed.data(using: .utf8),
                  let request = try? JSONDecoder().decode(HelperRequest.self, from: data) else {
                logDaemon("dropping malformed request line")
                writeResponse(HelperResponse(
                    id: 0,
                    type: .error,
                    payload: HelperErrorPayload(message: "Malformed request.")
                ))
                continue
            }

            if request.cmd == "shutdown" {
                writeResponse(HelperResponse(
                    id: request.id,
                    type: .result,
                    payload: HelperEmptyPayload(ok: true)
                ))
                stopRunLoop()
                return
            }

            // 相机操作必须在主线程串行执行；这里同步等它做完再读下一条，
            // 保证 PTP 会话上永远只有一个在途请求
            let done = DispatchSemaphore(value: 0)
            DispatchQueue.main.async { [weak self] in
                self?.handle(request: request)
                done.signal()
            }
            done.wait()
        }

        logDaemon("stdin closed")
        stopRunLoop()
    }

    private func stopRunLoop() {
        DispatchQueue.main.async {
            CFRunLoopStop(CFRunLoopGetMain())
        }
    }

    private func handle(request: HelperRequest) {
        let timeout = request.timeout ?? defaultTimeout

        do {
            let command = try Command.from(request: request)

            switch command {
            case .listCameras:
                let cameras = store.listCameras(timeout: timeout)
                writeResponse(HelperResponse(id: request.id, type: .result, payload: cameras))

            case let .listPhotos(cameraId, cacheDir):
                let photos = store.listPhotos(
                    cameraId: cameraId,
                    cacheDir: cacheDir,
                    timeout: timeout
                )
                writeResponse(HelperResponse(id: request.id, type: .result, payload: photos))

            case let .cachePhotoPreview(cameraId, photoId, cacheDir):
                let preview = store.cachePhotoPreview(
                    cameraId: cameraId,
                    photoId: photoId,
                    cacheDir: cacheDir,
                    timeout: timeout
                )
                writeResponse(HelperResponse(id: request.id, type: .result, payload: preview))

            case let .cachePhotoPreviews(cameraId, photoIds, previewPhotoIds, cacheDir):
                let previews = store.cachePhotoPreviews(
                    cameraId: cameraId,
                    photoIds: photoIds,
                    previewPhotoIds: previewPhotoIds,
                    cacheDir: cacheDir,
                    timeout: timeout
                )
                writeResponse(HelperResponse(id: request.id, type: .result, payload: previews))

            case let .exportPhotos(cameraId, destinationDir, photoIds):
                let summary = store.exportPhotos(
                    cameraId: cameraId,
                    destinationDir: destinationDir,
                    photoIds: photoIds,
                    timeout: max(timeout, 30.0)
                )
                writeResponse(HelperResponse(id: request.id, type: .result, payload: summary))

            case .setRating:
                writeResponse(HelperResponse(
                    id: request.id,
                    type: .error,
                    payload: HelperErrorPayload(message: "Nikon SDK unavailable.")
                ))
            }
        } catch HelperError.message(let message) {
            writeResponse(HelperResponse(
                id: request.id,
                type: .error,
                payload: HelperErrorPayload(message: message)
            ))
        } catch {
            // 单条请求出错不能拖垮常驻进程
            writeResponse(HelperResponse(
                id: request.id,
                type: .error,
                payload: HelperErrorPayload(message: "\(error)")
            ))
        }
    }
}

private func logDaemon(_ message: String) {
    fputs("[nikon-camera-helper] \(message)\n", stderr)
}
