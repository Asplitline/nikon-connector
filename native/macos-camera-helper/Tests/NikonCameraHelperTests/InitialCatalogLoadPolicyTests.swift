import XCTest
@testable import NikonCameraHelper

final class InitialCatalogLoadPolicyTests: XCTestCase {
    func testInitialCatalogDoesNotWarmCameraImages() {
        XCTAssertFalse(InitialCatalogLoadPolicy.shouldWarmCameraImages)
    }
}
