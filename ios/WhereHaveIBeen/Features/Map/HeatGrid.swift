import Foundation
import MapKit

struct HeatCell: Sendable, Equatable {
    var x: Double
    var y: Double
    var intensity: Double
}

struct BucketKey: Hashable, Sendable {
    var bx: Int
    var by: Int
}

enum HeatPalette {
    static let stops: [(position: Double, red: Double, green: Double, blue: Double)] = [
        (0.0, 0, 0, 1),
        (0.3, 0, 1, 1),
        (0.5, 0, 1, 0),
        (0.7, 1, 1, 0),
        (1.0, 1, 0, 0),
    ]

    static func color(at t: Double) -> (red: Double, green: Double, blue: Double) {
        let t = min(max(t, 0), 1)
        var lower = stops[0]
        for stop in stops.dropFirst() {
            if t <= stop.position {
                let span = stop.position - lower.position
                let f = span > 0 ? (t - lower.position) / span : 0
                return (
                    lower.red + (stop.red - lower.red) * f,
                    lower.green + (stop.green - lower.green) * f,
                    lower.blue + (stop.blue - lower.blue) * f)
            }
            lower = stop
        }
        return (lower.red, lower.green, lower.blue)
    }

    static func intensity(count: Int) -> Double {
        log(Double(count) + 1)
    }

    /// Colour ceiling is a high percentile, not the max, so one freak cell does not
    /// wash out the rest of the map.
    static func ceiling(_ intensities: [Double], percentile: Double = 0.99) -> Double {
        guard !intensities.isEmpty else { return 1 }
        let sorted = intensities.sorted()
        let index = Int((percentile * Double(sorted.count - 1)).rounded(.down))
        return max(sorted[index], .leastNonzeroMagnitude)
    }
}

/// Cells at several coarseness levels, each bucketed by a coarse grid in map
/// points, so a tile draw touches only the cells it can see.
struct HeatGrid: Sendable {
    struct Level: Sendable {
        var cellSpan: Double
        var bucketSpan: Double
        var maxIntensity: Double
        var buckets: [BucketKey: [HeatCell]]
        var cellCount: Int

        func cells(in rect: MKMapRect) -> [HeatCell] {
            let bx0 = Int((rect.minX / bucketSpan).rounded(.down))
            let bx1 = Int((rect.maxX / bucketSpan).rounded(.down))
            let by0 = Int((rect.minY / bucketSpan).rounded(.down))
            let by1 = Int((rect.maxY / bucketSpan).rounded(.down))
            var result: [HeatCell] = []
            for bx in bx0...bx1 {
                for by in by0...by1 {
                    guard let bucket = buckets[BucketKey(bx: bx, by: by)] else { continue }
                    for cell in bucket where rect.contains(MKMapPoint(x: cell.x, y: cell.y)) {
                        result.append(cell)
                    }
                }
            }
            return result
        }
    }

    static let bucketCells = 64
    static let levelCount = 9

    let levels: [Level]
    let boundingRect: MKMapRect

    var isEmpty: Bool { levels.first?.cellCount == 0 }

    init(cells: [[Int]], cellDeg: Double) {
        var counts: [BucketKey: Int] = [:]
        counts.reserveCapacity(cells.count)
        for cell in cells where cell.count >= 3 {
            counts[BucketKey(bx: cell[0], by: cell[1]), default: 0] += cell[2]
        }

        var levels: [Level] = []
        var bounds = MKMapRect.null
        var current = counts
        for level in 0..<Self.levelCount {
            let scale = Double(1 << level)
            let cellSpan = cellDeg * scale * MKMapSize.world.width / 360
            let bucketSpan = cellSpan * Double(Self.bucketCells)
            var buckets: [BucketKey: [HeatCell]] = [:]
            var intensities: [Double] = []
            intensities.reserveCapacity(current.count)
            for (key, count) in current {
                let lon = (Double(key.bx) * scale + (scale - 1) / 2) * cellDeg
                let lat = (Double(key.by) * scale + (scale - 1) / 2) * cellDeg
                guard abs(lat) < 85, abs(lon) <= 180 else { continue }
                let point = MKMapPoint(CLLocationCoordinate2D(latitude: lat, longitude: lon))
                let intensity = HeatPalette.intensity(count: count)
                intensities.append(intensity)
                let bucket = BucketKey(
                    bx: Int((point.x / bucketSpan).rounded(.down)),
                    by: Int((point.y / bucketSpan).rounded(.down)))
                buckets[bucket, default: []].append(HeatCell(x: point.x, y: point.y, intensity: intensity))
                if level == 0 {
                    bounds = bounds.union(MKMapRect(origin: point, size: MKMapSize(width: 0, height: 0)))
                }
            }
            levels.append(Level(
                cellSpan: cellSpan, bucketSpan: bucketSpan,
                maxIntensity: HeatPalette.ceiling(intensities),
                buckets: buckets, cellCount: current.count))

            var coarser: [BucketKey: Int] = [:]
            for (key, count) in current {
                coarser[BucketKey(bx: key.bx >> 1, by: key.by >> 1), default: 0] += count
            }
            current = coarser
        }
        self.levels = levels
        self.boundingRect = bounds.isNull ? .null : bounds.insetBy(dx: -levels[0].cellSpan, dy: -levels[0].cellSpan)
    }

    /// Picks the coarsest level whose cells are still at least `minScreenSpan`
    /// points apart, so the per-tile draw count stays bounded when zoomed out.
    func level(for zoomScale: MKZoomScale, minScreenSpan: Double) -> Level {
        for level in levels where level.cellSpan * Double(zoomScale) >= minScreenSpan {
            return level
        }
        return levels[levels.count - 1]
    }
}
