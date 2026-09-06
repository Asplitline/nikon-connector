import Foundation
import XCTest
@testable import NikonCameraHelper

final class PreviewCachePathsTests: XCTestCase {
    func testUsesExistingThumbnailPathWithoutChangingTheCacheKey() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("nikon-preview-cache-paths-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let paths = PreviewCachePaths(
            cameraId: "Nikon Z6III",
            fileIdentifier: "42",
            cacheDirectory: directory
        )
        try Data([0xff, 0xd8, 0xff, 0xd9]).write(to: paths.thumbnailURL)

        XCTAssertEqual(paths.existingThumbnailPath(), paths.thumbnailURL.path)
    }

    func testMissingThumbnailHasNoExistingPath() {
        let paths = PreviewCachePaths(
            cameraId: "camera",
            fileIdentifier: "missing",
            cacheDirectory: FileManager.default.temporaryDirectory
        )

        XCTAssertEqual(paths.existingThumbnailPath(), "")
    }

    func testUsesDeterministicOriginalPreviewPathForSourceExtension() {
        let paths = PreviewCachePaths(
            cameraId: "Nikon Z6III",
            fileIdentifier: "42",
            cacheDirectory: FileManager.default.temporaryDirectory
        )

        XCTAssertTrue(paths.originalPreviewURL(forExtension: "NEF").lastPathComponent.hasSuffix("-original-preview.nef"))
        XCTAssertTrue(paths.originalPreviewURL(forExtension: ".jpg").lastPathComponent.hasSuffix("-original-preview.jpg"))
    }

    func testUsesExistingDisplayPreviewPathWithoutChangingTheCacheKey() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("nikon-display-preview-cache-paths-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let paths = PreviewCachePaths(
            cameraId: "Nikon Z6III",
            fileIdentifier: "42",
            cacheDirectory: directory
        )
        try Data([0xff, 0xd8, 0xff, 0xd9]).write(to: paths.displayPreviewURL)

        XCTAssertEqual(paths.existingDisplayPreviewPath(), paths.displayPreviewURL.path)
    }
}
