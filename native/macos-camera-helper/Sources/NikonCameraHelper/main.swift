import Foundation

let encoder = JSONEncoder()

func writeJSON<T: Encodable>(_ value: T) {
    guard let data = try? encoder.encode(value), let output = String(data: data, encoding: .utf8) else {
        fputs("{\"error\":\"Unable to encode helper response.\"}\n", stderr)
        exit(EXIT_FAILURE)
    }
    print(output)
}

do {
    switch try Command.parse(Array(CommandLine.arguments.dropFirst())) {
    case .listCameras:
        writeJSON(ImageCaptureCameraStore().listCameras(timeout: 3.0))
    case let .listPhotos(cameraId, cacheDir):
        writeJSON(ImageCaptureCameraStore().listPhotos(cameraId: cameraId, cacheDir: cacheDir, timeout: 8.0))
    case let .exportPhotos(cameraId, destinationDir, photoIds):
        writeJSON(ImageCaptureCameraStore().exportPhotos(cameraId: cameraId, destinationDir: destinationDir, photoIds: photoIds, timeout: 30.0))
    case .setRating:
        writeJSON(CommandError(error: "Nikon SDK unavailable."))
        exit(EXIT_FAILURE)
    }
} catch HelperError.message(let message) {
    writeJSON(CommandError(error: message))
    exit(EXIT_FAILURE)
}
