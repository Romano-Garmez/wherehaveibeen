import SwiftUI

struct StatTileView: View {
    var tile: StatTile
    var compact = true

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(compact ? tile.shortLabel : tile.label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .lineLimit(1)
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(tile.value)
                    .font(.system(size: compact ? 22 : 40, weight: .bold))
                    .foregroundStyle(tile.accent ? Color.accentColor : .primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                Text(tile.unit)
                    .font(compact ? .footnote.weight(.semibold) : .title3.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            Text(tile.secondary)
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct StatTilesRow: View {
    var tiles: [StatTile]

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            ForEach(Array(tiles.enumerated()), id: \.element.id) { index, tile in
                if index > 0 { Divider() }
                StatTileView(tile: tile)
            }
        }
        .fixedSize(horizontal: false, vertical: true)
    }
}

struct CoverageBar: View {
    var fraction: Double

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.secondary.opacity(0.16))
                Capsule().fill(Color.accentColor)
                    .frame(width: max(8, proxy.size.width * min(max(fraction, 0), 1)))
            }
        }
        .frame(height: 8)
    }
}
