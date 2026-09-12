import Foundation

// daemon 模式的 NDJSON 协议：一行一条消息，用 id 关联请求与响应。
// 一次性 argv 模式仍然保留（见 main.swift），两者共用下面的 Command 表示。

struct HelperRequest: Decodable {
    let id: Int
    let cmd: String
    let cameraId: String?
    let cacheDir: String?
    let destinationDir: String?
    let photoId: String?
    let photoIds: [String]?
    let previewPhotoIds: [String]?
    let rating: Int?
    let timeout: Double?
}

// 响应类型：result 为终态，progress 可在终态前多次出现（L3 渐进式投递用）
enum HelperResponseKind: String, Encodable {
    case error
    case progress
    case result
}

struct HelperResponse<Payload: Encodable>: Encodable {
    let id: Int
    let type: HelperResponseKind
    let payload: Payload
}

struct HelperErrorPayload: Encodable {
    let message: String
}

// 空 payload 占位，供 shutdown 之类无返回值的命令使用
struct HelperEmptyPayload: Encodable {
    let ok: Bool
}

extension Command {
    // 把 NDJSON 请求翻译成既有的 Command 表示，复用 argv 模式的全部执行逻辑
    static func from(request: HelperRequest) throws -> Command {
        switch request.cmd {
        case "list-cameras":
            return .listCameras
        case "list-photos":
            return .listPhotos(
                cameraId: try require(request.cameraId, "cameraId"),
                cacheDir: try require(request.cacheDir, "cacheDir")
            )
        case "cache-photo-preview":
            let photoIds = request.photoIds ?? []
            guard let photoId = photoIds.first else {
                throw HelperError.message("Missing photoIds.")
            }
            return .cachePhotoPreview(
                cameraId: try require(request.cameraId, "cameraId"),
                photoId: photoId,
                cacheDir: try require(request.cacheDir, "cacheDir")
            )
        case "cache-photo-previews":
            return .cachePhotoPreviews(
                cameraId: try require(request.cameraId, "cameraId"),
                photoIds: request.photoIds ?? [],
                previewPhotoIds: request.previewPhotoIds ?? [],
                cacheDir: try require(request.cacheDir, "cacheDir")
            )
        case "export-photos":
            return .exportPhotos(
                cameraId: try require(request.cameraId, "cameraId"),
                destinationDir: try require(request.destinationDir, "destinationDir"),
                photoIds: request.photoIds ?? []
            )
        case "set-rating":
            guard let rating = request.rating, (0...5).contains(rating) else {
                throw HelperError.message("Rating must be between 0 and 5.")
            }
            return .setRating(
                cameraId: try require(request.cameraId, "cameraId"),
                photoId: try require(request.photoId, "photoId"),
                rating: rating
            )
        default:
            throw HelperError.message("Unknown command: \(request.cmd).")
        }
    }

    private static func require(_ value: String?, _ name: String) throws -> String {
        guard let value, !value.isEmpty else {
            throw HelperError.message("Missing \(name).")
        }
        return value
    }
}
