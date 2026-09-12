import Foundation

struct CacheEntry<Value: Codable & Sendable>: Codable, Sendable {
    var value: Value
    var storedAt: Date
}

extension CacheEntry: Equatable where Value: Equatable {}

/// One JSON file per key under Application Support.
actor DiskCache {
    let directory: URL

    init(directory: URL? = nil) {
        self.directory = directory ?? DiskCache.defaultDirectory(subdirectory: "cache")
    }

    static func defaultDirectory(subdirectory: String) -> URL {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return support.appending(path: "WhereHaveIBeen").appending(path: subdirectory)
    }

    func read<Value: Decodable & Sendable>(_ type: Value.Type, key: String) -> Value? {
        guard let data = try? Data(contentsOf: fileURL(for: key)) else { return nil }
        return try? APIJSON.decoder.decode(type, from: data)
    }

    func write<Value: Encodable & Sendable>(_ value: Value, key: String) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let data = try APIJSON.encoder.encode(value)
        try data.write(to: fileURL(for: key), options: .atomic)
    }

    func removeAll(prefix: String) {
        for url in files() where url.lastPathComponent.hasPrefix(Self.fileName(for: prefix)) {
            try? FileManager.default.removeItem(at: url)
        }
    }

    func clear() {
        try? FileManager.default.removeItem(at: directory)
    }

    func totalSize() -> Int64 {
        files().reduce(0) { total, url in
            let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
            return total + Int64(size)
        }
    }

    private func files() -> [URL] {
        (try? FileManager.default.contentsOfDirectory(
            at: directory, includingPropertiesForKeys: [.fileSizeKey])) ?? []
    }

    private func fileURL(for key: String) -> URL {
        directory.appending(path: Self.fileName(for: key))
    }

    static func fileName(for key: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "._-"))
        let safe = key.unicodeScalars.map { allowed.contains($0) ? Character($0) : "_" }
        return String(safe)
    }
}
