# 授權與來源

本專案是 NextGenUp 1.2.0 的繁體中文社群衍生版，並非原作者的官方發布。

- NextGenUp：Copyright (c) 2026 Ripon Chandra Malo，MIT；完整文字見 [LICENSE](LICENSE)
- 基礎原始碼：<https://github.com/riponcm/nextgenUp/tree/16e01bb1e34baf7feb62dc70172dc5a572d3b7e8>
- 繁體中文翻譯、照片拖曳比對、內建教學、跨平台安裝工具：本專案修改，同樣採 MIT
- Tauri、其外掛與 Rust 依賴：依各元件 MIT／Apache-2.0 等原授權；來源及版本見 `src-tauri/Cargo.lock`
- Python 與封裝依賴（Flask、NumPy、Pillow、ONNX Runtime、OpenCV 等）：保留各套件授權；建置時收集套件內 LICENSE／COPYING／NOTICE 至引擎內 `licenses/python/`，另有版本清單
- Python：PSF License；PyInstaller：GPL with bootloader exception；以其例外條款封裝應用程式，不改變 NextGenUp 的 MIT 授權
- Real-ESRGAN 模型：<https://github.com/xinntao/Real-ESRGAN>，BSD-3-Clause；YuNet：<https://github.com/opencv/opencv_zoo>，依模型原授權
- 第一次使用下載的 BiRefNet／SCUNet／NAFNet／DDColor／LaMa／MDX-Net／DeepFilterNet 等模型，仍適用各自的授權，請另行確認用途；不可把主程式的 MIT 授權解讀為所有模型皆無條件授權

## 官方原版及 FFmpeg

本專案 Release **只發布自行建置的桌面殼與中文化引擎**，不重新發布官方完整安裝包或 FFmpeg 二進位檔。

安裝程式會由客戶電腦直接下載、校驗固定的官方 NextGenUp 1.2.0 安裝包，保留其中的 FFmpeg／FFprobe 與資源，再替換本專案建置的兩個執行檔。官方套件網址、版本及 SHA-256 明列於 `install.sh`／`install.ps1`；官方安裝包及 FFmpeg 的授權與原始碼取得方式以原發布來源為準：

- <https://github.com/riponcm/nextgenUp/releases/tag/v1.2.0>
- <https://ffmpeg.org/legal.html>
- <https://github.com/BtbN/FFmpeg-Builds>

不包含使用者的媒體、模型快取、任務資料庫、帳密、GitHub token 或機器專屬路徑。教學比對圖為專案內可閱讀的 SVG 操作示意，沒有客戶照片。
