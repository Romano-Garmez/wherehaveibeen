import Foundation

/// Typed GeoJSON geometry. Coordinates are `[lon, lat]` WGS84 as delivered by the API.
enum GeoJSONGeometry: Sendable, Equatable {
    case point([Double])
    case lineString([[Double]])
    case multiLineString([[[Double]]])
    case polygon([[[Double]]])
    case multiPolygon([[[[Double]]]])

    var typeName: String {
        switch self {
        case .point: "Point"
        case .lineString: "LineString"
        case .multiLineString: "MultiLineString"
        case .polygon: "Polygon"
        case .multiPolygon: "MultiPolygon"
        }
    }
}

extension GeoJSONGeometry: Codable {
    private enum CodingKeys: String, CodingKey {
        case type, coordinates
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)
        switch type {
        case "Point": self = .point(try container.decode([Double].self, forKey: .coordinates))
        case "LineString": self = .lineString(try container.decode([[Double]].self, forKey: .coordinates))
        case "MultiLineString": self = .multiLineString(try container.decode([[[Double]]].self, forKey: .coordinates))
        case "Polygon": self = .polygon(try container.decode([[[Double]]].self, forKey: .coordinates))
        case "MultiPolygon": self = .multiPolygon(try container.decode([[[[Double]]]].self, forKey: .coordinates))
        default:
            throw DecodingError.dataCorruptedError(
                forKey: .type, in: container, debugDescription: "Unsupported geometry type \(type)")
        }
    }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(typeName, forKey: .type)
        switch self {
        case .point(let c): try container.encode(c, forKey: .coordinates)
        case .lineString(let c): try container.encode(c, forKey: .coordinates)
        case .multiLineString(let c): try container.encode(c, forKey: .coordinates)
        case .polygon(let c): try container.encode(c, forKey: .coordinates)
        case .multiPolygon(let c): try container.encode(c, forKey: .coordinates)
        }
    }
}

struct GeoJSONFeature<Properties: Codable & Sendable & Equatable>: Codable, Sendable, Equatable {
    var properties: Properties
    var geometry: GeoJSONGeometry?

    private enum CodingKeys: String, CodingKey {
        case type, properties, geometry
    }

    init(properties: Properties, geometry: GeoJSONGeometry?) {
        self.properties = properties
        self.geometry = geometry
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        properties = try container.decode(Properties.self, forKey: .properties)
        geometry = try container.decodeIfPresent(GeoJSONGeometry.self, forKey: .geometry)
    }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode("Feature", forKey: .type)
        try container.encode(properties, forKey: .properties)
        try container.encode(geometry, forKey: .geometry)
    }
}

struct GeoJSONFeatureCollection<Properties: Codable & Sendable & Equatable>: Codable, Sendable, Equatable {
    var features: [GeoJSONFeature<Properties>]

    private enum CodingKeys: String, CodingKey {
        case type, features
    }

    init(features: [GeoJSONFeature<Properties>]) {
        self.features = features
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        features = try container.decode([GeoJSONFeature<Properties>].self, forKey: .features)
    }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode("FeatureCollection", forKey: .type)
        try container.encode(features, forKey: .features)
    }
}

struct EmptyProperties: Codable, Sendable, Equatable {
    init() {}
    init(from decoder: any Decoder) throws {}
    func encode(to encoder: any Encoder) throws {
        _ = encoder.container(keyedBy: NoKeys.self)
    }
    private enum NoKeys: CodingKey {}
}
