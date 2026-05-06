# iOS App 打包指南

呢個專案已經加入 Capacitor，可以將現有網站包成 iPhone App。

## Windows 可以先做

```powershell
npm install
npm run build:ios-web
```

呢一步會建立 `ios-web`，即 iOS App 會載入嘅網站內容。

## 需要 Mac / Xcode 做

將整個專案放到 Mac 之後執行：

```bash
npm install
npm run cap:add:ios
npm run cap:open:ios
```

之後 Xcode 會打開 iOS 專案。你可以用 USB 連接 iPhone 直接測試，或者用 Apple Developer 帳號上架 App Store。

## App 資料儲存

目前資料仍然存在裝置本機，所以 iPhone App 入面會有自己一份紀錄。如果想所有手機同步同一份資料，下一步要接 Supabase 或其他資料庫。
