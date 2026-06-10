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

第一階段是無登入共享版：知道網址的人可以共同查看和修改同一份資料。之後如要限制權限，可以再加 Supabase Auth 和更嚴格的 RLS policy。

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
- 想做更嚴格權限時，下一階段應加入登入、admin/member 角色和操作紀錄。

## 6. 管理員登入 / 只讀模式

現在網站支援兩種權限：

- 一般訪客：不用登入，只可以查看排行榜、選手、比賽歷史和匯出備份。
- 管理員 / 編輯者：用 Email magic link 登入後，可以新增選手、新增比賽、編輯、刪除、匯入備份、上傳雲端。

請在 Supabase 做以下設定：

1. 到 `Authentication` > `Providers`，確認 `Email` 已啟用。
2. 到 `Authentication` > `URL Configuration`：
   - `Site URL` 設為 `https://kobo046.github.io/kobo/`
   - `Redirect URLs` 加入 `https://kobo046.github.io/kobo/`
3. 先到網站輸入你的管理員 Email，按「寄出登入連結」，再到 Email 按連結登入一次。
4. 回到 Supabase `SQL Editor`，打開 `supabase-auth-rls.sql`，把最後的 `your-email@example.com` 改成你的 Email，然後執行。
5. 重新整理網站。登入後如果顯示「權限：管理員」，就可以修改資料；其他人只會是只讀模式。

之後要加其他人做可編輯者，先叫對方登入一次，再在 `supabase-auth-rls.sql` 最底部用 `friend@example.com` 範例改成對方 Email 和 `editor` role 執行。

重要：只改前端不能真正防止別人寫入。一定要執行 `supabase-auth-rls.sql`，把舊的 `public write` policy 換成 admin/editor 才可寫入。
