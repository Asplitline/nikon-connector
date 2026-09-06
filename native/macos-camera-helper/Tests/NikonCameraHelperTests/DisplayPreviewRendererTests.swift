import CoreGraphics
import Foundation
import ImageIO
import XCTest
@testable import NikonCameraHelper

final class DisplayPreviewRendererTests: XCTestCase {
    func testRendersDisplayJPEGFromJPEGSource() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("nikon-display-preview-renderer-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let sourceURL = directory.appendingPathComponent("source.jpg")
        let destinationURL = directory.appendingPathComponent("preview.jpg")
        try makeJPEGFixture(at: sourceURL)

        let rendered = DisplayPreviewRenderer().renderJPEGPreview(
            from: sourceURL,
            to: destinationURL,
            maxPixelSize: 320
        )

        XCTAssertTrue(rendered)
        XCTAssertTrue(FileManager.default.fileExists(atPath: destinationURL.path))
        XCTAssertGreaterThan(
            (try FileManager.default.attributesOfItem(atPath: destinationURL.path)[.size] as? NSNumber)?.intValue ?? 0,
            0
        )
    }

    func testReturnsFalseForInvalidSourceWithoutCreatingPreview() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("nikon-display-preview-renderer-invalid-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let sourceURL = directory.appendingPathComponent("source.nef")
        let destinationURL = directory.appendingPathComponent("preview.jpg")
        try Data("not an image".utf8).write(to: sourceURL)

        let rendered = DisplayPreviewRenderer().renderJPEGPreview(from: sourceURL, to: destinationURL)

        XCTAssertFalse(rendered)
        XCTAssertFalse(FileManager.default.fileExists(atPath: destinationURL.path))
    }

    private func makeJPEGFixture(at url: URL) throws {
        let width = 8
        let height = 8
        let bytesPerPixel = 4
        let bytesPerRow = width * bytesPerPixel
        var pixels = [UInt8](repeating: 0, count: width * height * bytesPerPixel)
        for index in stride(from: 0, to: pixels.count, by: bytesPerPixel) {
            pixels[index] = 40
            pixels[index + 1] = 120
            pixels[index + 2] = 220
            pixels[index + 3] = 255
        }

        guard let provider = CGDataProvider(data: Data(pixels) as CFData),
              let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
              let image = CGImage(
                width: width,
                height: height,
                bitsPerComponent: 8,
                bitsPerPixel: 32,
                bytesPerRow: bytesPerRow,
                space: colorSpace,
                bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
                provider: provider,
                decode: nil,
                shouldInterpolate: false,
                intent: .defaultIntent
              ),
              let destination = CGImageDestinationCreateWithURL(url as CFURL, "public.jpeg" as CFString, 1, nil) else {
            throw NSError(domain: "DisplayPreviewRendererTests", code: 1)
        }

        CGImageDestinationAddImage(destination, image, nil)
        guard CGImageDestinationFinalize(destination) else {
            throw NSError(domain: "DisplayPreviewRendererTests", code: 2)
        }
    }
}
