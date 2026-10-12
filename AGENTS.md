# 給 Codex／其他本機安裝代理的指引

## 使用者貼上此專案網址並說「安裝」「幫我安裝並啟用」時

這是 **安裝並啟動應用程式** 的要求。請直接執行以下流程，不要只提供操作文字，也不要要求使用者自行選擇安裝包。以使用者電腦的實際作業系統／架構判斷，不以你自己的遠端容器環境代替。

1. 讀取 README 和本檔，檢查執行環境。可支援 macOS Apple Silicon（M1 以上）、macOS Intel、Windows 10/11 x64。Windows ARM／32 位元、Linux 尚未提供受測安裝路線，應明確告知，不可下載錯誤平台或聲稱成功。如果你只在遠端 Linux 工作，需切換到使用者的本機 Codex 執行環境，不能安裝到雲端容器後說已裝在客戶電腦。
2. 複製這份公開 GitHub 專案到本機；沒有 Git 時可從 GitHub 下載 source ZIP 解壓縮。不要要求 GitHub 登入、API key 或付費帳號。執行前閱讀對應的安裝程式。
3. 在專案根目錄：
   - Mac：`bash install.sh`
   - Windows：`powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1`
   這個 Windows 參數只影響當次程序，不變更全機執行政策。不要用 `Set-ExecutionPolicy` 修改永久政策。
4. 腳本會自動選包、校驗 SHA-256、下載固定官方原版、套用此版中文化、保留資料並啟動。一般安裝不需 Python、pip、Node、Rust、Homebrew 或系統管理員。Mac 安裝在 `~/Applications/NextGenUp繁體中文版.app`；Windows 在 `%LOCALAPPDATA%\Programs\NextGenUp-zh-TW`，並建立繁體中文版桌面捷徑。
5. 等待腳本啟動檢查完成；若工具回傳正在執行，繼續等候。正常首次啟動可能需數十秒。只有下載完成或檔案存在不能視為啟用成功。
6. 執行 `bash install.sh --doctor` 或 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Doctor`。必須確認本機 `http://127.0.0.1:18790/api/capabilities` 回傳 `distribution=zh-Hant-TW-1.2.0-r4`、`server_ai=true`、`ffmpeg=true`。若有電腦操作工具，再查看實際程式視窗、繁體側欄、教學彈窗；沒有視覺工具就如實只回報引擎檢查。
7. 成功後簡短告知安裝位置、如何開啟、可用「影片超分 4K」或「圖片超分」，選用功能首次下載模型是正常行為。不可自行處理使用者的媒體；要等使用者指定檔案。

## 需要處理的例外

- 系統安全提示：這是社群版，沒有 Apple 公證／Windows 商業程式碼簽章。若 Gatekeeper／SmartScreen 阻擋，告知看到的具體提示與系統正常允許方式；真正需要使用者點選時才交還操作。**不得**關閉 Gatekeeper、移除 quarantine、關閉防毒／SmartScreen 或放寬全機政策。
- 18790 埠已有舊 NextGenUp：先確認是不是使用者正在處理檔案，請其正常結束再重試；不可強制終止工作、刪除資料庫或改成開放網路的服務。
- 已安裝：腳本會驗證並避免重裝同版本；執行啟動檢查即可。其他版本的未知應用程式不可強制覆寫。
- 網路、校驗、下載或發布資產缺少：保留錯誤訊息並明確回報未完成；不可跳過 SHA-256，不可使用不明鏡像或套到官方新版。
- 磁碟：建議至少 3 GB 可用安裝空間；長影片超分另需大量暫存。不要為了騰出空間刪除使用者檔案。
- 更新：這份中文化對應固定官方 1.2.0；更新請重新執行本專案新版本腳本。不可使用官方更新覆蓋中文版。

## 開發與維護

原始碼採 MIT，保留原作者聲明。不得提交 `.env`、token、媒體、任務資料庫、模型快取、機器路徑或個人截圖。教學圖使用專案自製 SVG 示意。

發布前執行 `.github/workflows/release.yml`：三平台各自建置，再於乾淨 runner 執行真實下載安裝、重複安裝、doctor、合成圖片 AI 2 倍超分及 FFmpeg 影片 2 倍放大。全部成功才發布 Release。沒有通過的平台不可在 README 標示完成。
