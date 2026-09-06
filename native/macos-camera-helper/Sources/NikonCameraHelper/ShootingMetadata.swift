import Foundation

struct ShootingMetadata: Equatable {
    let aperture: String?
    let exposureCompensation: String?
    let focalLength: String?
    let iso: Int?
    let shutterSpeed: String?

    static func from(_ metadata: [AnyHashable: Any]?) -> ShootingMetadata {
        let exif = nestedDictionary(named: "{Exif}", in: metadata) ?? metadata
        let aperture = numberValue(for: "FNumber", in: exif).map { "f/\(formatDecimal($0))" }
        let focalLength = numberValue(for: "FocalLength", in: exif).map { "\(formatDecimal($0)) mm" }
        let iso = isoValue(in: exif)
        let shutterSpeed = numberValue(for: "ExposureTime", in: exif).map(formatExposureTime)
        let exposureCompensation = numberValue(for: "ExposureBiasValue", in: exif).map {
            "\(formatSignedDecimal($0)) EV"
        }

        return ShootingMetadata(
            aperture: aperture,
            exposureCompensation: exposureCompensation,
            focalLength: focalLength,
            iso: iso,
            shutterSpeed: shutterSpeed
        )
    }

    private static func nestedDictionary(
        named name: String,
        in metadata: [AnyHashable: Any]?
    ) -> [AnyHashable: Any]? {
        metadata?[name] as? [AnyHashable: Any]
    }

    private static func isoValue(in metadata: [AnyHashable: Any]?) -> Int? {
        if let ratings = metadata?["ISOSpeedRatings"] as? [Any],
           let first = ratings.first {
            return intValue(first)
        }
        return intValue(metadata?["ISOSpeedRatings"] ?? metadata?["PhotographicSensitivity"])
    }

    private static func numberValue(for key: String, in metadata: [AnyHashable: Any]?) -> Double? {
        guard let value = metadata?[key] else {
            return nil
        }

        if let number = value as? NSNumber {
            return number.doubleValue
        }
        if let text = value as? String {
            return Double(text)
        }
        return nil
    }

    private static func intValue(_ value: Any?) -> Int? {
        if let number = value as? NSNumber {
            return number.intValue
        }
        if let text = value as? String {
            return Int(text)
        }
        return nil
    }

    private static func formatDecimal(_ value: Double) -> String {
        if value.rounded() == value {
            return String(Int(value))
        }
        return String(format: "%.1f", value).replacingOccurrences(of: ".0", with: "")
    }

    private static func formatSignedDecimal(_ value: Double) -> String {
        if value == 0 {
            return "0"
        }
        let prefix = value > 0 ? "+" : ""
        return "\(prefix)\(formatDecimal(value))"
    }

    private static func formatExposureTime(_ seconds: Double) -> String {
        guard seconds > 0 else {
            return ""
        }
        if seconds < 1 {
            return "1/\(Int((1 / seconds).rounded()))"
        }
        return "\(formatDecimal(seconds))s"
    }
}
