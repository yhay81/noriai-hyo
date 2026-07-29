# Stack

- Runtime: Cloudflare Workers
- API / rendering: Hono / Hono JSX
- Build and quality: Vite+ / TypeScript / Oxlint / Oxfmt / Vitest
- Persistence: Cloudflare D1
- Delivery: `noriai-hyo.yhay81.com` custom domain; `workers.dev` and preview URLs disabled
- Authentication: Better Authなし。予定単位のowner capability keyと回答単位のedit key

アカウント、メール、Cookieを不要にできる単発イベントの境界なので、Better Authは導入しません。継続チーム管理や請求が必要になった場合に再評価します。
