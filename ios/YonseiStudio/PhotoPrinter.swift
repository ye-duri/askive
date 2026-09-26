import UIKit
import SwiftUI
import ImageIO

@MainActor
final class PhotoPrinter: NSObject, ObservableObject, UIPrintInteractionControllerDelegate {
    @Published var status = "처음 한 번 CP1500을 선택해 주세요"
    @Published var isBusy = false
    private var selected: UIPrinter? {
        guard let text = UserDefaults.standard.string(forKey: "printerURL"), let url = URL(string: text) else { return nil }
        return UIPrinter(url: url)
    }
    func choosePrinter(completion: ((UIPrinter?) -> Void)? = nil) {
        guard !isBusy else { completion?(nil); return }
        guard let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first(where: { $0.activationState == .foregroundActive }),
              let view = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController?.view else { completion?(nil); return }
        isBusy = true
        let picker = UIPrinterPickerController(initiallySelectedPrinter: selected)
        picker.present(from: CGRect(x: view.bounds.midX, y: 20, width: 1, height: 1), in: view, animated: true) { [weak self] controller, chosen, error in
            guard let self else { return }; self.isBusy = false
            guard chosen, error == nil, let printer = controller.selectedPrinter else { completion?(nil); return }
            UserDefaults.standard.set(printer.url.absoluteString, forKey: "printerURL")
            self.status = printer.displayName
            completion?(printer)
        }
    }
    func printPhoto(_ encoded: String, report: @escaping (String,String) -> Void) {
        guard !isBusy else { report("busy", "인쇄 전송 중입니다."); return }
        guard encoded.utf8.count < 8_500_000,
              let data = Data(base64Encoded: encoded), data.starts(with: [0xff,0xd8,0xff]),
              let source = CGImageSourceCreateWithData(data as CFData, nil), CGImageSourceGetCount(source) == 1,
              let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString:Any],
              let w = props[kCGImagePropertyPixelWidth] as? Int, let h = props[kCGImagePropertyPixelHeight] as? Int,
              w > 0, h > 0, w <= 6000, h <= 6000, w*h <= 24_000_000 else {
            report("error", "인쇄용 사진 형식이나 크기를 확인해 주세요."); return
        }
        if let printer = selected { submit(data, to: printer, report: report) }
        else {
            choosePrinter { [weak self] printer in
                guard let printer else { report("cancelled", "프린터 선택을 취소했습니다."); return }
                self?.submit(data, to: printer, report: report)
            }
        }
    }
    private func submit(_ data: Data, to printer: UIPrinter, report: @escaping (String,String) -> Void) {
        isBusy = true; status = "프린터 연결 확인 중"; report("busy", status)
        printer.contactPrinter { [weak self] available in
            guard let self else { return }
            guard available else { self.isBusy = false; self.status = "CP1500 연결을 확인해 주세요"; report("error", self.status); return }
            let controller = UIPrintInteractionController.shared
            let info = UIPrintInfo(dictionary: nil)
            info.jobName = "연세스튜디오"
            info.outputType = .photo
            info.orientation = .portrait
            info.duplex = .none
            controller.printInfo = info
            controller.printingItem = data
            controller.delegate = self
            controller.showsNumberOfCopies = false
            self.status = "사진 전송 중"
            let accepted = controller.print(to: printer) { [weak self] controller, completed, error in
                controller.printingItem = nil
                guard let self else { return }; self.isBusy = false
                self.status = completed && error == nil ? "프린터 전송 완료" : "인쇄 중단 · 프린터 확인"
                report(completed && error == nil ? "sent" : "error", self.status)
            }
            if !accepted { controller.printingItem = nil; self.isBusy = false; self.status = "인쇄를 시작하지 못했습니다"; report("error", self.status) }
        }
    }
    func printInteractionController(_ printInteractionController: UIPrintInteractionController, choosePaper paperList: [UIPrintPaper]) -> UIPrintPaper {
        UIPrintPaper.bestPaper(forPageSize: CGSize(width: 100/25.4*72, height: 148/25.4*72), withPapersFrom: paperList)
    }
}
