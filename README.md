# webhook-manager

Cloudflare Workers 上で動作する、Discord Webhook への通知管理アプリケーションです。

外部サービスからの Webhook 受信や定期実行ジョブをトリガーにして、設定済みの Discord Webhook へメッセージを投稿します。

## 構成

```text
Hook / Timer
  -> Worker
  -> D1
  -> Discord Webhook

Admin
  -> Access
  -> Worker
  -> D1
```

### 使用技術

- Workers: Hook、Timer、Admin API、Discord 投稿処理のコア
- D1: 設定、既読状態、配信履歴の保存
- Access: Admin と D1 操作用 API の保護

D1 は Workers と Admin 以外から直接アクセスしない前提です。

## 機能

### Hook

外部から Worker のエンドポイントへ `POST` されたときに実行される機能です。

初期対応:

- Statuspage Webhook
  - Atlassian Statuspage 形式の Webhook payload を受信します。
  - payload を Discord Webhook 用メッセージへ変換して投稿します。

### Timer

Worker の定期実行で動作する機能です。

初期対応:

- RSS
  - 定期的に feed を取得します。
  - 未投稿の新規 item を Discord Webhook へ投稿します。

### Admin

データ管理用の Web UI です。

管理対象:

- Discord 投稿先
- Hook 設定
- Timer 設定
- RSS feed 状態
- 配信履歴

Admin は Cloudflare Access で保護します。

## データ設計

### `discord_destinations`

Discord の投稿先を表します。

Hook や Timer から直接 Webhook URL を持たず、投稿先として参照します。

| column | type | description |
| --- | --- | --- |
| `id` | text | 投稿先 ID |
| `name` | text | 管理用の表示名 |
| `webhook_url` | text | Discord Webhook URL |
| `thread_id` | text nullable | Discord forum / thread へ投稿する場合の thread ID |
| `username` | text nullable | Webhook 投稿時の表示名上書き |
| `avatar_url` | text nullable | Webhook 投稿時の avatar URL 上書き |
| `is_active` | integer | 有効状態 |
| `created_at` | text | 作成日時 |
| `updated_at` | text | 更新日時 |

### `hooks`

外部から `POST` される Hook 定義です。

| column | type | description |
| --- | --- | --- |
| `id` | text | Hook ID |
| `name` | text | 管理用の表示名 |
| `kind` | text | Hook 種別。初期値は `statuspage` |
| `path_token` | text | 公開エンドポイントに使う推測困難な token |
| `destination_id` | text | 投稿先 `discord_destinations.id` |
| `config_json` | text | 種別ごとの設定 JSON |
| `is_active` | integer | 有効状態 |
| `created_at` | text | 作成日時 |
| `updated_at` | text | 更新日時 |

想定エンドポイント:

```text
POST /hooks/:path_token
```

### `timers`

定期実行される Timer 定義です。

| column | type | description |
| --- | --- | --- |
| `id` | text | Timer ID |
| `name` | text | 管理用の表示名 |
| `kind` | text | Timer 種別。初期値は `rss` |
| `destination_id` | text | 投稿先 `discord_destinations.id` |
| `config_json` | text | 種別ごとの設定 JSON |
| `is_active` | integer | 有効状態 |
| `last_run_at` | text nullable | 最終実行日時 |
| `created_at` | text | 作成日時 |
| `updated_at` | text | 更新日時 |

Workers の Cron Trigger は実行入口として使い、実際にどの Timer を実行するかは D1 の `timers` を見て判断します。

### `rss_feeds`

RSS Timer が取得する feed の状態です。

| column | type | description |
| --- | --- | --- |
| `id` | text | Feed ID |
| `timer_id` | text | `timers.id` |
| `feed_url` | text | RSS / Atom feed URL |
| `title` | text nullable | feed title |
| `created_at` | text | 作成日時 |
| `updated_at` | text | 更新日時 |

### `rss_items`

RSS item の既読・投稿状態です。

| column | type | description |
| --- | --- | --- |
| `id` | text | Item ID |
| `feed_id` | text | `rss_feeds.id` |
| `guid` | text | item の GUID。GUID がない場合は link などから生成 |
| `link` | text nullable | item URL |
| `title` | text | item title |
| `published_at` | text nullable | item 公開日時 |
| `first_seen_at` | text | 初回検出日時 |
| `posted_at` | text nullable | Discord 投稿日時 |

