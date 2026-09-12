import SwiftUI

@main
struct WhereHaveIBeenApp: App {
    @State private var app = AppModel.fromLaunchArguments()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(app)
        }
    }
}
