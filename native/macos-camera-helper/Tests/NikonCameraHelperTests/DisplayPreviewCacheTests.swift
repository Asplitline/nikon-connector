import Foundation
import XCTest
@testable import NikonCameraHelper

final class DisplayPreviewCacheTests: XCTestCase {
    func testUsesExistingDisplayPreviewWithoutRenderingAgain() throws {
        let directory = try makeTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let paths = PreviewCachePaths(cameraId: "camera", fileIdentifier: "1", cacheDirectory: directory)
        try Data([0xff, 0xd8, 0xff, 0xd9]).write(to: paths.displayPreviewURL)
        var renderAttempted = false

        let previewPath = DisplayPreviewCache.previewPath(
            for: directory.appendingPathComponent("source.nef"),
            cachePaths: paths
        ) { _, _ in
            renderAttempted = true
            return false
        }

        XCTAssertEqual(previewPath, paths.displayPreviewURL.path)
        XCTAssertFalse(renderAttempted)
    }

    func testReturnsRenderedDisplayPreviewPathWhenRenderingSucceeds() throws {
        let directory = try makeTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let paths = PreviewCachePaths(cameraId: "camera", fileIdentifier: "2", cacheDirectory: directory)

        let previewPath = DisplayPreviewCache.previewPath(
            for: directory.appendingPathComponent("source.nef"),
            cachePaths: paths
        ) { _, destinationURL in
            try? Data([0xff, 0xd8, 0xff, 0xd9]).write(to: destinationURL)
            return true
        }

        XCTAssertEqual(previewPath, paths.displayPreviewURL.path)
    }

    func testReturnsEmptyPathForRawSourceWhenRenderingFails() throws {
        let directory = try makeTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let paths = PreviewCachePaths(cameraId: "camera", fileIdentifier: "3", cacheDirectory: directory)

        let previewPath = DisplayPreviewCache.previewPath(
            for: directory.appendingPathComponent("source.nef"),
            cachePaths: paths
        ) { _, _ in false }

        XCTAssertEqual(previewPath, "")
    }

    func testReturnsOriginalPathForJPEGSourceWhenRenderingFails() throws {
        let directory = try makeTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let paths = PreviewCachePaths(cameraId: "camera", fileIdentifier: "4", cacheDirectory: directory)
        let sourceURL = directory.appendingPathComponent("source.jpg")

        let previewPath = DisplayPreviewCache.previewPath(for: sourceURL, cachePaths: paths) { _, _ in false }

        XCTAssertEqual(previewPath, sourceURL.path)
    }

    private func makeTemporaryDirectory() throws -> URL {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("nikon-display-preview-cache-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }
}
