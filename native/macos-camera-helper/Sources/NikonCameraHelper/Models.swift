import Foundation

struct CameraDevice: Codable {
    let id: String
    let name: String
    let model: String
    let connection: String
}

struct CameraPhoto: Codable {
    let id: String
    let cameraId: String
    let fileName: String
    let capturedAt: String
    var rating: Int
    let fileType: String
    let width: Int
    let height: Int
    let sizeMb: Double
    let previewUrl: String
    let thumbnailUrl: String
    let objectHandle: String?
    let storageId: String?
    let canDownloadOriginal: Bool?
    let hasEmbeddedPreview: Bool?
    let aperture: String?
    let exposureCompensation: String?
    let focalLength: String?
    let iso: Int?
    let shutterSpeed: String?
}

struct CommandError: Codable {
    let error: String
}

struct CachedPhotoPreview: Codable {
    let photoId: String
    let previewUrl: String
    let thumbnailUrl: String
}

struct ExportPhotosSummary: Codable {
    let copied: Int
    let skipped: Int
    let failed: Int
}
