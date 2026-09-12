import MapKit
import SwiftUI

struct MapContainer: UIViewRepresentable {
    var overlays: MapOverlaySet
    var fitGeneration: Int
    var bottomInset: CGFloat

    func makeUIView(context: Context) -> MKMapView {
        let map = MKMapView()
        map.delegate = context.coordinator
        map.preferredConfiguration = MKStandardMapConfiguration(elevationStyle: .flat, emphasisStyle: .muted)
        map.showsCompass = false
        map.showsScale = false
        map.showsUserLocation = false
        return map
    }

    func updateUIView(_ map: MKMapView, context: Context) {
        let coordinator = context.coordinator
        if coordinator.overlaySetID != overlays.id {
            let stale = map.overlays
            map.addOverlays(overlays.all, level: .aboveRoads)
            map.removeOverlays(stale)
            coordinator.overlaySetID = overlays.id
        }
        if coordinator.fitGeneration != fitGeneration, let rect = overlays.fitRect {
            coordinator.fitGeneration = fitGeneration
            let padding = UIEdgeInsets(top: 140, left: 32, bottom: bottomInset + 32, right: 32)
            map.setVisibleMapRect(rect, edgePadding: padding, animated: false)
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    final class Coordinator: NSObject, MKMapViewDelegate {
        var overlaySetID: UUID?
        var fitGeneration = 0

        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            switch overlay {
            case let heat as HeatmapOverlay: HeatmapRenderer(overlay: heat)
            case is FlightBufferOverlay: FlightBufferRenderer(overlay: overlay)
            case is MKMultiPolygon: CoverageRenderer(overlay: overlay)
            case is MKPolyline: FlightLineRenderer(overlay: overlay)
            default: MKOverlayRenderer(overlay: overlay)
            }
        }
    }
}
