import UIKit
import SwiftUI
import Combine
import ImageIO
import CryptoKit
import Security

// Retains the existing web bridge name, but sends to the operator's Mac only.
@MainActor
final class PhotoPrinter: NSObject, ObservableObject, @preconcurrency NetServiceBrowserDelegate, @preconcurrency NetServiceDelegate {
    @Published var status = "운영 설정에서 Mac을 연결해 주세요"
    @Published var isBusy = false
    @Published var connectionCode = ""
    @Published var nearbyMacs: [NetService] = []
    @Published var discoveryStatus = "같은 Wi-Fi의 Mac을 찾습니다."
    private let serviceBrowser = NetServiceBrowser()
    private var resolvingService: NetService?
    private var pairingTask: Task<Void, Never>?
    func startDiscovery() {
        serviceBrowser.stop(); nearbyMacs = []; serviceBrowser.delegate = self
        discoveryStatus = "Mac 검색 중… 인쇄 도우미가 실행되어 있어야 합니다."
        serviceBrowser.searchForServices(ofType: "_yonsei-print._tcp.", inDomain: "local.")
    }
    func stopDiscovery() { serviceBrowser.stop() }
    func netServiceBrowser(_ browser: NetServiceBrowser, didFind service: NetService, moreComing: Bool) {
        if !nearbyMacs.contains(where: { $0.name == service.name && $0.domain == service.domain }) { nearbyMacs.append(service) }
        discoveryStatus = "연결할 Mac을 선택해 주세요."
    }
    func netServiceBrowser(_ browser: NetServiceBrowser, didRemove service: NetService, moreComing: Bool) {
        nearbyMacs.removeAll { $0.name == service.name && $0.domain == service.domain }
    }
    func netServiceBrowser(_ browser: NetServiceBrowser, didNotSearch errorDict: [String : NSNumber]) {
        discoveryStatus = "Mac 검색 실패. 같은 Wi-Fi와 앱의 로컬 네트워크 권한을 확인해 주세요."
    }
    func pair(with service: NetService) {
        guard !isBusy else { return }
        isBusy = true; status = "Mac 주소 확인 중…"
        resolvingService = service; service.delegate = self; service.resolve(withTimeout: 8)
    }
    func netService(_ sender: NetService, didNotResolve errorDict: [String : NSNumber]) {
        resolvingService = nil; isBusy = false; status = "Mac 주소를 찾지 못했어요. 다시 검색해 주세요."
    }
    func netServiceDidResolveAddress(_ sender: NetService) {
        guard let host = sender.hostName?.trimmingCharacters(in: CharacterSet(charactersIn: ".")),
              host.range(of: "^[a-zA-Z0-9-]+\\.local$", options: .regularExpression) != nil,
              sender.port == 4178, let base = URL(string: "http://\(host):4178/") else {
            isBusy = false; status = "지원하지 않는 Mac 주소입니다."; return
        }
        resolvingService = nil
        pairingTask = Task {
            defer { isBusy = false; pairingTask = nil }
            do {
                let created = try await pairingRequest(base: base, path: "pair", name: UIDevice.current.name)
                guard let id = created["id"] as? String, let secret = created["secret"] as? String, let code = created["code"] as? String,
                      id.range(of: "^[a-f0-9]{32}$", options: .regularExpression) != nil,
                      secret.range(of: "^[a-f0-9]{48}$", options: .regularExpression) != nil else { throw URLError(.badServerResponse) }
                status = "확인 숫자 \(code) · Mac 관리 화면에서 같은 숫자를 승인해 주세요."
                for _ in 0..<55 {
                    try await Task.sleep(for: .seconds(2))
                    let result = try await pairingRequest(base: base, path: "pair/" + id, secret: secret)
                    if result["state"] as? String == "rejected" {
                        status = "Mac에서 연결을 거절했습니다."; return
                    }
                    if result["state"] as? String == "approved" {
                        guard let token = result["token"] as? String, token.range(of: "^[a-f0-9]{48}$", options: .regularExpression) != nil else { throw URLError(.badServerResponse) }
                        let previous = connectionCode
                        connectionCode = base.absoluteString + "#" + token
                        do {
                            let health = try await request(path: "health")
                            guard health["version"] as? Int == 1 else { throw URLError(.badServerResponse) }
                            try saveConnection(); status = "Mac 연결 완료 · 다음부터 자동 연결"
                        } catch { connectionCode = previous; throw error }
                        return
                    }
                }
                status = "승인 시간이 지났어요. Mac을 다시 선택해 주세요."
            } catch { status = "연결 실패: \(error.localizedDescription)" }
        }
    }
    private func pairingRequest(base: URL, path: String, name: String? = nil, secret: String? = nil) async throws -> [String: Any] {
        var req = URLRequest(url: base.appendingPathComponent(path)); req.timeoutInterval = 8
        if let name { req.httpMethod = "POST"; req.httpBody = try JSONSerialization.data(withJSONObject: ["name": name]); req.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        if let secret { req.setValue("Bearer " + secret, forHTTPHeaderField: "Authorization") }
        let session = URLSession(configuration: .ephemeral, delegate: NoRedirect(), delegateQueue: nil)
        defer { session.finishTasksAndInvalidate() }
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse, let result = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw URLError(.badServerResponse) }
        guard (200..<300).contains(http.statusCode) else { throw NSError(domain: "MacPairing", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: result["error"] as? String ?? "연결 요청 실패"]) }
        return result
    }
    private func saveConnection() throws {
        let encoded = connectionCode.trimmingCharacters(in: .whitespacesAndNewlines).data(using: .utf8)!
        let update = [kSecValueData as String: encoded]
        let found = SecItemUpdate(Self.keyQuery as CFDictionary, update as CFDictionary)
        if found == errSecItemNotFound {
            var query = Self.keyQuery; query[kSecValueData as String] = encoded
            query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            guard SecItemAdd(query as CFDictionary, nil) == errSecSuccess else { throw URLError(.cannotWriteToFile) }
        } else if found != errSecSuccess { throw URLError(.cannotWriteToFile) }
    }
    private static let keyQuery: [String: Any] = [kSecClass as String:kSecClassGenericPassword, kSecAttrService as String:"kr.yeduri.YonseiStudio.mac", kSecAttrAccount as String:"connection"]
    override init() {
        super.init()
        var query = Self.keyQuery
        query[kSecReturnData as String] = true
        var value: CFTypeRef?
        if SecItemCopyMatching(query as CFDictionary, &value) == errSecSuccess, let data = value as? Data, let text = String(data:data, encoding:.utf8) {
            connectionCode = text
            status = "Mac 연결 설정됨"
        }
    }
    private func connection() throws -> (URL, String) {
        guard var parts = URLComponents(string:connectionCode.trimmingCharacters(in:.whitespacesAndNewlines)),
              parts.scheme == "http", let host = parts.host,
              host.range(of:"^[a-zA-Z0-9-]+\\.local$", options:.regularExpression) != nil,
              parts.port == 4178, parts.user == nil, parts.password == nil, parts.query == nil,
              let token = parts.fragment, token.range(of:"^[a-f0-9]{48}$",options:.regularExpression) != nil else {
            throw NSError(domain:"MacConnection",code:1,userInfo:[NSLocalizedDescriptionKey:"Mac 관리 화면의 연결 코드를 그대로 붙여 넣어 주세요."])
        }
        parts.fragment = nil; parts.path = "/"
        guard let url = parts.url else { throw URLError(.badURL) }
        return (url, token)
    }
    private func request(path: String, data: Data? = nil) async throws -> [String:Any] {
        let (base, token) = try connection()
        var request = URLRequest(url:base.appendingPathComponent(path))
        request.timeoutInterval = 30
        request.setValue("Bearer \(token)",forHTTPHeaderField:"Authorization")
        if let data {
            request.httpMethod = "POST"; request.httpBody = data
            request.setValue("image/jpeg",forHTTPHeaderField:"Content-Type")
            request.setValue(SHA256.hash(data:data).map { String(format:"%02x",$0) }.joined(),forHTTPHeaderField:"X-Job-ID")
        }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForResource = 40
        let session = URLSession(configuration:configuration,delegate:NoRedirect(),delegateQueue:nil)
        defer { session.finishTasksAndInvalidate() }
        let (bytes,response) = try await session.data(for:request)
        guard let http = response as? HTTPURLResponse, let result = try JSONSerialization.jsonObject(with:bytes) as? [String:Any] else { throw URLError(.badServerResponse) }
        guard (200..<300).contains(http.statusCode) else { throw NSError(domain:"MacConnection",code:http.statusCode,userInfo:[NSLocalizedDescriptionKey:result["error"] as? String ?? "Mac 연결을 확인해 주세요."]) }
        return result
    }
    func testConnection() {
        guard !isBusy else { return };isBusy = true;status = "Mac 연결 확인 중"
        Task {
            defer { isBusy = false }
            do {
                let result = try await request(path:"health")
                guard result["version"] as? Int == 1 else { throw URLError(.badServerResponse) }
                try saveConnection()
                status = "Mac 연결 완료"
            } catch { status = "연결 실패: \(error.localizedDescription)" }
        }
    }
    func printPhoto(_ encoded: String, report: @escaping (String,String) -> Void) {
        guard !isBusy else { report("error","Mac 연결 작업이 진행 중이에요. 잠시 후 다시 눌러 주세요.");return }
        guard encoded.utf8.count < 8_500_000, let data = Data(base64Encoded:encoded),
              let source = CGImageSourceCreateWithData(data as CFData,nil), CGImageSourceGetCount(source) == 1,
              let props = CGImageSourceCopyPropertiesAtIndex(source,0,nil) as? [CFString:Any],
              let w = props[kCGImagePropertyPixelWidth] as? Int, let h = props[kCGImagePropertyPixelHeight] as? Int,
              w > 0,h > 0,w <= 6000,h <= 6000,w*h <= 24_000_000 else { report("error","인쇄용 사진을 확인해 주세요.");return }
        isBusy = true;status = "Mac으로 사진 전송 중";report("busy",status)
        Task {
            defer { isBusy = false }
            do {
                let result = try await request(path:"jobs",data:data)
                guard result["received"] as? Bool == true else { throw URLError(.badServerResponse) }
                status = "Mac 수신 완료 · 매수 선택 대기";report("sent",status)
            } catch {
                status = "Mac 전송 실패 · 같은 Wi-Fi와 도우미 실행을 확인해 주세요"
                report("error",status+". 다시 눌러도 같은 사진은 중복 접수되지 않아요.")
            }
        }
    }
}
private final class NoRedirect: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
