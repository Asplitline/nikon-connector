// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "NikonCameraHelper",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "nikon-camera-helper", targets: ["NikonCameraHelper"])
    ],
    targets: [
        .executableTarget(
            name: "NikonCameraHelper",
            linkerSettings: [
                .linkedFramework("Foundation"),
                .linkedFramework("ImageCaptureCore")
            ]
        )
    ]
)
