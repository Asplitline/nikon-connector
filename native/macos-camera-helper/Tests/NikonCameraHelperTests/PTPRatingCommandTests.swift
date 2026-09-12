import Foundation
import XCTest
@testable import NikonCameraHelper

final class PTPRatingCommandTests: XCTestCase {
    func testBuildsSetObjectRatingCommand() throws {
        let packet = PTPRatingCommand.setRatingCommand(
            objectHandle: 0x01020304,
            transactionId: 7
        )

        XCTAssertEqual(packet as NSData, Data([
            20, 0, 0, 0,
            1, 0,
            0x04, 0x98,
            7, 0, 0, 0,
            0x04, 0x03, 0x02, 0x01,
            0x8a, 0xdc, 0, 0,
        ]) as NSData)
    }

    func testBuildsUInt16RatingPayload() {
        XCTAssertEqual(
            PTPRatingCommand.ratingPayload(5) as NSData,
            Data([5, 0]) as NSData
        )
    }

    func testParsesOkResponse() {
        let response = Data([
            12, 0, 0, 0,
            3, 0,
            1, 0x20,
            7, 0, 0, 0,
        ])

        XCTAssertNoThrow(try PTPRatingCommand.validateResponse(response))
    }

    func testReportsDeviceResponseErrors() {
        let response = Data([
            12, 0, 0, 0,
            3, 0,
            0x05, 0x20,
            7, 0, 0, 0,
        ])

        XCTAssertThrowsError(try PTPRatingCommand.validateResponse(response)) { error in
            XCTAssertEqual(
                String(describing: error),
                "message(\"Camera rejected rating write-back with PTP response 0x2005.\")"
            )
        }
    }
}
