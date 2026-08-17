# 羽毛球個人積分排行榜

[English README](README.md) · [線上版本](https://kobo046.github.io/kobo/) · [iOS 安裝指南](IOS_APP_GUIDE.md)

這是一個為業餘羽毛球群組而設的手機優先雙打記分及個人排行榜。即使選手每場配搭不同拍檔，系統仍會記錄四位參賽者，並由完整比賽歷史重算每人的表現。

## 主要功能

- 手機即場輸入四位選手及比分
- 總排名與指定日期單日排名
- 編輯或刪除舊比賽後完整重算
- 比賽日期、場地、備註及比賽日總覽
- 選手改名、個人紀錄與拍檔統計
- JSON 備份、匯入及自動本機快照
- Supabase 多裝置同步及刪除標記
- GitHub Pages 網頁版及 Capacitor iOS App

## 計分方式

單日排名沿用類 Elo 計算，考慮勝負、比分差距及爆冷程度。總排名則計算最近 52 星期最佳 10 個比賽日，按每日名次取得 100、84、69、54 或 35 積分，再轉換成 5.00 至 10.00 顯示分數。不足三個比賽日的選手會標示為暫定。

## 本機執行

需要 Node.js 20 或以上：

```bash
git clone https://github.com/kobo046/kobo.git
cd kobo
npm ci
npm test
npx serve .
```

## Supabase 多人同步

未設定 Supabase 時，網站會使用瀏覽器 `localStorage`。設定 [`supabase-config.js`](supabase-config.js) 後，同一 `clubId` 的裝置會共用選手及比賽資料。完整步驟見 [SUPABASE_SETUP.md](SUPABASE_SETUP.md)。

目前簡易管理員密碼只會限制畫面操作，並非真正資料庫安全機制。公開或多人部署應改用 Supabase Auth 與嚴格 RLS；詳情見 [SECURITY.md](SECURITY.md)。

## 測試

```bash
npm test
npm run validate
```

測試涵蓋比分差、爆冷修正、單場上限、歷史重算、52 星期總榜、備份兼容、雲端合併、刪除標記及選手管理。

## 參與開發

歡迎回報實際球局使用問題、提出計分公平性建議、改善手機操作及翻譯。提交前請閱讀 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

## 授權

本專案使用 [MIT License](LICENSE)。
