import UIKit
import SwiftUI
import Combine
import ImageIO
import CryptoKit
import Security

// Retains the existing web bridge name, but sends to the operator's Mac only.
@MainActor
final class PhotoPrinter: NSObject, ObservableObject {
    @Published var status = "운영 설정에서 Mac을 연결해 주세요"
    @Published var isBusy = false
    @Published var connectionCode = ""
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
                let encoded = connectionCode.trimmingCharacters(in:.whitespacesAndNewlines).data(using:.utf8)!
                let update = [kSecValueData as String:encoded]
                let found = SecItemUpdate(Self.keyQuery as CFDictionary,update as CFDictionary)
                if found == errSecItemNotFound {
                    var query = Self.keyQuery;query[kSecValueData as String] = encoded
                    query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
                    guard SecItemAdd(query as CFDictionary,nil) == errSecSuccess else { throw URLError(.cannotWriteToFile) }
                } else if found != errSecSuccess { throw URLError(.cannotWriteToFile) }
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
