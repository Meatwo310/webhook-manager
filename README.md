# webhook-manager

Cloudflare Workers + D1 で動く Discord Webhook 管理アプリです。

## ローカル開発

依存関係をインストールします。

```txt
pnpm install
```

D1 のローカル DB に migration を適用します。

```txt
pnpm run db:migrate:local
```

開発サーバーを起動します。

```txt
pnpm run dev
```

ローカル D1 の SQL 実行には `db:execute:local` を使います。

```txt
pnpm run db:execute:local "SELECT name FROM sqlite_master WHERE type = 'table'"
```

Cron handler を含めて Wrangler のローカル環境で確認する場合は、次を使います。

```txt
pnpm run preview
```

`preview` では `wrangler dev --test-scheduled` を使うため、Cron の手動発火は次のように確認できます。

```txt
curl "http://localhost:8787/__scheduled?cron=*/10+*+*+*+*"
```

## デプロイ

このプロジェクトは Cron Trigger の `scheduled()` handler を使うため、Cloudflare Pages ではなく Cloudflare Workers としてデプロイします。

### 事前確認

```txt
pnpm run typecheck
pnpm run build
```

ビルド後は `dist/worker.js` と `dist/static/*` が生成されます。Wrangler は `wrangler.jsonc` の `main` と `assets.directory` を使って、Worker と静的ファイルをまとめてデプロイします。

### D1 database 作成

Cloudflare 側で D1 database を作成します。

```txt
wrangler d1 create webhook-manager
```

作成後に表示される `database_id` を `wrangler.jsonc` の `d1_databases[0].database_id` に設定してください。

### Remote migration

本番 D1 に migration を適用します。

```txt
pnpm run db:migrate:remote
```

### Deploy

```txt
pnpm run deploy
```

### Access 設定

Admin UI と内部 API は Cloudflare Access で保護してください。

- 保護する: `/`, `/api/*`
- 公開する: `/hooks/*`

Statuspage など外部サービスからの Webhook は `/hooks/:pathToken` に届くため、`/hooks/*` は Access の認証対象から外してください。

### Typegen

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
pnpm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```
