#!/bin/zsh
set -e
HELPER_SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
REPO_DIR="$(cd "$HELPER_SOURCE/.." && pwd)"
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT
APP_PATH="$BUILD_DIR/연세스튜디오 인쇄 도우미 설치.app"
/usr/bin/osacompile -o "$APP_PATH" "$HELPER_SOURCE/installer/Installer.applescript"
RESOURCE_DIR="$APP_PATH/Contents/Resources"
cp "$HELPER_SOURCE/server.mjs" "$HELPER_SOURCE/print-pdf.mjs" "$HELPER_SOURCE/installer/install.sh" "$RESOURCE_DIR/"
cp -R "$HELPER_SOURCE/public" "$RESOURCE_DIR/public"
/usr/libexec/PlistBuddy -c 'Set :CFBundleIdentifier kr.yeduri.YonseiStudioPrintInstaller' "$APP_PATH/Contents/Info.plist"
/usr/bin/codesign --force --deep --sign - "$APP_PATH"
/usr/bin/ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$REPO_DIR/dist/print/yonsei-print-installer-mac.zip"
