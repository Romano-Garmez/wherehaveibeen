import MapKit
import UIKit

final class HeatmapOverlay: NSObject, MKOverlay, @unchecked Sendable {
    let grid: HeatGrid
    let coordinate: CLLocationCoordinate2D
    let boundingMapRect: MKMapRect

    init(grid: HeatGrid) {
        self.grid = grid
        self.boundingMapRect = grid.boundingRect.isNull ? .world : grid.boundingRect
        let mid = MKMapPoint(x: boundingMapRect.midX, y: boundingMapRect.midY)
        self.coordinate = mid.coordinate
    }
}

enum HeatStyle {
    static let fullRadiusPoints = 12.0
    static let minRadiusPoints = 4.0

    /// Full-size dots above zoom 12, shrinking towards zoom 4 so a whole region
    /// does not collapse into one red blob when zoomed far out.
    static func radiusPoints(zoomLevel: Double) -> Double {
        let t = min(max((zoomLevel - 4) / 8, 0), 1)
        return minRadiusPoints + (fullRadiusPoints - minRadiusPoints) * t
    }

    static func alpha(for t: Double) -> Double {
        0.25 + 0.6 * t
    }
}

final class HeatmapRenderer: MKOverlayRenderer {
    private let grid: HeatGrid

    init(overlay: HeatmapOverlay) {
        grid = overlay.grid
        super.init(overlay: overlay)
    }

    override func canDraw(_ mapRect: MKMapRect, zoomScale: MKZoomScale) -> Bool {
        !grid.isEmpty
    }

    override func draw(_ mapRect: MKMapRect, zoomScale: MKZoomScale, in context: CGContext) {
        let zoomLevel = MapZoom.level(for: zoomScale)
        let radiusPoints = HeatStyle.radiusPoints(zoomLevel: zoomLevel)
        let radius = radiusPoints / Double(zoomScale)
        let level = grid.level(for: zoomScale, minScreenSpan: radiusPoints / 2)
        let cells = level.cells(in: mapRect.insetBy(dx: -radius * 1.6, dy: -radius * 1.6))
        guard !cells.isEmpty else { return }

        // The context's origin is the overlay's bounding rect, not the map's, so
        // every centre goes through point(for:) rather than being drawn raw.
        context.setBlendMode(.normal)
        for cell in cells {
            let centre = point(for: MKMapPoint(x: cell.x, y: cell.y))
            let t = min(cell.intensity / level.maxIntensity, 1)
            let color = HeatPalette.color(at: t)
            let alpha = HeatStyle.alpha(for: t)
            context.setFillColor(red: color.red, green: color.green, blue: color.blue, alpha: alpha * 0.35)
            context.fillEllipse(in: CGRect(x: centre.x - radius * 1.6, y: centre.y - radius * 1.6, width: radius * 3.2, height: radius * 3.2))
            context.setFillColor(red: color.red, green: color.green, blue: color.blue, alpha: alpha)
            context.fillEllipse(in: CGRect(x: centre.x - radius, y: centre.y - radius, width: radius * 2, height: radius * 2))
        }
    }
}
