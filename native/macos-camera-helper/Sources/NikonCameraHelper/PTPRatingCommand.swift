import Foundation

enum PTPRatingCommand {
    private static let commandContainer: UInt16 = 1
    private static let responseContainer: UInt16 = 3
    private static let responseOk: UInt16 = 0x2001
    private static let setObjectPropValue: UInt16 = 0x9804
    private static let objectPropRating: UInt32 = 0xdc8a

    static func setRatingCommand(objectHandle: UInt32, transactionId: UInt32) -> Data {
        var data = Data()
        data.appendLittleEndian(UInt32(20))
        data.appendLittleEndian(commandContainer)
        data.appendLittleEndian(setObjectPropValue)
        data.appendLittleEndian(transactionId)
        data.appendLittleEndian(objectHandle)
        data.appendLittleEndian(objectPropRating)
        return data
    }

    static func ratingPayload(_ rating: Int) -> Data {
        var data = Data()
        data.appendLittleEndian(UInt16(rating))
        return data
    }

    static func validateResponse(_ response: Data) throws {
        guard response.count >= 12 else {
            throw HelperError.message("Camera returned an invalid rating write-back response.")
        }

        let type = response.littleEndianUInt16(at: 4)
        let code = response.littleEndianUInt16(at: 6)

        guard type == responseContainer else {
            throw HelperError.message("Camera returned an invalid rating write-back response.")
        }

        guard code == responseOk else {
            throw HelperError.message(
                "Camera rejected rating write-back with PTP response 0x\(String(code, radix: 16))."
            )
        }
    }
}

private extension Data {
    mutating func appendLittleEndian(_ value: UInt16) {
        var littleEndian = value.littleEndian
        Swift.withUnsafeBytes(of: &littleEndian) { append(contentsOf: $0) }
    }

    mutating func appendLittleEndian(_ value: UInt32) {
        var littleEndian = value.littleEndian
        Swift.withUnsafeBytes(of: &littleEndian) { append(contentsOf: $0) }
    }

    func littleEndianUInt16(at offset: Int) -> UInt16 {
        precondition(count >= offset + 2)
        return UInt16(self[offset]) | (UInt16(self[offset + 1]) << 8)
    }
}
