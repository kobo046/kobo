# iOS App 安裝及發佈指南

本專案已經用 Capacitor 建立真正的 iOS App 外殼，不需要重新用 Swift 改寫。App 會使用目前網站的畫面、計分邏輯和 Supabase 雲端資料，iPhone 與網站可以看到同一批選手及比賽。

## Mac 需要準備

- macOS 電腦
- Node.js 20 或以上
- Xcode 16 或以上，安裝後最少開啟一次
- CocoaPods：未安裝可在 Terminal 執行 `brew install cocoapods`
- Apple ID；只安裝到自己的 iPhone 可以先用免費帳戶

## 第一次在 Mac 準備專案

在 Mac 的 Terminal 執行：

```bash
git clone https://github.com/kobo046/kobo.git
cd kobo
bash scripts/prepare-ios-mac.sh
```

腳本會自動：

1. 檢查 Node.js、Xcode 和 CocoaPods。
2. 安裝專案套件。
3. 執行計分、儲存和雲端同步測試。
4. 把最新網站內容同步到 iOS 專案。
5. 打開 `ios/App/App.xcworkspace`。

如果專案已經下載到 Mac，只需進入該資料夾，再執行 `bash scripts/prepare-ios-mac.sh`。不要再次執行 `cap:add:ios`，因為 Xcode 專案已經存在。

## 在 Xcode 安裝到 iPhone

1. 在 Xcode 選擇左側藍色 `App` 專案，再選擇 `App` target。
2. 打開 `Signing & Capabilities`，勾選 `Automatically manage signing`。
3. 在 `Team` 選擇你的 Apple ID；如果未見帳戶，到 `Xcode > Settings > Accounts` 加入。
4. Bundle Identifier 預設是 `com.kobo046.badmintonrating`。如果 Xcode 說已被使用，改成只屬於你的名稱，例如 `com.kobo046.badmintonrating.personal`。
5. 用 USB 連接並信任 iPhone，在 Xcode 上方裝置選單選擇該 iPhone。
6. 按三角形 Run 按鈕，等待 App 安裝。
7. 如果 iPhone 提示 Developer Mode，到 `設定 > 私隱與保安 > 開發者模式` 開啟後重新啟動。

免費 Apple ID 可以安裝到自己的 iPhone 測試，但簽署通常只有 7 日，到期後要再用 Xcode Run 一次。上架 TestFlight 或 App Store 則需要付費 Apple Developer Program。

## 之後更新 App

網站有新版本後，在 Mac 專案資料夾執行：

```bash
git pull
npm run cap:sync:ios
npm run cap:open:ios
```

再在 Xcode 按 Run。`cap:sync:ios` 會先建立最新 HTML、CSS、JavaScript 和圖片，再同步到 iOS 專案。

Windows 可以執行 `npm run validate` 及 `npm run build:ios-web` 檢查內容，但正式 iOS 同步、簽署和編譯應在 Mac 完成。

## 雲端與手機資料

- iOS App 使用 `supabase-config.js` 內相同的 Supabase Project URL 和 publishable key，所以會與網站共用雲端資料。
- Safari 網站和 iOS App 是兩個獨立的本機儲存空間；第一次開 App 時，要等畫面顯示雲端已連線，再核對選手和比賽數量。
- Supabase 暫停或斷線時，App 會保留本機暫存，恢復連線後再同步；不要在未確認雲端完整前刪除 App。
- 更新或安裝前建議先在網站匯出 JSON 備份，並在另一部裝置確認雲端記錄完整。
- 管理員密碼目前只是前端操作限制。公開上架前，仍建議改用 Supabase Auth 和嚴格 RLS policy。

## TestFlight / App Store

加入 Apple Developer Program 後，在 Xcode 選擇 `Product > Archive`。完成後於 Organizer 選擇 `Distribute App`，上傳到 App Store Connect，再先用 TestFlight 測試雲端同步、管理員模式、離線暫存及資料恢復。

## 常用指令

```bash
npm run ios:prepare:mac # Mac 首次完整準備並打開 Xcode
npm test                # 執行計分及資料測試
npm run validate        # 執行測試和發佈檢查
npm run build:ios-web   # 只建立 iOS 網頁資產
npm run cap:sync:ios    # 建立資產並同步至 Xcode 專案
npm run cap:open:ios    # 在 Mac 打開 Xcode workspace
```
