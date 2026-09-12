import Testing
@testable import WhereHaveIBeen

struct StatFormatterTests {
    @Test func decimalsDependOnMagnitude() {
        #expect(StatFormatter.measure(30267.4) == "30,267")
        #expect(StatFormatter.measure(123.456) == "123")
        #expect(StatFormatter.measure(45.678) == "45.7")
        #expect(StatFormatter.measure(9.876) == "9.88")
        #expect(StatFormatter.measure(0) == "0.00")
    }

    @Test func drivingOnlyTilesAreImperialFirst() {
        let stats = StatBlock(distanceKm: 48709.3, areaKm2: 10274.6, maxAltM: 2668, maxVelKmh: 213.4)
        let tiles = StatFormatter.tiles(for: stats, variant: .mine(flightsIncluded: false))
        #expect(tiles.map(\.id) == ["distance", "area", "coverage", "altitude", "speed"])
        #expect(tiles[0].label == "Distance driven")
        #expect(tiles[0].value == "30,267")
        #expect(tiles[0].unit == "mi")
        #expect(tiles[0].secondary == "48,709 km · flights excluded")
        #expect(tiles[1].value == "3,967")
        #expect(tiles[1].secondary == "10,275 km²")
        #expect(tiles[2].value == "1.19")
        #expect(tiles[2].unit == "%")
        #expect(tiles[2].secondary == "3,967 of 333,371 mi² · WA + OR + CA")
        #expect(tiles[2].accent)
        #expect(tiles[3].value == "8,753")
        #expect(tiles[3].secondary == "2,668 m")
        #expect(tiles[4].value == "133")
        #expect(tiles[4].secondary == "213 km/h")
    }

    @Test func flightsCombineDistanceAndMaxima() {
        let stats = TrackStats(
            driving: StatBlock(distanceKm: 100, areaKm2: 10, maxAltM: 500, maxVelKmh: 120),
            flying: StatBlock(distanceKm: 1000, areaKm2: 5, maxAltM: 11000, maxVelKmh: 900))
        let combined = StatFormatter.combined(stats, flightsIncluded: true)
        #expect(combined == StatBlock(distanceKm: 1100, areaKm2: 15, maxAltM: 11000, maxVelKmh: 900))
        #expect(StatFormatter.combined(stats, flightsIncluded: false) == stats.driving)

        let tiles = StatFormatter.tiles(for: combined, variant: .mine(flightsIncluded: true))
        #expect(tiles[0].label == "Distance travelled")
        #expect(tiles[0].secondary.hasSuffix("flights included"))
        #expect(tiles[4].secondary == "900 km/h · on a flight")
    }

    @Test func everyoneVariantUsesServerWording() {
        let stats = StatBlock(distanceKm: 399290.5, areaKm2: 82470.2, maxAltM: 12100, maxVelKmh: 987)
        let tiles = StatFormatter.tiles(for: stats, variant: .everyone)
        #expect(tiles[0].label == "Combined distance")
        #expect(tiles[0].secondary.hasSuffix("everyone on this server"))
        #expect(tiles[3].secondary == "12,100 m · server record")
        #expect(tiles[4].secondary == "987 km/h · someone was flying")
    }

    @Test func speedNoteOnlyAboveFlightThreshold() {
        let slow = StatFormatter.tiles(for: StatBlock(distanceKm: 0, areaKm2: 0, maxAltM: 0, maxVelKmh: 321), variant: .mine(flightsIncluded: false))
        #expect(slow[4].secondary == "321 km/h")
        let fast = StatFormatter.tiles(for: StatBlock(distanceKm: 0, areaKm2: 0, maxAltM: 0, maxVelKmh: 322), variant: .mine(flightsIncluded: false))
        #expect(fast[4].secondary == "322 km/h · on a flight")
    }

    @Test func bufferShownInMiles() {
        #expect(StatFormatter.bufferMiles(500) == "0.31 mi")
        #expect(StatFormatter.bufferMiles(5000) == "3.11 mi")
    }
}
