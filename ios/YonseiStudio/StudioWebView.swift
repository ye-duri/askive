import SwiftUI
import WebKit

struct StudioWebView: UIViewRepresentable {
    @ObservedObject var printer: PhotoPrinter
    func makeCoordinator() -> Coordinator { Coordinator(printer) }
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.add(context.coordinator, name: "yonseiPrint")
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.isOpaque = false
        context.coordinator.web = web
        web.load(URLRequest(url: URL(string: "https://askive.pages.dev/")!))
        return web
    }
    func updateUIView(_ view: WKWebView, context: Context) {}
    static func dismantleUIView(_ view: WKWebView, coordinator: Coordinator) {
        view.configuration.userContentController.removeScriptMessageHandler(forName: "yonseiPrint")
    }
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        let printer: PhotoPrinter
        weak var web: WKWebView?
        init(_ printer: PhotoPrinter) { self.printer = printer }
        func trusted(_ url: URL?) -> Bool {
            url?.scheme == "https" && url?.host == "askive.pages.dev" && (url?.port == nil || url?.port == 443)
        }
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            decisionHandler(trusted(action.request.url) ? .allow : .cancel)
        }
        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            let origin = message.frameInfo.securityOrigin
            guard message.frameInfo.isMainFrame, trusted(web?.url), origin.protocol == "https", origin.host == "askive.pages.dev", [0,443].contains(origin.port),
                  let body = message.body as? [String: Any], body["type"] as? String == "print", let data = body["jpeg"] as? String else { return }
            printer.printPhoto(data) { [weak self] state, text in
                guard let self, self.trusted(self.web?.url),
                      let json = try? JSONSerialization.data(withJSONObject: ["state":state,"message":text]),
                      let literal = String(data: json, encoding: .utf8) else { return }
                self.web?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('yonsei-print-state',{detail:\(literal)}))", completionHandler: nil)
            }
        }
        func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            decisionHandler(origin.protocol == "https" && origin.host == "askive.pages.dev" && frame.isMainFrame && type == .camera ? .grant : .deny)
        }
    }
}
