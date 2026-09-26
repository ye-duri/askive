# iPad 앱 연결 소스 — Xcode 빌드 전

현재 Mac에는 Xcode가 없어 UIKit 컴파일·실물 인쇄는 아직 확인하지 못했습니다. 이 폴더는 Swift 소스이며 .xcodeproj 완성본이 아닙니다.

1. 호환 Xcode 설치 후 iOS App 프로젝트를 생성합니다. 이름 YonseiStudio, SwiftUI, Swift. iOS 16 이상을 대상으로 합니다.
2. 기본 생성된 App 파일과 ContentView 파일을 이 폴더의 Swift 3개 파일로 교체합니다. 앱 진입점 @main은 하나만 남깁니다.
3. Target → Signing & Capabilities에서 본인 Team을 선택하고 Bundle Identifier를 고유하게 설정합니다.
4. Target → Info에 Privacy - Camera Usage Description = 사진 촬영을 위해 카메라를 사용합니다. / Privacy - Local Network Usage Description = 행사장의 CP1500 프린터에 연결합니다. 를 추가합니다.
5. Bonjour services 배열에 _ipp._tcp, _ipps._tcp 를 추가합니다.
6. iPad를 Mac에 연결해 개발자 모드를 켜고 Run 합니다. iPad와 CP1500은 같은 Wi-Fi에 연결합니다.
7. 앱 상단 프린터 설정에서 CP1500을 한 번 선택합니다. 이후 웹의 인쇄 버튼이 JPG를 Swift로 전달하고 저장된 프린터에 print(to:)를 호출합니다.

공유 메뉴와 웹페이지 인쇄를 사용하지 않습니다. UIKit 진행/오류 화면은 나타날 수 있습니다. 앱은 서버 배포 사이트를 불러오므로 인터넷이 필요합니다. 프린터 직접 Wi-Fi가 인터넷을 끊으면 행사장 공유기 연결을 사용하세요.

인쇄 재시도는 자동으로 하지 않습니다. 오류가 나면 실제 출력 여부를 확인한 뒤 다시 누르세요. 브라우저/앱 콜백만으로 종이 출력 상태를 확정하지 않습니다.

보안: 허용된 HTTPS 호스트의 최상위 프레임만 네이티브 인쇄를 호출할 수 있습니다. 이미지 크기·형식 제한, 중복 전송 잠금이 있습니다. 사진은 앱이 파일로 저장하지 않고 메모리에서 처리합니다. 시스템 인쇄 스풀의 보관 동작은 iPadOS가 관리합니다.
