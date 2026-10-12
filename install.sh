#!/bin/bash
# Apple Silicon / Intel Mac installer. No sudo, Homebrew, pip, or developer tools required.
set -euo pipefail
TAG='v1.2.0-zh.4'
REPO='jacky391977/nextgenup-zh-tw'
BASE="https://github.com/$REPO/releases/download/$TAG"
PREFIX="$HOME/Applications"
ASSET_DIR=''
LAUNCH=1
DOCTOR=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --prefix) PREFIX="$2"; shift 2 ;;
    --asset-dir) ASSET_DIR="$2"; shift 2 ;;
    --no-launch) LAUNCH=0; shift ;;
    --doctor) DOCTOR=1; shift ;;
    *) echo "未知參數：$1" >&2; exit 1 ;;
  esac
done
fail() { echo "未完成：$*" >&2; exit 1; }
[ "$(uname -s)" = Darwin ] || fail '這支安裝程式適用於 macOS；Windows 請使用 install.ps1。'
ARCH="$(uname -m)"
if [ "$(/usr/sbin/sysctl -in sysctl.proc_translated 2>/dev/null || true)" = 1 ]; then ARCH=arm64; fi
case "$ARCH" in
  arm64) TARGET=macos-arm64; UPSTREAM_SHA=617b6124262b00d79bdd9db06a25409b46d9de819bc66f0b3a23043e32a41467; UPSTREAM_NAME=NextGenUp-Mac-AppleSilicon.dmg ;;
  x86_64) TARGET=macos-x64; UPSTREAM_SHA=7da47f8cff52f22139c2bad24a0b30a53f6e0a5b629e82647036739f4d616511; UPSTREAM_NAME=NextGenUp-Mac-Intel.dmg ;;
  *) fail "不支援的處理器：$ARCH" ;;
esac
APP="$PREFIX/NextGenUp繁體中文版.app"
MARKER="$APP/Contents/Resources/nextgenup-zh-tw.json"
health() {
  local result
  result="$(/usr/bin/curl -fsS --max-time 3 http://127.0.0.1:18790/api/capabilities 2>/dev/null)" || return 1
  printf '%s' "$result" | /usr/bin/plutil -extract distribution raw -o - - 2>/dev/null | /usr/bin/grep -qx 'zh-Hant-TW-1.2.0-r4' || return 1
  printf '%s' "$result" | /usr/bin/plutil -extract ffmpeg raw -o - - 2>/dev/null | /usr/bin/grep -qx true || return 1
  printf '%s' "$result" | /usr/bin/plutil -extract server_ai raw -o - - 2>/dev/null | /usr/bin/grep -qx true || return 1
  printf '%s\n' "$result"
}
if [ "$DOCTOR" = 1 ]; then
  [ -f "$MARKER" ] || fail "找不到此社群版安裝紀錄：$APP"
  /usr/bin/codesign --verify --deep --strict "$APP"
  health || fail '程式尚未啟動，或本機 AI／FFmpeg 檢查未通過。'
  echo "安裝與啟動檢查通過：$APP"
  exit 0
fi
if [ -f "$MARKER" ] && [ "$(/usr/bin/plutil -extract release raw -o - "$MARKER" 2>/dev/null)" = "$TAG" ]; then
  /usr/bin/codesign --verify --deep --strict "$APP" || fail '已安裝版本驗證失敗，請保留檔案並回報。'
  echo '此版本已安裝，準備啟動。'
