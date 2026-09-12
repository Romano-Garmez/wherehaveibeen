import Foundation
import MapKit

final class CoverageOverlay: MKMultiPolygon {}
final class FlightBufferOverlay: MKMultiPolygon {}
final class FlightLineOverlay: MKPolyline {}

enum GeoJSONShapes {
    private struct FeatureWrapper: Encodable {
        let type = "Feature"
        let properties: [String: String] = [:]
        let geometry: GeoJSONGeometry
    }

    static func shapes(from geometry: GeoJSONGeometry) throws -> [MKShape & MKGeoJSONObject] {
        let data = try JSONEncoder().encode(FeatureWrapper(geometry: geometry))
        return try MKGeoJSONDecoder().decode(data)
            .compactMap { $0 as? MKGeoJSONFeature }
            .flatMap(\.geometry)
    }

    static func polygons(from geometry: GeoJSONGeometry?) -> [MKPolygon] {
        guard let geometry, let shapes = try? shapes(from: geometry) else { return [] }
        var polygons: [MKPolygon] = []
        for shape in shapes {
            if let polygon = shape as? MKPolygon {
                polygons.append(polygon)
            } else if let multi = shape as? MKMultiPolygon {
                polygons.append(contentsOf: multi.polygons)
            }
        }
        return polygons
    }

    static func coverage(from geometry: GeoJSONGeometry?) -> CoverageOverlay? {
        let polygons = polygons(from: geometry)
        return polygons.isEmpty ? nil : CoverageOverlay(polygons)
    }

    static func flightBuffer(from geometry: GeoJSONGeometry?) -> FlightBufferOverlay? {
        let polygons = polygons(from: geometry)
        return polygons.isEmpty ? nil : FlightBufferOverlay(polygons)
    }

    static func flightLine(from geometry: GeoJSONGeometry?) -> FlightLineOverlay? {
        guard let geometry, let shapes = try? shapes(from: geometry) else { return nil }
        for shape in shapes {
            if let line = shape as? MKPolyline {
                return FlightLineOverlay(points: line.points(), count: line.pointCount)
            }
            if let multi = shape as? MKMultiPolyline, let first = multi.polylines.first {
                return FlightLineOverlay(points: first.points(), count: first.pointCount)
            }
        }
        return nil
    }
}
