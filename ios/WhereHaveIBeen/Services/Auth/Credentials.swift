import Foundation

struct Credentials: Sendable, Equatable, Codable {
    var username: String
    var password: String

    var basicAuthorizationValue: String {
        "Basic " + Data("\(username):\(password)".utf8).base64EncodedString()
    }
}

protocol CredentialStore: Sendable {
    func load() async throws -> Credentials?
    func save(_ credentials: Credentials) async throws
    func clear() async throws
}

actor InMemoryCredentialStore: CredentialStore {
    private var stored: Credentials?

    init(_ initial: Credentials? = nil) {
        stored = initial
    }

    func load() -> Credentials? { stored }
    func save(_ credentials: Credentials) { stored = credentials }
    func clear() { stored = nil }
}
