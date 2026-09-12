import Foundation
import Testing
@testable import WhereHaveIBeen

actor ScriptedAPIClient: APIClientProtocol {
    var trackOutcomes: [FetchOutcome<TrackResponse>]
    private(set) var trackQueries: [TrackQuery] = []

    init(trackOutcomes: [FetchOutcome<TrackResponse>]) {
        self.trackOutcomes = trackOutcomes
    }

    func devices(credentials: Credentials) async throws -> DevicesResponse {
        DevicesResponse(username: credentials.username, devices: [])
    }

    func track(_ query: TrackQuery, credentials: Credentials) async throws -> FetchOutcome<TrackResponse> {
        trackQueries.append(query)
        guard !trackOutcomes.isEmpty else { throw APIError.unexpectedStatus(500) }
        return trackOutcomes.removeFirst()
    }

    func heatmap(_ query: HeatmapQuery, credentials: Credentials) async throws -> FetchOutcome<HeatmapResponse> {
        throw APIError.unexpectedStatus(500)
    }

    func aggregateRoads(refresh: Bool, credentials: Credentials) async throws -> FetchOutcome<AggregateFeature> {
        throw APIError.unexpectedStatus(500)
    }
}

struct TrackStoreTests {
    private func temporaryCache() -> DiskCache {
        DiskCache(directory: FileManager.default.temporaryDirectory.appending(path: "whib-tests-\(UUID().uuidString)"))
    }

    @Test func pollsWhileComputingAndCachesTheResult() async throws {
        let track = try Fixtures.decode(TrackResponse.self, named: "track")
        let api = ScriptedAPIClient(trackOutcomes: [.computing(retryAfter: 0.01), .computing(retryAfter: 0.01), .ready(track)])
        let cache = temporaryCache()
        let store = TrackStore(api: api, credentials: InMemoryCredentialStore(Credentials(username: "u", password: "p")), cache: cache)
        let request = TrackRequest(range: .preset(.all), device: nil, bufferM: 500)

        #expect(await store.cachedTrack(request) == nil)
        var events: [String] = []
        for try await event in await store.loadTrack(request, refresh: true) {
            switch event {
            case .computing: events.append("computing")
            case .ready(let entry):
                events.append("ready")
                #expect(entry.value == track)
            }
        }
        #expect(events == ["computing", "computing", "ready"])

        let queries = await api.trackQueries
        #expect(queries.map(\.refresh) == [true, false, false])
        #expect(queries.allSatisfy { $0.from == nil && $0.to == nil && $0.bufferM == 500 })

        let cached = try #require(await store.cachedTrack(request))
        #expect(cached.value == track)
        #expect(await store.cacheSize() > 0)
        await cache.clear()
    }

    @Test func givesUpAfterPollTimeout() async {
        let api = ScriptedAPIClient(trackOutcomes: Array(repeating: .computing(retryAfter: 0.01), count: 50))
        let store = TrackStore(
            api: api, credentials: InMemoryCredentialStore(Credentials(username: "u", password: "p")),
            cache: temporaryCache(), pollTimeout: .milliseconds(30))
        let request = TrackRequest(range: .preset(.week), device: "phone", bufferM: 500)
        await #expect(throws: APIError.timedOut) {
            for try await _ in await store.loadTrack(request, refresh: false) {}
        }
    }

    @Test func missingCredentialsFailFast() async {
        let store = TrackStore(api: ScriptedAPIClient(trackOutcomes: []), credentials: InMemoryCredentialStore(), cache: temporaryCache())
        await #expect(throws: APIError.noCredentials) {
            for try await _ in await store.loadEveryone(refresh: false) {}
        }
    }

    @Test func invalidateTracksLeavesHeatmapAlone() async throws {
        let cache = temporaryCache()
        let track = try Fixtures.decode(TrackResponse.self, named: "track")
        let heatmap = try Fixtures.decode(HeatmapResponse.self, named: "heatmap")
        let trackRequest = TrackRequest(range: .preset(.all), device: nil, bufferM: 500)
        let heatRequest = HeatmapRequest(range: .preset(.all), device: nil)
        try await cache.write(CacheEntry(value: track, storedAt: .now), key: CacheKey.track(trackRequest))
        try await cache.write(CacheEntry(value: heatmap, storedAt: .now), key: CacheKey.heatmap(heatRequest))

        let store = TrackStore(api: ScriptedAPIClient(trackOutcomes: []), credentials: InMemoryCredentialStore(), cache: cache)
        await store.invalidateTracks()
        #expect(await store.cachedTrack(trackRequest) == nil)
        #expect(await store.cachedHeatmap(heatRequest) != nil)
        await store.clearAll()
        #expect(await store.cachedHeatmap(heatRequest) == nil)
    }

    @Test func fileNamesAreSafe() {
        #expect(DiskCache.fileName(for: "track|all|all|500") == "track_all_all_500")
        #expect(DiskCache.fileName(for: "heatmap|custom-1-2|my phone") == "heatmap_custom-1-2_my_phone")
    }
}
