# webhook-manager

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

## デプロイ

```txt
pnpm run deploy
```

本番環境へデプロイする前に、`wrangler.jsonc` の `d1_databases[0].database_id` を Cloudflare 側で作成した D1 database ID に差し替えてください。

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
pnpm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```
