import SwiftUI

struct StatsScreen: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        let model = app.mineMap
        let tiles = Dictionary(uniqueKeysWithValues: model.statTiles.map { ($0.id, $0) })
        NavigationStack {
            List {
                Section {
                    Text(scopeLine(model))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets(top: 0, leading: 20, bottom: 4, trailing: 20))
                }
                if let distance = tiles["distance"] {
                    Section {
                        StatTileView(tile: distance, compact: false)
                            .padding(.vertical, 6)
                    }
                }
                if let coverage = tiles["coverage"] {
                    Section {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack(alignment: .firstTextBaseline) {
                                Text(coverage.label)
                                    .font(.footnote.weight(.semibold))
                                    .foregroundStyle(.secondary)
                                Spacer()
                                HStack(alignment: .firstTextBaseline, spacing: 1) {
                                    Text(coverage.value)
                                        .font(.title2.weight(.bold))
                                        .foregroundStyle(Color.accentColor)
                                    Text(coverage.unit)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(.secondary)
                                }
                            }
                            CoverageBar(fraction: coverage.barFraction ?? 0)
                            Text(coverage.secondary)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 6)
                    }
                }
                if model.stats != nil {
                    Section("Records") {
                        ForEach(["area", "altitude", "speed"], id: \.self) { id in
                            let tile = tiles[id]!
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(tile.label)
                                    Text(tile.secondary)
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text("\(tile.value) \(tile.unit)")
                                    .font(.body.weight(.semibold))
                            }
                        }
                    }
                } else {
                    Section {
                        ContentUnavailableView(
                            "No stats yet",
                            systemImage: "chart.bar",
                            description: Text(model.phase == .idle ? "Nothing loaded yet. Pull the Map tab to refresh." : "Loading your routes…"))
                    }
                }
            }
            .navigationTitle("Stats")
            .task {
                if !model.hasData, model.phase == .idle {
                    model.reload()
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Text(model.configuration.range.title)
                        .foregroundStyle(Color.accentColor)
                }
            }
        }
    }

    private func scopeLine(_ model: MapScreenModel) -> String {
        let device = model.configuration.device ?? "All devices"
        let flights = model.configuration.flightsShown ? "flights included" : "flights excluded"
        return "\(model.configuration.range.title) · \(device) · \(flights)"
    }
}
