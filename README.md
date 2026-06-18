# 羽毛球個人積分排行榜

一個手機友善的羽毛球雙打即場記分與個人積分排行榜網站。預設會使用瀏覽器的 `localStorage`，填入 Supabase 設定後可升級成多人共用同一份資料。

## 本機打開

最簡單做法：

1. 直接用瀏覽器打開 `index.html`。
2. 或在專案資料夾開一個靜態伺服器：

```bash
npx serve .
```

也可以用 Python：

```bash
python -m http.server 8787
```

然後打開：

```text
http://127.0.0.1:8787/
```

## 測試

```bash
npm test
```

## GitHub Pages 部署

此專案是純靜態網站，`index.html` 內所有 CSS、JS、manifest 都使用相對路徑，例如：

- `styles.css?v=28`
- `cartoon-court-v10.css?v=28`
- `editorial-theme.css?v=28`
- `storage.js?v=28`
- `scoring.js?v=28`
- `render.js?v=28`
- `events.js?v=28`
- `auth.js?v=28`
- `app.js?v=28`
- `manifest.webmanifest`

所以部署到 GitHub Pages 的子路徑，例如 `/kobo/`，可以正常運作。

## Supabase 多人同步

網站已包含 Supabase 同步 adapter：

- `supabase-config.js`
- `cloud-storage.js`
- `supabase-schema.sql`
- `supabase-simple-passcode.sql`

未填 Supabase 設定前，網站會顯示本機模式。設定好 Supabase 後，同一個 `clubId` 的所有裝置會共用同一份選手、比賽和排行榜資料。

目前版本支援簡易只讀 / 管理員模式：一般訪客可查看資料，輸入管理員密碼後才會顯示新增、修改和刪除功能。這是前端方便鎖，不是高安全資料庫權限；如要真正防止技術使用者寫入，仍需要 Supabase Auth / RLS。

近期改善包括比賽日總覽、管理員模式收合、快速套用上一場選手、交換 A/B 隊、重設分數、本機操作紀錄和 editorial theme 視覺更新。

詳細步驟見 `SUPABASE_SETUP.md`。

### 使用 GitHub Actions

本 repo 已包含 `.github/workflows/pages.yml`。設定方法：

1. 到 GitHub repo：`Settings`。
2. 左邊選 `Pages`。
3. `Build and deployment` 的 `Source` 選 `GitHub Actions`。
4. 之後每次 push 到 `main` 都會自動部署。

### 使用分支部署

如果不用 GitHub Actions，也可以：

1. 到 GitHub repo：`Settings`。
2. 左邊選 `Pages`。
3. `Build and deployment` 的 `Source` 選 `Deploy from a branch`。
4. Branch 選 `main`，folder 選 `/ (root)`。
5. 儲存後等待 GitHub Pages 建置。

## 部署網址格式

如果 repository 是 `kobo046/kobo`，成功部署後網址通常是：

```text
https://kobo046.github.io/kobo/
```

## PWA / 離線使用

目前已有 `manifest.webmanifest`，足夠讓手機瀏覽器辨識網站名稱、顏色、啟動畫面模式。

暫時不建議立即加入 service worker，原因是現在資料存在 `localStorage`，而網站仍在快速修改中。太早加入離線快取，手機可能會一直載入舊版 JS/CSS。建議等 Supabase 多人同步版本穩定後，再加入 service worker，並設計清楚的快取更新策略。
