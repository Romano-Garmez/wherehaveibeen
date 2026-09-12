import Foundation
import Testing
@testable import WhereHaveIBeen

struct DateRangeTests {
    private let now = Date(timeIntervalSince1970: 1_789_000_000)
    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }

    @Test func presetsResolveRelativeToNowAndLeaveToOpen() {
        let week = DateRangeSelection.preset(.week).resolve(now: now, calendar: calendar)
        #expect(week.from == now.addingTimeInterval(-7 * 86400))
        #expect(week.to == nil)

        let month = DateRangeSelection.preset(.month).resolve(now: now, calendar: calendar)
        #expect(month.from == calendar.date(byAdding: .month, value: -1, to: now))

        let hours48 = DateRangeSelection.preset(.hours48).resolve(now: now, calendar: calendar)
        #expect(hours48.from == now.addingTimeInterval(-48 * 3600))

        let hours24 = DateRangeSelection.preset(.hours24).resolve(now: now, calendar: calendar)
        #expect(hours24.from == now.addingTimeInterval(-24 * 3600))

        let all = DateRangeSelection.preset(.all).resolve(now: now, calendar: calendar)
        #expect(all.from == nil && all.to == nil)
    }

    @Test func presetsMatchTheWebAppInOrder() {
        #expect(RangePreset.allCases.map(\.title) == ["All time", "Month", "Week", "48h", "24h"])
    }

    @Test func customSendsBothBounds() {
        let from = now.addingTimeInterval(-1000)
        let range = DateRangeSelection.custom(from: from, to: now).resolve(now: now, calendar: calendar)
        #expect(range.from == from)
        #expect(range.to == now)
    }

    @Test func cacheKeysUsePresetNamesNotTimestamps() {
        #expect(DateRangeSelection.preset(.week).cacheKey == "week")
        #expect(DateRangeSelection.preset(.all).cacheKey == "all")
        let custom = DateRangeSelection.custom(from: Date(timeIntervalSince1970: 100), to: Date(timeIntervalSince1970: 200))
        #expect(custom.cacheKey == "custom-100-200")
    }

    @Test func trackAndHeatmapKeysIncludeDeviceAndBuffer() {
        let track = TrackRequest(range: .preset(.month), device: "phone", bufferM: 800)
        #expect(CacheKey.track(track) == "track|month|phone|800")
        let allDevices = TrackRequest(range: .preset(.all), device: nil, bufferM: 500)
        #expect(CacheKey.track(allDevices) == "track|all|all|500")
        #expect(CacheKey.heatmap(HeatmapRequest(range: .preset(.hours48), device: nil)) == "heatmap|48h|all")
        #expect(CacheKey.track(track).hasPrefix(CacheKey.trackPrefix))
    }

    @Test func endpointQueryUsesISO8601AndOmitsUnsetParameters() throws {
        let from = Date(timeIntervalSince1970: 1_722_470_400)
        let query = TrackQuery(from: from, to: nil, device: nil, bufferM: 500, refresh: true)
        let url = Endpoint.track(query).url(baseURL: APIClient.productionBaseURL)
        let items = try #require(URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems)
        #expect(url.path() == "/api/me/track")
        #expect(items.map(\.name) == ["from", "buffer_m", "refresh"])
        #expect(items[0].value == "2024-08-01T00:00:00Z")
        #expect(items[2].value == "1")

        let bare = Endpoint.aggregateRoads(refresh: false).url(baseURL: APIClient.productionBaseURL)
        #expect(bare.absoluteString == "https://mini.romangarms.com/api/aggregate-roads")
    }
}
