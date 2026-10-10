import SwiftUI
import WebKit

struct StudioWebView: UIViewRepresentable {
    var settingsRevision: Int = 0
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.isOpaque = false
        web.allowsBackForwardNavigationGestures = false
        web.scrollView.bounces = false
        context.coordinator.web = web
        web.load(URLRequest(url: URL(string: "https://askive.pages.dev/")!))
        return web
    }
    func updateUIView(_ view: WKWebView, context: Context) {
        guard context.coordinator.settingsRevision != settingsRevision else { return }
        context.coordinator.settingsRevision = settingsRevision
        view.load(URLRequest(url: URL(string: "https://askive.pages.dev/?setup=1")!))
    }
    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        weak var web: WKWebView?
        var settingsRevision = 0
        func trusted(_ url: URL?) -> Bool {
            url?.scheme == "https" && url?.host == "askive.pages.dev" && (url?.port == nil || url?.port == 443)
        }
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            decisionHandler(trusted(action.request.url) ? .allow : .cancel)
        }
        func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            decisionHandler(origin.protocol == "https" && origin.host == "askive.pages.dev" && [0,443].contains(origin.port) && trusted(webView.url) && frame.isMainFrame && type == .camera ? .grant : .deny)
        }
    }
}
