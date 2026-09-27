import SwiftUI
import UIKit

@main
struct YonseiStudioApp: App {
    @StateObject private var printer = PhotoPrinter()
    @State private var settingsRevision = 0
    @State private var confirmSettings = false
    @State private var showMacConnection = false
    @Environment(\.scenePhase) private var scenePhase
    var body: some Scene {
        WindowGroup {
            VStack(spacing: 0) {
                HStack {
                    Text("연세스튜디오").font(.headline)
                    Spacer()
                    Text(printer.status).font(.caption).lineLimit(2)
                    Menu("운영 설정") {
                        Button("Mac 연결") { showMacConnection = true }
                        Button("카메라 테스트 · QR 인증") { confirmSettings = true }
                    }.disabled(printer.isBusy)
                }.padding(10).background(Color(red: 0.94, green: 0.97, blue: 1))
                StudioWebView(printer: printer, settingsRevision: settingsRevision)
            }
            .sheet(isPresented: $showMacConnection) {
                NavigationStack {
                    Form {
                        Section("Mac 인쇄 도우미 연결") {
                            Text("Mac 관리 화면의 ‘iPad 연결 설정’에서 연결 코드를 복사해 붙여 넣어 주세요. 같은 Wi-Fi에서 사용합니다.")
                            TextField("http://Mac이름.local:4178/#연결키", text: $printer.connectionCode)
                                .textInputAutocapitalization(.never).autocorrectionDisabled()
                                .disabled(printer.isBusy)
                            Button("연결 확인 · 저장") { printer.testConnection() }.disabled(printer.isBusy)
                            Text(printer.status)
                        }
                        Section { Text("사진 인쇄를 누르면 Mac으로 전송됩니다. 매니저가 Mac에서 매수를 선택한 뒤 인쇄합니다.") }
                    }
                    .navigationTitle("Mac 연결")
                    .toolbar { Button("닫기") { showMacConnection = false } }
                }
            }
            .alert("카메라·QR 설정을 열까요?", isPresented: $confirmSettings) {
                Button("취소", role: .cancel) {}
                Button("설정 열기", role: .destructive) { settingsRevision += 1 }
            } message: {
                Text("화면을 다시 불러옵니다. 진행 중인 촬영과 기기에 남은 사진은 사라지므로 이용자가 없을 때 실행해 주세요.")
            }
            .onAppear { UIApplication.shared.isIdleTimerDisabled = true }
            .onChange(of: scenePhase) { _, phase in
                UIApplication.shared.isIdleTimerDisabled = phase == .active
            }
        }
    }
}
