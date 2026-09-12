import Foundation
import Observation

enum AppTab: String, CaseIterable {
    case map, stats, everyone, settings
}

enum DeveloperSettings {
    static let useLocalAPIKey = "useLocalAPI"
    static let localBaseURL = URL(string: "http://localhost:5002")!

    static var baseURL: URL {
        #if DEBUG
        if UserDefaults.standard.bool(forKey: useLocalAPIKey) { return localBaseURL }
        #endif
        return APIClient.productionBaseURL
    }
}

@MainActor
@Observable
final class AppModel {
    enum Session: Equatable {
        case loading
        case signedOut
        case signedIn(username: String)
    }

    static let webAppURL = URL(string: "https://tracker.romangarms.com")!

    private(set) var session: Session = .loading
    private(set) var devices: [String] = []
    private(set) var cacheSize: Int64 = 0

    let api: any APIClientProtocol
    let credentials: any CredentialStore
    let store: TrackStore
    let mineMap: MapScreenModel
    let everyoneMap: MapScreenModel
    let isMock: Bool
    let initialTab: AppTab

    init(api: any APIClientProtocol, credentials: any CredentialStore, store: TrackStore, isMock: Bool, initialTab: AppTab = .map, defaults: UserDefaults = .standard) {
        self.api = api
        self.credentials = credentials
        self.store = store
        self.isMock = isMock
        self.initialTab = initialTab
        mineMap = MapScreenModel(scope: .mine, store: store, defaults: defaults)
        everyoneMap = MapScreenModel(scope: .everyone, store: store, defaults: defaults)
    }

    /// `--mock-api` serves the bundled fixtures; `--mock-signed-in` skips the form.
    /// `--tab <name>`, `--mode <routes|heatmap>` and `--flights` pick the first
    /// screen so screenshots can be scripted without tapping through the UI.
    static func fromLaunchArguments(_ arguments: [String] = ProcessInfo.processInfo.arguments) -> AppModel {
        func value(after flag: String) -> String? {
            guard let index = arguments.firstIndex(of: flag), index + 1 < arguments.count else { return nil }
            return arguments[index + 1]
        }
        let initialTab = value(after: "--tab").flatMap(AppTab.init(rawValue:)) ?? .map
        if arguments.contains("--mock-api") {
            let seeded = arguments.contains("--mock-signed-in") ? Credentials(username: "roman", password: "demo") : nil
            let credentials = InMemoryCredentialStore(seeded)
            let api = MockAPIClient()
            let cache = DiskCache(directory: FileManager.default.temporaryDirectory.appending(path: "mock-cache"))
            let store = TrackStore(api: api, credentials: credentials, cache: cache)
            let defaults = UserDefaults(suiteName: "mock") ?? .standard
            defaults.removePersistentDomain(forName: "mock")
            let model = AppModel(api: api, credentials: credentials, store: store, isMock: true, initialTab: initialTab, defaults: defaults)
            if let mode = value(after: "--mode").flatMap(MapMode.init(rawValue:)) {
                model.mineMap.configuration.mode = mode
            }
            model.mineMap.configuration.flightsShown = arguments.contains("--flights")
            return model
        }
        let credentials = KeychainCredentialStore()
        let api = APIClient(baseURL: { DeveloperSettings.baseURL })
        let store = TrackStore(api: api, credentials: credentials, cache: DiskCache())
        return AppModel(api: api, credentials: credentials, store: store, isMock: false, initialTab: initialTab)
    }

    var username: String? {
        if case .signedIn(let username) = session { return username }
        return nil
    }

    func bootstrap() async {
        guard let stored = try? await credentials.load() else {
            session = .signedOut
            return
        }
        do {
            let response = try await api.devices(credentials: stored)
            devices = response.devices
            session = .signedIn(username: response.username)
        } catch APIError.unauthorized, APIError.forbidden {
            try? await credentials.clear()
            session = .signedOut
        } catch {
            // Offline or server down: stay signed in and show whatever is cached.
            session = .signedIn(username: stored.username)
        }
    }

    func signIn(username: String, password: String) async throws {
        let candidate = Credentials(username: username.trimmingCharacters(in: .whitespaces), password: password)
        let response = try await api.devices(credentials: candidate)
        try await credentials.save(candidate)
        devices = response.devices
        session = .signedIn(username: response.username)
    }

    func signOut() async {
        try? await credentials.clear()
        await store.clearAll()
        mineMap.reset()
        everyoneMap.reset()
        devices = []
        cacheSize = 0
        session = .signedOut
    }

    func clearCache() async {
        await store.clearAll()
        mineMap.reset()
        everyoneMap.reset()
        await refreshCacheSize()
    }

    func refreshCacheSize() async {
        cacheSize = await store.cacheSize()
    }
}