`feed_id` と `guid` の組み合わせは一意にします。

### `deliveries`

Discord 投稿の履歴です。

Hook と Timer の両方で共通利用します。

| column | type | description |
| --- | --- | --- |
| `id` | text | Delivery ID |
| `source_type` | text | `hook` または `timer` |
| `source_id` | text | `hooks.id` または `timers.id` |
| `destination_id` | text | `discord_destinations.id` |
| `status` | text | `success`, `failed`, `skipped` |
| `discord_message_id` | text nullable | Discord message ID |
| `response_status` | integer nullable | Discord API response status |
| `error_message` | text nullable | 失敗理由 |
| `created_at` | text | 作成日時 |

Statuspage 専用の状態テーブルは持ちません。

## Discord 投稿先

Discord Webhook への投稿では、`discord_destinations.webhook_url` に対してリクエストします。

`thread_id` が設定されている場合は、Discord Webhook の `thread_id` query parameter として付与します。

```text
POST {webhook_url}?thread_id={thread_id}
```

`thread_id` が未設定の場合は、Webhook URL へそのまま投稿します。

## 変換ルール

Discord Webhook payload への変換ルールは、各 `kind` の実装でハードコードします。

Admin から Discord payload の構造を編集する機能は持ちません。

理由:

- kind ごとに壊れにくい出力を保証するため
- Discord payload の validation と preview を複雑にしないため
- 初期実装の管理画面を設定管理に集中させるため

### 可変にするもの

設定として変更できる範囲は、投稿先や挙動に関するものに限定します。

- 投稿先 `destination_id`
- 有効 / 無効
- Webhook 投稿時の `username`
- Webhook 投稿時の `avatar_url`
- RSS の最大投稿件数
- RSS の初回取得時の扱い

### ハードコードするもの

以下は kind ごとのコードで固定します。

- Discord payload の基本構造
- embed の field 構成
- 色
- タイトル生成
- description の組み立て
- payload サイズ制限への丸め
- Discord API エラー時の扱い

## Statuspage Hook

Atlassian Statuspage 形式の payload を受信し、Statuspage 用の固定変換ルールで Discord に投稿します。

変換方針:

- incident 名を embed title にする
- incident URL がある場合は embed URL にする
- 最新 update 本文を description にする
- status、impact、affected components を field に入れる
- 状態に応じて embed color を固定する

Statuspage の専用状態テーブルは作りません。

Statuspage は受信した payload をすべて Discord に投稿します。

重複防止、イベント種別による投稿制御、mention 付与は行いません。

## RSS Timer

定期的に RSS / Atom feed を取得し、新規 item を Discord に投稿します。

設定例:

```json
{
  "max_items_per_run": 5,
  "post_on_first_run": false
}
```

変換方針:

- item title を embed title にする
- link がある場合は embed URL にする
- summary がある場合は description にする
- published date がある場合は timestamp にする
- feed title を footer にする

初回取得時に大量投稿しないため、`post_on_first_run` の初期値は `false` とします。

## 実行フロー

### Hook

```text
POST /hooks/:path_token
  -> hooks から設定を取得
  -> is_active を確認
  -> kind ごとの検証と変換
  -> discord_destinations を取得
  -> Discord Webhook へ投稿
  -> deliveries に結果を保存
```

### Timer

```text
Cron Trigger
  -> timers から active な対象を取得
  -> kind ごとの runner を実行
  -> RSS feed を取得
  -> rss_items で新規 item を判定
  -> Discord Webhook へ投稿
  -> rss_items と deliveries に結果を保存
```

## Admin UI

Admin UI は、Cloudflare Access で保護します。

初期画面:

- Destinations
  - Discord 投稿先の作成、編集、無効化
  - テスト送信
- Hooks
  - Statuspage Hook の作成、編集、無効化
  - Hook URL の表示
  - 最近の配信履歴
- Timers
  - RSS Timer の作成、編集、無効化
  - feed 状態の表示
  - 最近の配信履歴
- Deliveries
  - 成功、失敗、skip の確認
  - Discord response の確認

## 初期実装順

1. D1 schema と migration
2. Discord 投稿先管理
3. Statuspage Hook
4. Delivery logging
5. RSS Timer
6. Admin UI
