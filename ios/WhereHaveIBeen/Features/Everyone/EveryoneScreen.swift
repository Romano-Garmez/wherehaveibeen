import SwiftUI

struct EveryoneScreen: View {
    @Environment(AppModel.self) private var app

    private let cardHeight: CGFloat = 230

    var body: some View {
        let model = app.everyoneMap
        ZStack(alignment: .top) {
            MapContainer(overlays: model.overlays, fitGeneration: model.fitGeneration, bottomInset: cardHeight)
                .ignoresSafeArea()
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Spacer()
                    GlassIconButton(systemImage: "arrow.clockwise", accessibilityLabel: "Refresh") {
                        model.reload(refresh: true)
                    }
                }
                StatusBanner(model: model)
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .animation(.default, value: model.phase)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            MapBottomCard(title: "Everyone's Roads", subtitle: subtitle(model)) {
                EmptyView()
            } content: {
                VStack(spacing: 12) {
                    if let share = shareOfShape(model) {
                        VStack(spacing: 8) {
                            HStack {
                                Text("Your share of this shape").font(.subheadline.weight(.semibold))
                                Spacer()
                                Text(StatFormatter.number(share * 100, decimals: 0) + "%")
                                    .font(.body.weight(.bold))
                                    .foregroundStyle(Color.accentColor)
                            }
                            CoverageBar(fraction: share)
                        }
                        .padding(12)
                        .background(Color(uiColor: .secondarySystemBackground), in: .rect(cornerRadius: 12))
                    }
                    if model.statTiles.isEmpty {
                        Text("Stats appear once the shared map loads.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                        StatTilesRow(tiles: Array(model.statTiles.prefix(2)))
                    }
                }
            }
        }
        .task {
            if !model.hasData, model.phase == .idle {
                model.reload()
            }
        }
    }

    private func subtitle(_ model: MapScreenModel) -> String {
        var parts = ["All time", "everyone on this server"]
        if let freshness = model.freshnessText { parts.append(freshness) }
        return parts.joined(separator: " · ")
    }

    private func shareOfShape(_ model: MapScreenModel) -> Double? {
        guard let everyone = model.stats?.areaKm2, everyone > 0,
              let mine = app.mineMap.track?.value.stats.driving.areaKm2 else { return nil }
        return min(max(mine / everyone, 0), 1)
    }
}
