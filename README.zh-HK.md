# 羽毛球個人積分排行榜

[English README](README.md) · [線上版本](https://kobo046.github.io/kobo/) · [iOS 安裝指南](IOS_APP_GUIDE.md)

這是一個為業餘羽毛球群組而設的手機優先雙打記分及個人排行榜。即使選手每場配搭不同拍檔，系統仍會記錄四位參賽者，並由完整比賽歷史重算每人的表現。

## 主要功能

- 手機即場輸入四位選手及比分
- 五個獨立分頁：首頁、排行、記分、記錄、更多
- 手機並排記分、未儲存草稿保留、重複賽果確認
- 總排名與指定日期單日排名
- 編輯或刪除舊比賽後完整重算
- 比賽日期、場地、備註及比賽日總覽
- 選手改名、個人紀錄與拍檔統計
- JSON 備份、匯入及自動本機快照
- Supabase 多裝置同步及刪除標記
- GitHub Pages 網頁版及 Capacitor iOS App

## 計分方式

單日排名以每日 5.00 分起步，考慮勝負、比分差距及爆冷程度。總排名則以最近 52 星期所有有效比賽持續估計個人實力，不會因出席次數自動獲得積分。同隊兩人共享賽果訊號，但紀錄較少的選手評分會調整得較快；完成至少 10 場、3 個比賽日並遇過 5 位不同對手後，排名才會由暫定轉為正式。

## 本機執行

需要 Node.js 20 或以上：

```bash
git clone https://github.com/kobo046/kobo.git
cd kobo
npm ci
npm test
npm start
```

開啟 `http://127.0.0.1:8797/`。已有伺服器使用該連接埠時，可執行 `node scripts/serve.mjs 8798`。

## Supabase 多人同步

未設定 Supabase 時，網站會使用瀏覽器 `localStorage`。設定 [`supabase-config.js`](supabase-config.js) 後，同一 `clubId` 的裝置會共用選手及比賽資料。完整步驟見 [SUPABASE_SETUP.md](SUPABASE_SETUP.md)。

目前簡易管理員密碼只會限制畫面操作，並非真正資料庫安全機制。公開或多人部署應改用 Supabase Auth 與嚴格 RLS；詳情見 [SECURITY.md](SECURITY.md)。

## 測試

```bash
npm test
npm run validate
npm run test:ui
```

測試涵蓋比分差、爆冷修正、單場上限、歷史重算、52 星期總榜、備份兼容、雲端合併、刪除標記及選手管理。

介面測試使用已安裝的 Google Chrome，隔離 Supabase 請求並使用測試資料，檢查 320–1440px 版面、草稿、單場編輯及儲存失敗。截圖存於 `tests/results/`，不會發佈。

## 2026-09 介面更新

首頁顯示最近球聚、當日最高分、最新賽果及總榜前三。設定、雲端詳細資料及操作紀錄集中在「更多」。試算會使用與正式總榜／單日榜相同的重算路徑，沒有更改計分公式。

儲存後會分別提示「已儲存本機」或「雲端同步成功」；雲端回讀需要核對該筆最新內容，而不只是比較數量。這不是完整的離線同步佇列，離線時仍應保留本機資料並匯出備份，恢復連線後再同步。

GitHub Pages 更新不會自動更新已安裝 iOS App 內的網頁程式。在 Mac 取得最新程式後執行 `npm ci`、`npm run cap:sync:ios`，再用 Xcode 重新建置安裝；不要先刪除含未同步記錄的 App。

## 參與開發

歡迎回報實際球局使用問題、提出計分公平性建議、改善手機操作及翻譯。提交前請閱讀 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

## 授權

本專案使用 [MIT License](LICENSE)。
