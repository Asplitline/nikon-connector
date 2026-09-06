import Foundation

struct DisplayPreviewCache {
    static func previewPath(
        for sourceURL: URL,
        cachePaths: PreviewCachePaths,
        render: (URL, URL) -> Bool
    ) -> String {
        let existingDisplayPreviewPath = cachePaths.existingDisplayPreviewPath()
        if !existingDisplayPreviewPath.isEmpty {
            return existingDisplayPreviewPath
        }

        if render(sourceURL, cachePaths.displayPreviewURL) {
            return cachePaths.displayPreviewURL.path
        }

        return canDisplayOriginalInWebView(sourceURL) ? sourceURL.path : ""
    }

    static func previewPath(
        for sourceURL: URL,
        cachePaths: PreviewCachePaths,
        renderer: DisplayPreviewRenderer = DisplayPreviewRenderer()
    ) -> String {
        previewPath(for: sourceURL, cachePaths: cachePaths) { sourceURL, destinationURL in
            renderer.renderJPEGPreview(from: sourceURL, to: destinationURL)
        }
    }

    private static func canDisplayOriginalInWebView(_ sourceURL: URL) -> Bool {
        ["jpg", "jpeg"].contains(sourceURL.pathExtension.lowercased())
    }
}
