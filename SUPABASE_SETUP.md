# Supabase 多人同步設定

這個網站已支援 Supabase 雲端同步，但預設仍是本機模式。未填 Supabase 設定前，資料仍會存在每部裝置自己的 `localStorage`。

## 1. 建立 Supabase project

1. 到 Supabase 建立一個 project。
2. 打開 `SQL Editor`。
3. 將 `supabase-schema.sql` 全部內容貼上並執行。

這會建立：

- `badminton_clubs`
- `badminton_players`
- `badminton_matches`

目前版本使用簡易管理員密碼：知道網址的人可以查看資料，輸入管理員密碼後才會看到新增、編輯和刪除功能。這是前端方便鎖，不是高安全資料庫權限。

## 2. 填入網站設定

打開 `supabase-config.js`：

```js
window.BADMINTON_SUPABASE_CONFIG = {
  url: "你的 Supabase Project URL",
  anonKey: "你的 Supabase anon public key",
  clubId: "default"
};
```

`clubId` 是群組 ID。多個羽毛球群組可以用不同 ID，例如：

- `tin-shui-wai`
- `friday-night`
- `default`

同一個 `clubId` 的人會看到同一份選手和比賽資料。

## 3. 部署到 GitHub Pages

改好 `supabase-config.js` 後 commit 並 push 到 GitHub。GitHub Pages 更新後，其他人打開同一個網址就會讀取同一份 Supabase 資料。

## 4. 匯入舊資料

1. 在舊裝置打開網站。
2. 按「匯出備份」。
3. 在已設定 Supabase 的網站按「匯入備份」。
4. 匯入後資料會寫入 Supabase，其他裝置重新打開或稍等同步後會看到同一份分數。

## 5. 注意事項

- `anonKey` 是 Supabase 前端公開 key，不是 service role key。
- 不要把 Supabase `service_role` key 放入網站。
- 第一階段採用最後寫入為準，同一時間多人改同一場比賽時，最後儲存的一方會覆蓋前一方。
- 現時管理員密碼是前端簡易鎖，適合防止普通訪客誤改；想做真正嚴格權限時，下一階段才加入 Supabase Auth、admin/member 角色和操作紀錄。

## 6. 管理員密碼 / 只讀模式

現在網站支援兩種權限：

- 一般訪客：不用登入，只可以查看排行榜、選手、比賽歷史和匯出備份。
- 管理員：輸入管理員密碼後，可以新增選手、新增比賽、編輯、刪除、匯入備份、上傳雲端。

使用方法：

1. 打開網站 `https://kobo046.github.io/kobo/`。
2. 在「管理員模式」輸入管理員密碼。
3. 成功後會顯示新增比賽、新增選手、編輯和刪除按鈕。
4. 同一部手機或電腦會記住管理員模式；按「退出管理員模式」後會回到只讀。

如果你之前已經執行過 Supabase Auth/RLS 的 SQL，前端密碼雖然會解鎖畫面，但雲端寫入可能仍被資料庫拒絕。這時在 Supabase `SQL Editor` 執行 `supabase-simple-passcode.sql`，回復成簡易密碼版可用的 public write policy。

重要：這個密碼模式是方便使用，不是銀行級安全。真正要防止懂技術的人繞過前端，需要重新使用 Supabase Auth / RLS。
