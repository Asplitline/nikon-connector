import Foundation
import XCTest
@testable import NikonCameraHelper

final class ShootingMetadataTests: XCTestCase {
    func testParsesCommonExifShootingMetadata() {
        let metadata: [AnyHashable: Any] = [
            "{Exif}": [
                "FNumber": 2.8,
                "ExposureBiasValue": -0.333,
                "FocalLength": 70,
                "ISOSpeedRatings": [400],
                "ExposureTime": 0.002
            ]
        ]

        let result = ShootingMetadata.from(metadata)

        XCTAssertEqual(result.aperture, "f/2.8")
        XCTAssertEqual(result.exposureCompensation, "-0.3 EV")
        XCTAssertEqual(result.focalLength, "70 mm")
        XCTAssertEqual(result.iso, 400)
        XCTAssertEqual(result.shutterSpeed, "1/500")
    }

    func testParsesTopLevelStringMetadataWhenExifGroupIsMissing() {
        let metadata: [AnyHashable: Any] = [
            "FNumber": "5.6",
            "ExposureBiasValue": "0",
            "FocalLength": "35",
            "PhotographicSensitivity": "200",
            "ExposureTime": "0.003125"
        ]

        let result = ShootingMetadata.from(metadata)

        XCTAssertEqual(result.aperture, "f/5.6")
        XCTAssertEqual(result.exposureCompensation, "0 EV")
        XCTAssertEqual(result.focalLength, "35 mm")
        XCTAssertEqual(result.iso, 200)
        XCTAssertEqual(result.shutterSpeed, "1/320")
    }
}
