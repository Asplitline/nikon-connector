import Foundation

struct PreviewCachePaths {
    let thumbnailURL: URL
    let displayPreviewURL: URL
    private let cacheDirectory: URL
    private let cacheKey: String

    init(cameraId: String, fileIdentifier: String, cacheDirectory: URL) {
        let cacheKey = Self.safeFileComponent("\(cameraId)-\(fileIdentifier)")
        self.cacheDirectory = cacheDirectory
        self.cacheKey = cacheKey
        thumbnailURL = cacheDirectory.appendingPathComponent("\(cacheKey)-thumb.jpg")
        displayPreviewURL = cacheDirectory.appendingPathComponent("\(cacheKey)-display-preview.jpg")
    }

    func existingThumbnailPath() -> String {
        FileManager.default.fileExists(atPath: thumbnailURL.path) ? thumbnailURL.path : ""
    }

    func existingDisplayPreviewPath() -> String {
        FileManager.default.fileExists(atPath: displayPreviewURL.path) ? displayPreviewURL.path : ""
    }

    func originalPreviewURL(forExtension fileExtension: String) -> URL {
        let normalizedExtension = fileExtension
            .trimmingCharacters(in: CharacterSet(charactersIn: "."))
            .lowercased()
        return cacheDirectory.appendingPathComponent("\(cacheKey)-original-preview.\(normalizedExtension)")
    }

    private static func safeFileComponent(_ identifier: String) -> String {
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
}
