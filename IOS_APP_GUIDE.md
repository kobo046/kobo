# iOS App 安裝及發佈指南

本專案已使用 Capacitor 建立 iOS App。App 內會載入與 GitHub Pages 相同的網站功能，並透過 Supabase REST API 共用選手及比賽資料；無網絡時仍會保留本機暫存資料。

## Windows 更新 App 內容

每次網站程式更新後執行：

```powershell
npm install
npm test
npm run cap:sync:ios
```

`cap:sync:ios` 會先把最新 HTML、CSS、JavaScript、圖片及 manifest 複製到 `ios-web`，再同步到既有的 `ios` 專案。不要再次執行 `cap:add:ios`，否則可能與現有 Xcode 專案衝突。

## 在 Mac 開啟及安裝

編譯 iPhone App 必須使用 Mac、Xcode 及 Apple ID。把整個專案放到 Mac 後，在 Terminal 執行：

```bash
npm install
npm test
npm run cap:sync:ios
npm run cap:open:ios
```

然後在 Xcode：

1. 選擇左側藍色 `App` 專案，再選擇 `App` target。
2. 在 `Signing & Capabilities` 選擇你的 Apple Developer Team。
3. 確認 Bundle Identifier 是唯一值；目前是 `com.kobo046.badmintonrating`。
4. 用 USB 連接 iPhone，選擇該 iPhone 作為執行裝置。
5. 按 Xcode 上方的 Run 按鈕安裝及測試。

首次使用個人 Apple ID 安裝時，iPhone 可能要求開啟 Developer Mode 或信任開發者，依照手機提示完成即可。

## TestFlight / App Store

需要加入 Apple Developer Program。於 Xcode 選擇 `Product > Archive`，完成後在 Organizer 選擇 `Distribute App`，再上傳至 App Store Connect。建議先用 TestFlight 測試 Supabase 同步、管理員模式、離線暫存及資料恢復。

## 資料與安全

- 雲端資料使用目前 `supabase-config.js` 內的 Supabase Project URL 及 publishable key。
- 手機離線或 Supabase 暫停時，新增內容會先保留在本機，恢復連線後再同步。
- 管理員密碼目前是前端操作限制，不能當作真正的資料庫安全機制。公開發佈前，仍建議改用 Supabase Auth 及嚴格 RLS policy。
- 發佈新版本前先匯出 JSON 備份，並在另一部裝置確認雲端資料完整。

## 常用指令

```bash
npm test                 # 執行計分及資料測試
npm run build:ios-web    # 只建立 iOS 網頁資產
npm run cap:sync:ios     # 建立資產並同步至 Xcode 專案
npm run cap:open:ios     # 在 Mac 開啟 Xcode workspace
```
