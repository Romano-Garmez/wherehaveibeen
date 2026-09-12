import MapKit
import UIKit

extension UIColor {
    static let explored = UIColor(red: 0x3D / 255, green: 0x6B / 255, blue: 0xA8 / 255, alpha: 1)
    static let flightBuffer = UIColor(red: 0xE6 / 255, green: 0xA2 / 255, blue: 0x3C / 255, alpha: 1)
    static let flightLine = UIColor(red: 0xC9 / 255, green: 0x84 / 255, blue: 0x18 / 255, alpha: 1)
}

enum MapZoom {
    /// MapKit's zoom scale is screen points per map point; the world is 256 pt wide
    /// at zoom level 0 and 2^28 map points wide, so level 20 is scale 1.
    static func level(for zoomScale: MKZoomScale) -> Double {
        20 + log2(Double(zoomScale))
    }
}

/// A 500 m corridor is sub-pixel below zoom 9, so the outline thickens and the
/// fill darkens as the map zooms out, mirroring the web app.
struct CoverageStyle: Equatable {
    var strokeWidth: CGFloat
    var strokeAlpha: CGFloat
    var fillAlpha: CGFloat

    static func at(zoomLevel: Double) -> CoverageStyle {
        let boost = max(0, 9 - zoomLevel)
        return CoverageStyle(
            strokeWidth: 1 + boost * 0.9,
            strokeAlpha: min(0.75, 0.55 + boost * 0.04),
            fillAlpha: min(0.5, 0.38 + boost * 0.025))
    }

    static func flightLineWidth(zoomLevel: Double) -> CGFloat {
        2.4 + max(0, 9 - zoomLevel) * 0.5
    }
}

final class CoverageRenderer: MKMultiPolygonRenderer {
    override init(overlay: any MKOverlay) {
        super.init(overlay: overlay)
        fillColor = .explored
        strokeColor = .explored
        lineWidth = 1
        lineJoin = .round
    }

    override func applyFillProperties(to context: CGContext, atZoomScale zoomScale: MKZoomScale) {
        let style = CoverageStyle.at(zoomLevel: MapZoom.level(for: zoomScale))
        context.setFillColor(UIColor.explored.withAlphaComponent(style.fillAlpha).cgColor)
    }

    override func applyStrokeProperties(to context: CGContext, atZoomScale zoomScale: MKZoomScale) {
        let style = CoverageStyle.at(zoomLevel: MapZoom.level(for: zoomScale))
        context.setStrokeColor(UIColor.explored.withAlphaComponent(style.strokeAlpha).cgColor)
        context.setLineWidth(style.strokeWidth / zoomScale)
        context.setLineJoin(.round)
        context.setLineCap(.round)
    }
}

final class FlightBufferRenderer: MKMultiPolygonRenderer {
    override init(overlay: any MKOverlay) {
        super.init(overlay: overlay)
        fillColor = .flightBuffer.withAlphaComponent(0.22)
        strokeColor = nil
    }
}

final class FlightLineRenderer: MKPolylineRenderer {
    override init(overlay: any MKOverlay) {
        super.init(overlay: overlay)
        strokeColor = .flightLine.withAlphaComponent(0.8)
        lineWidth = 2.4
        lineDashPattern = [10, 8]
        lineCap = .round
    }

    override func applyStrokeProperties(to context: CGContext, atZoomScale zoomScale: MKZoomScale) {
        super.applyStrokeProperties(to: context, atZoomScale: zoomScale)
        let width = CoverageStyle.flightLineWidth(zoomLevel: MapZoom.level(for: zoomScale))
        context.setLineWidth(width / zoomScale)
        context.setLineDash(phase: 0, lengths: [10 / zoomScale, 8 / zoomScale])
    }
}
