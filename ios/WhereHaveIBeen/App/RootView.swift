import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        Group {
            switch app.session {
            case .loading:
                ProgressView()
            case .signedOut:
                SignInView()
            case .signedIn:
                MainTabView()
            }
        }
        .task { await app.bootstrap() }
    }
}

struct MainTabView: View {
    @Environment(AppModel.self) private var app
    @State private var selection: AppTab?

    var body: some View {
        TabView(selection: Binding(get: { selection ?? app.initialTab }, set: { selection = $0 })) {
            Tab("Map", systemImage: "map", value: AppTab.map) { MapScreen() }
            Tab("Stats", systemImage: "chart.bar", value: AppTab.stats) { StatsScreen() }
            Tab("Everyone", systemImage: "globe.americas", value: AppTab.everyone) { EveryoneScreen() }
            Tab("Settings", systemImage: "slider.horizontal.3", value: AppTab.settings) { SettingsScreen() }
        }
    }
}
