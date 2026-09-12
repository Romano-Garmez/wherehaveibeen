import Foundation

struct TrackQuery: Sendable, Hashable {
    var from: Date?
    var to: Date?
    var device: String?
    var bufferM: Int
    var refresh = false
}

struct HeatmapQuery: Sendable, Hashable {
    var from: Date?
    var to: Date?
    var device: String?
    var refresh = false
}

enum Endpoint: Sendable, Hashable {
    case devices
    case track(TrackQuery)
    case heatmap(HeatmapQuery)
    case aggregateRoads(refresh: Bool)

    var path: String {
        switch self {
        case .devices: "/api/me/devices"
        case .track: "/api/me/track"
        case .heatmap: "/api/me/heatmap"
        case .aggregateRoads: "/api/aggregate-roads"
        }
    }

    var queryItems: [URLQueryItem] {
        var items: [URLQueryItem] = []
        func add(_ name: String, _ value: String?) {
            if let value { items.append(URLQueryItem(name: name, value: value)) }
        }
        switch self {
        case .devices:
            break
        case .track(let q):
            add("from", q.from.map(Self.format))
            add("to", q.to.map(Self.format))
            add("device", q.device)
            add("buffer_m", String(q.bufferM))
            add("refresh", q.refresh ? "1" : nil)
        case .heatmap(let q):
            add("from", q.from.map(Self.format))
            add("to", q.to.map(Self.format))
            add("device", q.device)
            add("refresh", q.refresh ? "1" : nil)
        case .aggregateRoads(let refresh):
            add("refresh", refresh ? "1" : nil)
        }
        return items
    }

    func url(baseURL: URL) -> URL {
        var components = URLComponents(url: baseURL.appending(path: path), resolvingAgainstBaseURL: false)!
        let items = queryItems
        components.queryItems = items.isEmpty ? nil : items
        return components.url!
    }

    static func format(_ date: Date) -> String {
        date.formatted(.iso8601)
    }
}
