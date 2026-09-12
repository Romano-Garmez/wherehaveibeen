import SwiftUI

struct MapScreen: View {
    @Environment(AppModel.self) private var app
    @State private var showConfigure = false

    private let cardHeight: CGFloat = 200

    var body: some View {
        @Bindable var model = app.mineMap
        ZStack(alignment: .top) {
            MapContainer(overlays: model.overlays, fitGeneration: model.fitGeneration, bottomInset: cardHeight)
                .ignoresSafeArea()
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    ModePill(selection: $model.configuration.mode)
                    Spacer()
                    GlassIconButton(systemImage: "arrow.clockwise", accessibilityLabel: "Refresh") {
                        model.reload(refresh: true)
                    }
                }
                if model.configuration.mode == .routes {
                    FlightsChip(isOn: $model.configuration.flightsShown)
                }
                StatusBanner(model: model)
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .animation(.default, value: model.phase)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            MapBottomCard(title: "My Roads", subtitle: subtitle(model)) {
                Button {
                    showConfigure = true
                } label: {
                    Label("Configure", systemImage: "slider.horizontal.3")
                        .font(.subheadline.weight(.semibold))
                }
                .buttonStyle(.bordered)
                .buttonBorderShape(.capsule)
            } content: {
                if model.statTiles.isEmpty {
                    Text(model.configuration.mode == .heatmap ? "Heatmap shows how often you've been somewhere." : "Stats appear once your routes load.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    StatTilesRow(tiles: Array(model.statTiles.prefix(3)))
                }
            }
        }
        .sheet(isPresented: $showConfigure) {
            ConfigureSheet(model: model, devices: app.devices)
                .presentationDetents([.medium, .large])
        }
        .onChange(of: model.configuration) { previous, _ in
            model.configurationChanged(from: previous)
        }
        .task {
            if !model.hasData, model.phase == .idle {
                model.reload()
            }
        }
    }

    private func subtitle(_ model: MapScreenModel) -> String {
        var parts = [model.configuration.range.title, model.configuration.device ?? "All devices"]
        if let freshness = model.freshnessText { parts.append(freshness) }
        return parts.joined(separator: " · ")
    }
}
