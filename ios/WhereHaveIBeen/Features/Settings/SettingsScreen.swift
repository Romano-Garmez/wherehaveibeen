import SwiftUI

struct SettingsScreen: View {
    @Environment(AppModel.self) private var app
    @State private var confirmSignOut = false
    @AppStorage(DeveloperSettings.useLocalAPIKey) private var useLocalAPI = false

    var body: some View {
        @Bindable var mineMap = app.mineMap
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 12) {
                        Text(initials)
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(.white)
                            .frame(width: 52, height: 52)
                            .background(Color.accentColor, in: .circle)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(app.username ?? "").font(.title3.weight(.semibold))
                            Text(APIClient.productionBaseURL.host() ?? "")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                    if !app.devices.isEmpty {
                        LabeledContent("Devices", value: app.devices.joined(separator: ", "))
                    }
                }

                Section("Map") {
                    BufferStepper(bufferM: $mineMap.configuration.bufferM)
                }

                Section("Cache") {
                    LabeledContent("Storage", value: StatFormatter.bytes(app.cacheSize))
                    Button("Clear cache") {
                        Task { await app.clearCache() }
                    }
                }

                Section("About") {
                    LabeledContent("Version", value: Self.version)
                    Link("Open the web app", destination: AppModel.webAppURL)
                }

                #if DEBUG
                Section {
                    Toggle("Use local API (localhost:5002)", isOn: $useLocalAPI)
                } header: {
                    Text("Developer")
                } footer: {
                    Text(app.isMock ? "Running against the mock client." : "Takes effect on the next request.")
                }
                #endif

                Section {
                    Button("Sign out", role: .destructive) { confirmSignOut = true }
                        .frame(maxWidth: .infinity)
                }
            }
            .navigationTitle("Settings")
            .confirmationDialog("Sign out?", isPresented: $confirmSignOut, titleVisibility: .visible) {
                Button("Sign out", role: .destructive) {
                    Task { await app.signOut() }
                }
            } message: {
                Text("This removes your saved credentials and cached maps from this phone.")
            }
            .task { await app.refreshCacheSize() }
            .onChange(of: mineMap.configuration) { previous, _ in
                mineMap.configurationChanged(from: previous)
            }
        }
    }

    private var initials: String {
        String((app.username ?? "?").prefix(2)).uppercased()
    }

    private static var version: String {
        let short = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?"
        return "\(short) (\(build))"
    }
}
