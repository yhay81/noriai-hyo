# Decisions

## 2026-07-30 — One-event attendance and ride board

- Decision: 継続的なチーム連絡網を作らず、一つのスポーツ予定の出欠、空席、希望人数だけを扱う
- Reason: BAND、TeamHub、サークルスクエアの広い機能と競わず、LINE等の既存連絡先に一つのURLを流す短期ジョブだけを改善する
- Boundary: 公開配車募集、通知、ファイル、写真、位置情報、連絡先、緊急連絡は扱わない

## 2026-07-30 — Aggregate public view

- Decision: 回答URLは集計だけ、個別の呼び名とメモは管理URLだけに表示する
- Reason: チーム内共有URLが転送されても、児童名や家庭事情の露出を避ける
- Input guidance: 本名や児童名ではなく家庭の呼び名やイニシャルを求める

## 2026-07-30 — Capability URLs, no Better Auth

- Decision: Better Authを導入せず、予定ごとの管理鍵と回答ごとの編集鍵を発行する
- Reason: 一予定の利用に登録を要求せず、アカウント復旧や本人情報保有を避ける
- Boundary: 鍵はhash化して保存し、管理鍵はURL fragmentからBearerへ渡す

## 2026-07-30 — Short retention and canonical delivery

- Decision: 予定、回答、匿名イベントを21日以内に削除する
- Decision: 正規URLを`https://noriai-hyo.yhay81.com`とし、`workers.dev`とpreview URLを無効にする
- Reason: 一予定の調整後に履歴を残す必要はなく、運用責任と共有先を小さく保てる
