# のりあい表

スポーツの次の一予定について、出欠、車を出せる席、乗せてほしい人数を登録なしで集める共有表です。

- サービス: <https://noriai-hyo.yhay81.com>
- 使い方: <https://noriai-hyo.yhay81.com/guide>
- プライバシー: <https://noriai-hyo.yhay81.com/privacy>

## Product boundary

幹事は日付、集合、場所、競技、必要人数を入力し、回答URLと管理URLを受け取ります。回答URLは集計だけを公開し、呼び名と任意メモは管理鍵を持つ幹事だけが確認できます。回答者は同じ端末に保存した編集鍵で回答を上書きできます。

継続的なチーム連絡網、公開配車募集、通知、位置情報、連絡先、画像は扱いません。予定、回答、匿名操作イベントは21日後に自動削除します。緊急連絡や安全確認には使えません。

## Development

Node.js 24 LTSとnpmを使います。

```powershell
npm ci
npx wrangler d1 migrations apply noriai-hyo --local
npm run dev
```

検査:

```powershell
npm run release:check
npm run check
npm test
npm run build
npm audit --omit=dev
```

本番:

```powershell
npx wrangler d1 migrations apply noriai-hyo --remote
npm run deploy
npm run indexnow
npm run metrics
```

## Stack

Cloudflare Workers / D1、Hono JSX、Vite+、TypeScript。Better Authは使わず、予定ごとの256-bit owner capability keyと回答ごとの256-bit edit keyで権限を分離します。
