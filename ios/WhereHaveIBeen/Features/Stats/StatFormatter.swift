import Foundation

enum StatVariant: Equatable, Sendable {
    case mine(flightsIncluded: Bool)
    case everyone
}

struct StatTile: Identifiable, Equatable, Sendable {
    var id: String
    var label: String
    var shortLabel: String
    var value: String
    var unit: String
    var secondary: String
    var accent = false
    var barFraction: Double?
}

/// Inputs stay metric (the API reports km, km², m, km/h); display is imperial
/// first with the metric value underneath, matching the web app's statsPanel.js.
enum StatFormatter {
    static let kmPerMile = 1.609344
    static let sqKmPerSqMile = 2.589988
    static let feetPerMetre = 3.28084
    /// Combined land area of Washington, Oregon, and California.
    static let westCoastKm2 = 863_428.0
    static let flightThresholdKmh = 200 * kmPerMile

    private static let locale = Locale(identifier: "en_US")

    static func number(_ value: Double, decimals: Int) -> String {
        value.formatted(.number.precision(.fractionLength(decimals)).locale(locale))
    }

    static func measure(_ value: Double) -> String {
        let magnitude = abs(value)
        let decimals = magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : 2
        return number(value, decimals: decimals)
    }

    static func combined(_ stats: TrackStats, flightsIncluded: Bool) -> StatBlock {
        guard flightsIncluded else { return stats.driving }
        return StatBlock(
            distanceKm: stats.driving.distanceKm + stats.flying.distanceKm,
            areaKm2: stats.driving.areaKm2 + stats.flying.areaKm2,
            maxAltM: max(stats.driving.maxAltM, stats.flying.maxAltM),
            maxVelKmh: max(stats.driving.maxVelKmh, stats.flying.maxVelKmh))
    }

    static func distanceLabel(_ variant: StatVariant) -> String {
        switch variant {
        case .mine(let flightsIncluded): flightsIncluded ? "Distance travelled" : "Distance driven"
        case .everyone: "Combined distance"
        }
    }

    static func tiles(for stats: StatBlock, variant: StatVariant) -> [StatTile] {
        let distanceNote: String
        switch variant {
        case .mine(let flightsIncluded): distanceNote = flightsIncluded ? "flights included" : "flights excluded"
        case .everyone: distanceNote = "everyone on this server"
        }
        let coveragePct = stats.areaKm2 / westCoastKm2 * 100
        let westCoastMi2 = number((westCoastKm2 / sqKmPerSqMile).rounded(), decimals: 0)
        let altitudeNote = variant == .everyone ? " · server record" : ""
        var speedNote = ""
        if stats.maxVelKmh > flightThresholdKmh {
            speedNote = variant == .everyone ? " · someone was flying" : " · on a flight"
        }
        return [
            StatTile(
                id: "distance", label: distanceLabel(variant), shortLabel: "Distance",
                value: measure(stats.distanceKm / kmPerMile), unit: "mi",
                secondary: "\(measure(stats.distanceKm)) km · \(distanceNote)"),
            StatTile(
                id: "area", label: "Area explored", shortLabel: "Area",
                value: measure(stats.areaKm2 / sqKmPerSqMile), unit: "mi²",
                secondary: "\(measure(stats.areaKm2)) km²"),
            StatTile(
                id: "coverage", label: "West coast covered", shortLabel: "West coast",
                value: number(coveragePct, decimals: 2), unit: "%",
                secondary: "\(measure(stats.areaKm2 / sqKmPerSqMile)) of \(westCoastMi2) mi² · WA + OR + CA",
                accent: true, barFraction: min(max(coveragePct / 100, 0), 1)),
            StatTile(
                id: "altitude", label: "Highest altitude", shortLabel: "Altitude",
                value: number((stats.maxAltM * feetPerMetre).rounded(), decimals: 0), unit: "ft",
                secondary: "\(number(stats.maxAltM.rounded(), decimals: 0)) m\(altitudeNote)"),
            StatTile(
                id: "speed", label: "Top speed", shortLabel: "Top speed",
                value: number((stats.maxVelKmh / kmPerMile).rounded(), decimals: 0), unit: "mph",
                secondary: "\(number(stats.maxVelKmh.rounded(), decimals: 0)) km/h\(speedNote)"),
        ]
    }

    static func bufferMiles(_ metres: Int) -> String {
        number(Double(metres) / 1000 / kmPerMile, decimals: 2) + " mi"
    }

    static func bytes(_ count: Int64) -> String {
        ByteCountFormatter.string(fromByteCount: count, countStyle: .file)
    }
}
