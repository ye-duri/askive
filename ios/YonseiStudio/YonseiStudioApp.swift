import SwiftUI
import UIKit

@main
struct YonseiStudioApp: App {
    @State private var settingsRevision = 0
    @State private var confirmSettings = false
    @Environment(\.scenePhase) private var scenePhase
    var body: some Scene {
        WindowGroup {
            VStack(spacing: 0) {
                HStack {
                    Text("연세스튜디오").font(.headline)
                    Spacer()
                    Button("카메라 설정") { confirmSettings = true }
                }.padding(10).background(Color(red: 0.94, green: 0.97, blue: 1))
                StudioWebView(settingsRevision: settingsRevision)
            }
            .alert("카메라 설정을 열까요?", isPresented: $confirmSettings) {
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
