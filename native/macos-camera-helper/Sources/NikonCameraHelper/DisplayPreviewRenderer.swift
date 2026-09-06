import Foundation
import ImageIO

struct DisplayPreviewRenderer {
    func renderJPEGPreview(
        from sourceURL: URL,
        to destinationURL: URL,
        maxPixelSize: Int = 3200
    ) -> Bool {
        guard let source = CGImageSourceCreateWithURL(sourceURL as CFURL, nil) else {
            return false
        }

        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixelSize
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary),
              let destination = CGImageDestinationCreateWithURL(
                destinationURL as CFURL,
                "public.jpeg" as CFString,
                1,
                nil
              ) else {
            return false
        }

        CGImageDestinationAddImage(destination, image, [
            kCGImageDestinationLossyCompressionQuality: 0.9
        ] as CFDictionary)
        return CGImageDestinationFinalize(destination)
    }
}
