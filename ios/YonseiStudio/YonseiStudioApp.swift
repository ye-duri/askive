import SwiftUI

@main
struct YonseiStudioApp: App {
    @StateObject private var printer = PhotoPrinter()
    var body: some Scene {
        WindowGroup {
            VStack(spacing: 0) {
                HStack {
                    Text("연세스튜디오").font(.headline)
                    Spacer()
                    Text(printer.status).font(.caption).lineLimit(2)
                    Button("프린터 설정") { printer.choosePrinter() }
                        .disabled(printer.isBusy)
                }.padding(10)
                StudioWebView(printer: printer)
            }
        }
    }
}
