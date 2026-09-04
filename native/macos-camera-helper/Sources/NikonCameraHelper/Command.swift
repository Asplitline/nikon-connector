enum Command {
    case listCameras
    case listPhotos(cameraId: String, cacheDir: String)
    case cachePhotoPreview(cameraId: String, photoId: String, cacheDir: String)
    case cachePhotoPreviews(cameraId: String, photoIds: [String], previewPhotoIds: [String], cacheDir: String)
    case exportPhotos(cameraId: String, destinationDir: String, photoIds: [String])
    case setRating(photoId: String, rating: Int)

    static func parse(_ args: [String]) throws -> Command {
        guard let name = args.first else { throw HelperError.message("Missing command.") }
        switch name {
        case "list-cameras":
            return .listCameras
        case "list-photos":
            return .listPhotos(
                cameraId: try value(after: "--camera-id", in: args),
                cacheDir: try value(after: "--cache-dir", in: args)
            )
        case "cache-photo-preview":
            return .cachePhotoPreview(
                cameraId: try value(after: "--camera-id", in: args),
                photoId: try value(after: "--photo-id", in: args),
                cacheDir: try value(after: "--cache-dir", in: args)
            )
        case "cache-photo-previews":
            return .cachePhotoPreviews(
                cameraId: try value(after: "--camera-id", in: args),
                photoIds: values(after: "--photo-id", in: args),
                previewPhotoIds: values(after: "--preview-photo-id", in: args),
                cacheDir: try value(after: "--cache-dir", in: args)
            )
        case "export-photos":
            return .exportPhotos(
                cameraId: try value(after: "--camera-id", in: args),
                destinationDir: try value(after: "--destination-dir", in: args),
                photoIds: values(after: "--photo-id", in: args)
            )
        case "set-rating":
            let photoId = try value(after: "--photo-id", in: args)
            let ratingText = try value(after: "--rating", in: args)
            guard let rating = Int(ratingText), (0...5).contains(rating) else {
                throw HelperError.message("Rating must be between 0 and 5.")
            }
            return .setRating(photoId: photoId, rating: rating)
        default:
            throw HelperError.message("Unknown command: \(name).")
        }
    }

    private static func value(after flag: String, in args: [String]) throws -> String {
        guard let index = args.firstIndex(of: flag), args.indices.contains(index + 1) else {
            throw HelperError.message("Missing \(flag).")
        }
        return args[index + 1]
    }

    private static func values(after flag: String, in args: [String]) -> [String] {
        args.indices.compactMap { index in
            args[index] == flag && args.indices.contains(index + 1) ? args[index + 1] : nil
        }
    }
}

enum HelperError: Error {
    case message(String)
}
