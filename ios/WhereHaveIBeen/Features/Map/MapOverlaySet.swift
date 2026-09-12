import Foundation
import MapKit

/// Everything on the map for one data state. Replaced as a unit so the map never
/// shows a half-updated mix of old and new overlays.
@MainActor
struct MapOverlaySet {
    let id = UUID()
    var coverage: CoverageOverlay?
    var flightBuffer: FlightBufferOverlay?
    var flightLines: [FlightLineOverlay] = []
    var heatmap: HeatmapOverlay?

    static let empty = MapOverlaySet()

    var all: [MKOverlay] {
        var overlays: [MKOverlay] = []
        if let coverage { overlays.append(coverage) }
        if let flightBuffer { overlays.append(flightBuffer) }
        overlays.append(contentsOf: flightLines)
        if let heatmap { overlays.append(heatmap) }
        return overlays
    }

    var isEmpty: Bool { all.isEmpty }

    /// Flight buffers never drive the viewport: fitting to a cross-country flight
    /// would zoom out until the coverage corridor vanished.
    var fitRect: MKMapRect? {
        var rect = MKMapRect.null
        if let coverage { rect = rect.union(coverage.boundingMapRect) }
        if let heatmap { rect = rect.union(heatmap.boundingMapRect) }
        if rect.isNull, let flightBuffer { rect = flightBuffer.boundingMapRect }
        return rect.isNull ? nil : rect
    }
}