else
  [ ! -e "$APP" ] || [ -f "$MARKER" ] || fail "目標位置有未受管理的程式，請先選擇其他 --prefix：$APP"
  if /bin/ps -axo command= | /usr/bin/grep -F "$APP/Contents/MacOS/nextgenup" | /usr/bin/grep -v grep >/dev/null; then
    fail '請先正常結束既有繁體中文版，再重新安裝；不會強制停止處理中的工作。'
  fi
  mkdir -p "$PREFIX"
  WORK="$(mktemp -d "$PREFIX/.nextgenup-install.XXXXXX")"
  MOUNT="$WORK/mount"
  MOUNTED=0
  cleanup() {
    if [ "$MOUNTED" = 1 ]; then /usr/bin/hdiutil detach "$MOUNT" -quiet || true; fi
    rm -rf "$WORK"
  }
  trap cleanup EXIT
  download() { /usr/bin/curl --fail --location --retry 3 --connect-timeout 20 --proto '=https' --tlsv1.2 "$1" -o "$2"; }
  NAME="NextGenUp-zh-TW-$TAG-$TARGET.zip"
  if [ -n "$ASSET_DIR" ]; then
    cp "$ASSET_DIR/$NAME" "$WORK/$NAME"; cp "$ASSET_DIR/SHA256SUMS" "$WORK/SHA256SUMS"
  else
    download "$BASE/SHA256SUMS" "$WORK/SHA256SUMS"
    download "$BASE/$NAME" "$WORK/$NAME"
  fi
  EXPECTED="$(awk -v name="$NAME" '$2==name {print $1}' "$WORK/SHA256SUMS")"
  [ "${#EXPECTED}" = 64 ] || fail '發行版缺少正確的 SHA-256 校驗碼。'
  ACTUAL="$(/usr/bin/shasum -a 256 "$WORK/$NAME" | awk '{print $1}')"
  [ "$ACTUAL" = "$EXPECTED" ] || fail '繁體中文套件校驗失敗，未安裝。'
  download "https://github.com/riponcm/nextgenUp/releases/download/v1.2.0/$UPSTREAM_NAME" "$WORK/original.dmg"
  [ "$(/usr/bin/shasum -a 256 "$WORK/original.dmg" | awk '{print $1}')" = "$UPSTREAM_SHA" ] || fail '官方原版校驗失敗，未安裝。'
  mkdir "$MOUNT"
  /usr/bin/hdiutil attach "$WORK/original.dmg" -mountpoint "$MOUNT" -readonly -nobrowse -quiet
  MOUNTED=1
  /usr/bin/ditto "$MOUNT/NextGenUp.app" "$WORK/NextGenUp.app"
  /usr/bin/hdiutil detach "$MOUNT" -quiet
  MOUNTED=0
  /usr/bin/ditto -x -k "$WORK/$NAME" "$WORK/patch"
  [ "$(/usr/bin/plutil -extract target raw -o - "$WORK/patch/manifest.json")" = "$TARGET" ] || fail '套件平台不符。'
  STAGE="$WORK/NextGenUp.app"
  cp "$WORK/patch/payload/nextgenup" "$STAGE/Contents/MacOS/nextgenup"
  cp "$WORK/patch/payload/nextgenup-server" "$STAGE/Contents/MacOS/nextgenup-server"
  chmod +x "$STAGE/Contents/MacOS/nextgenup" "$STAGE/Contents/MacOS/nextgenup-server"
  cp "$WORK/patch/manifest.json" "$STAGE/Contents/Resources/nextgenup-zh-tw.json"
  cp "$WORK/patch/LICENSE" "$STAGE/Contents/Resources/LICENSE-NextGenUp"
  cp "$WORK/patch/THIRD_PARTY_NOTICES.md" "$STAGE/Contents/Resources/THIRD_PARTY_NOTICES.md"
  /usr/libexec/PlistBuddy -c 'Set :CFBundleDevelopmentRegion zh_TW' "$STAGE/Contents/Info.plist"
  /usr/libexec/PlistBuddy -c "Add :NextGenUpLocalization string $TAG" "$STAGE/Contents/Info.plist"
  # Finder metadata can be inherited from a DMG; remove only codesign-incompatible metadata.
  # Retain quarantine and every security attribute.
  /usr/bin/xattr -dr com.apple.FinderInfo "$STAGE" 2>/dev/null || true
  /usr/bin/xattr -dr com.apple.ResourceFork "$STAGE" 2>/dev/null || true
  /usr/bin/codesign --force --sign - "$STAGE/Contents/MacOS/nextgenup"
  /usr/bin/codesign --force --sign - "$STAGE/Contents/MacOS/nextgenup-server"
  /usr/bin/codesign --force --sign - "$STAGE"
  /usr/bin/codesign --verify --deep --strict "$STAGE"
  BACKUP=''
  if [ -e "$APP" ]; then
    BACKUP="$HOME/Library/Application Support/NextGenUp-zh-TW/distribution-backups/$(date +%Y%m%d-%H%M%S)-$$.app"
    mkdir -p "$(dirname "$BACKUP")"
    mv "$APP" "$BACKUP"
  fi
  if ! mv "$STAGE" "$APP"; then
    if [ -n "$BACKUP" ]; then mv "$BACKUP" "$APP"; fi
    fail '替換失敗，已嘗試還原上一版。'
  fi
  echo "繁體中文版已安裝：$APP"
  if [ -n "$BACKUP" ]; then echo "上一版備份：$BACKUP"; fi
fi
[ "$LAUNCH" = 1 ] || { echo '未要求啟動；尚未檢查執行中的引擎。'; exit 0; }
if health; then echo '程式已啟動，檢查通過。'; exit 0; fi
if /usr/bin/curl -fsS --max-time 2 http://127.0.0.1:18790/api/capabilities >/dev/null 2>&1; then
  fail '18790 埠已有其他版本，請正常結束原版 NextGenUp 後重新執行。'
fi
/usr/bin/open "$APP" || fail 'macOS 未允許啟動；請在「隱私權與安全性」查看提示，允許後重新執行。'
for ((i=0; i<90; i++)); do
  if health; then echo "安裝並啟用完成：$APP"; exit 0; fi
  sleep 2
done
fail '程式已安裝，但引擎未在 180 秒內就緒。請查看系統安全提示或程式錯誤；不要將此狀態回報為啟用成功。'
