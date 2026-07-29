# Metrics

予定と回答の業務行を正本にし、訪問、URLコピー、管理画面表示、別日再訪だけを匿名イベントで補います。自動QAは`?qa=1`、WebDriver、`x-automated-qa`で除外します。

| Metric                       | Source                      | Meaning                  |
| ---------------------------- | --------------------------- | ------------------------ |
| `users`                      | distinct `visited` session  | 匿名訪問者               |
| `organizers`                 | distinct event creator      | 予定を作った匿名幹事     |
| `events_created`             | visible `events`            | 作成された実予定         |
| `links_copied`               | distinct event context      | 回答URLをコピーした予定  |
| `responses_saved`            | `responses`                 | 現在保存されている回答   |
| `respondents`                | distinct response session   | 回答した匿名端末         |
| `events_with_responses`      | response aggregation        | 1件以上回答がある予定    |
| `events_with_five_responses` | response aggregation        | 5件以上回答がある予定    |
| `events_with_carpool`        | ride aggregation            | 配車入力がある予定       |
| `seats_offered`              | attending offer responses   | 参加回答で出された空席   |
| `rides_needed`               | attending need responses    | 参加回答で希望された人数 |
| `events_closed`              | `events.status`             | 幹事が締め切った予定     |
| `repeat_organizers`          | creator aggregation         | 2予定以上作った匿名幹事  |
| `returned`                   | distinct `returned` session | 別日に再訪した匿名利用者 |

予定内容、呼び名、メモ、IPアドレス、User-Agentは操作イベントへ記録しません。ブラウザ生成UUID、操作名、予定IDまたは`home`、発生日だけを21日以内保存します。
