# のりあい表 public pilot

## Decision

- Status: 30-day public pilot
- Review deadline: 2026-08-29
- Investment decision: hold
- Target: LINE等で次の練習・試合の出欠と送迎を個別に確認している日本語の小規模スポーツチーム幹事
- Existing alternatives: BAND、TeamHub、サークルスクエア、Googleフォーム

広いチーム運営機能を再現せず、「登録なし・一予定だけ・公開は集計だけ・21日で消える」という狭い入口に実需要があるかを確かめます。

## Falsifiable outcome

- Continue: 実幹事3人以上、実予定5件以上、回答40件以上、配車入力のある予定3件以上、2予定以上を作った幹事2人以上
- Hold: 30日後も実予定2件未満、または回答10件未満、または配車入力のある予定が0件
- Automated QA、自己テスト、訪問だけのセッションは実利用に数えない

獲得は検索、Tool Shelf、幹事自身による既存チーム内への自然なURL共有に限定します。許可のないDM、メール、SNS投稿は行いません。

## Safety boundary

- 回答URLでは予定情報と集計だけを返し、個別の呼び名とメモを返さない
- 管理鍵と回答編集鍵はhash化し、管理鍵はURL fragmentからBearerへ渡す
- 本名、児童名、住所、電話番号、メール、位置情報、写真を求めない
- 1予定100回答、1端末1回答、1端末1日10予定
- 3つの異なる匿名セッションから報告された予定を非表示にする
- 通知や到達保証を持たず、緊急連絡・安全確認には使わない
