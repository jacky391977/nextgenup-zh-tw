# 維護與建置

原始碼基底固定為官方 commit `16e01bb1e34baf7feb62dc70172dc5a572d3b7e8`，修改後來源完整收錄。`translations.json` 保存繁體中文詞庫；不需要在客戶電腦重新翻譯或編譯。

GitHub Actions `.github/workflows/release.yml` 分別在 macOS arm64、macOS Intel、Windows x64 的原生 runner 建置。Python 3.12、Rust stable、Node 22 僅為建置需求。

```bash
python -m pip install -r requirements.txt pyinstaller opencv-python-headless
python scripts/build_payload.py --prepare
pyinstaller --noconfirm nextgenup-server.spec
# 將 dist/nextgenup-server（Windows 加 .exe）複製到
# src-tauri/binaries/nextgenup-server-<Rust target>（Windows 加 .exe）
npm install
npm run tauri build -- --no-bundle
python scripts/build_payload.py --package macos-arm64
```

`--package` 可選 `macos-arm64`、`macos-x64`、`windows-x64`。AI 基礎模型從 `model-lock.json` 的來源下載並以 SHA-256 鎖定；若上游檔案改變，建置會失敗，應核對來源後才更新校驗碼。

只封裝 `nextgenup` 與 `nextgenup-server`，不把使用者應用程式資料夾複製到 Release。完整套件由安裝腳本在客戶端取得固定官方原版，再替換兩個程式。桌面殼不註冊官方 updater，後端更新入口指向社群專案且不自動覆寫。

工作流程以本次建置的本機套件執行真正的官方下載／校驗／安裝／啟動，接著重複安裝與 doctor，再執行 `tests/smoke.py`。只有三平台全部成功，publish 工作才會建立 Release 及彙總 SHA256SUMS。

第一次發布：建立 `v1.2.0-zh.4` 標籤或手動執行 workflow。若該 Release 已存在，應以新的版本號更新 `TAG`、所有腳本與文件後建立新標籤，避免默默替換客戶正在下載的版本。

## 授權文字維護

`THIRD_PARTY_NOTICES.md` 保存固定 Cargo.lock 依賴及工作區層級的原始授權文字，`licenses/` 保存模型授權與版本／來源清單。更新 Cargo.lock 或模型時，必須同步這些聲明，不能把主程式的 MIT 授權套用到所有依賴。

本次交付在平台 QA 後補齊套件中的完整授權文字；`scripts/refresh_notices.py` 只更新授權文件及該文件的 manifest 校驗碼，並逐一驗證受測執行檔完全不變。Release 的 `qa-license-notices.json` 留存各平台執行檔 SHA-256。後續正常建置會直接包含已補齊的全文。
