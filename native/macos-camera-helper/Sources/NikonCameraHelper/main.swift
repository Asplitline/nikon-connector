import Foundation

// stdout 改行缓冲：管道下 print 默认块缓冲，daemon 模式的响应会卡在
// libc 缓冲区里直到进程退出，令读端永久阻塞。一次性模式无害。
setvbuf(stdout, nil, _IOLBF, 0)

let encoder = JSONEncoder()

func writeJSON<T: Encodable>(_ value: T) {
    guard let data = try? encoder.encode(value), let output = String(data: data, encoding: .utf8) else {
        fputs("{\"error\":\"Unable to encode helper response.\"}\n", stderr)
        exit(EXIT_FAILURE)
    }
    print(output)
}

// daemon 模式下不能 exit：一条编码失败只影响这一条响应
func writeResponse<T: Encodable>(_ value: T) {
    guard let data = try? encoder.encode(value), let output = String(data: data, encoding: .utf8) else {
        fputs("[nikon-camera-helper] failed to encode response\n", stderr)
        print("{\"id\":0,\"type\":\"error\",\"payload\":{\"message\":\"Unable to encode helper response.\"}}")
        return
    }
    print(output)
}

let arguments = Array(CommandLine.arguments.dropFirst())

// 常驻模式：整个 app 会话复用同一个 store（同一个浏览器与相机会话）
if arguments.first == "--daemon" {
    Daemon(store: ImageCaptureCameraStore()).run()
    exit(EXIT_SUCCESS)
}

// 一次性模式：保留给 README 里记录的手工验证与既有实测命令
do {
    let store = ImageCaptureCameraStore()

    switch try Command.parse(arguments) {
    case .listCameras:
        writeJSON(store.listCameras(timeout: 3.0))
    case let .listPhotos(cameraId, cacheDir):
        writeJSON(store.listPhotos(cameraId: cameraId, cacheDir: cacheDir, timeout: 8.0))
    case let .cachePhotoPreview(cameraId, photoId, cacheDir):
        writeJSON(store.cachePhotoPreview(cameraId: cameraId, photoId: photoId, cacheDir: cacheDir, timeout: 8.0))
    case let .cachePhotoPreviews(cameraId, photoIds, previewPhotoIds, cacheDir):
        writeJSON(store.cachePhotoPreviews(cameraId: cameraId, photoIds: photoIds, previewPhotoIds: previewPhotoIds, cacheDir: cacheDir, timeout: 8.0))
    case let .exportPhotos(cameraId, destinationDir, photoIds):
        writeJSON(store.exportPhotos(cameraId: cameraId, destinationDir: destinationDir, photoIds: photoIds, timeout: 30.0))
    case .setRating:
        writeJSON(CommandError(error: "Nikon SDK unavailable."))
        exit(EXIT_FAILURE)
    }
} catch HelperError.message(let message) {
    writeJSON(CommandError(error: message))
    exit(EXIT_FAILURE)
}
