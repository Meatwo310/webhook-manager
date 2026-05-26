import { Hono } from 'hono'
import {
  createDelivery,
  createDiscordDestination,
  createHook,
  createRssFeed,
  createTimer,
  deleteRssFeed,
  disableDiscordDestination,
  disableHook,
  disableTimer,
  getActiveHookByPathToken,
  getDiscordDestination,
  getHook,
  getTimer,
  listDiscordDestinations,
  listDeliveries,
  listHooks,
  listRssFeedsByTimerId,
  listTimers,
  updateRssFeed,
  updateDiscordDestination,
  updateHook,
  updateTimer,
  type CreateDiscordDestinationInput,
  type CreateHookInput,
  type CreateRssFeedInput,
  type CreateTimerInput,
  type DiscordDestination as DbDiscordDestination,
  type ListDeliveriesOptions,
  type SourceType,
  type UpdateDiscordDestinationInput,
  type UpdateHookInput,
  type UpdateRssFeedInput,
  type UpdateTimerInput,
} from './db'
import {
  postDiscordWebhook,
  type DiscordDestination as WebhookDiscordDestination,
  type DiscordWebhookPayload,
} from './discord'
import { buildStatuspageDiscordPayload } from './hooks'
import { jsonError, parseBooleanFlag, type AppBindings } from './http'
import { renderer } from './renderer'
import { runRssTimers } from './timers'

const app = new Hono<AppBindings>();

app.use(renderer)

app.get('/', (c) => {
  return c.render(<AdminPage />)
})

function AdminPage() {
  return (
    <main class="app-shell">
      <header class="topbar">
        <div>
          <h1>webhook-manager</h1>
          <p>Discord destinations, hooks, RSS timers, and deliveries</p>
        </div>
        <div class="topbar-actions">
          <label class="theme-picker">
            <span>Theme</span>
            <select data-choose-theme data-key="wm-theme" aria-label="Theme">
              <option value="">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <button type="button" class="icon-button" data-action="refresh" title="Refresh" aria-label="Refresh">
            ↻
          </button>
          <button type="button" class="primary-button" data-action="run-rss">
            Run RSS
          </button>
        </div>
      </header>

      <section class="metrics" aria-label="Overview">
        <div>
          <span class="metric-value" data-metric="destinations">0</span>
          <span class="metric-label">Destinations</span>
        </div>
        <div>
          <span class="metric-value" data-metric="hooks">0</span>
          <span class="metric-label">Hooks</span>
        </div>
        <div>
          <span class="metric-value" data-metric="timers">0</span>
          <span class="metric-label">Timers</span>
        </div>
        <div>
          <span class="metric-value" data-metric="deliveries">0</span>
          <span class="metric-label">Recent deliveries</span>
        </div>
      </section>

      <nav class="tabs" aria-label="Admin sections">
        <button type="button" class="tab is-active" data-tab-target="destinations">Destinations</button>
        <button type="button" class="tab" data-tab-target="hooks">Hooks</button>
        <button type="button" class="tab" data-tab-target="timers">Timers</button>
        <button type="button" class="tab" data-tab-target="deliveries">Deliveries</button>
      </nav>

      <p class="notice" data-status role="status"></p>

      <section class="panel is-active" data-tab-panel="destinations">
        <div class="panel-header">
          <h2>Destinations</h2>
        </div>
        <form class="form-grid" data-form="destination">
          <label>
            <span>Name</span>
            <input name="name" autocomplete="off" required />
          </label>
          <label class="wide">
            <span>Webhook URL</span>
            <input name="webhookUrl" type="url" autocomplete="off" required />
          </label>
          <label>
            <span>Thread ID</span>
            <input name="threadId" autocomplete="off" />
          </label>
          <label>
            <span>Username</span>
            <input name="username" autocomplete="off" />
          </label>
          <label>
            <span>Avatar URL</span>
            <input name="avatarUrl" type="url" autocomplete="off" />
          </label>
          <label class="check-row">
            <input name="isActive" type="checkbox" checked />
            <span>Active</span>
          </label>
          <div class="form-actions">
            <button type="submit" class="primary-button">Create</button>
          </div>
        </form>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Webhook</th>
                <th>Thread</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody data-list="destinations"></tbody>
          </table>
        </div>
      </section>

      <section class="panel" data-tab-panel="hooks">
        <div class="panel-header">
          <h2>Hooks</h2>
        </div>
        <form class="form-grid" data-form="hook">
          <label>
            <span>Name</span>
            <input name="name" autocomplete="off" required />
          </label>
          <label>
            <span>Destination</span>
            <select name="destinationId" required></select>
          </label>
          <label class="wide token-row">
            <span>Path token</span>
            <input name="pathToken" autocomplete="off" required />
            <button type="button" class="icon-button" data-action="generate-token" title="Generate token" aria-label="Generate token">
              ✦
            </button>
          </label>
          <label class="wide">
            <span>Config JSON</span>
            <textarea name="configJson" rows={3}>{'{}'}</textarea>
          </label>
          <label class="check-row">
            <input name="isActive" type="checkbox" checked />
            <span>Active</span>
          </label>
          <div class="form-actions">
            <button type="submit" class="primary-button">Create</button>
          </div>
        </form>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Kind</th>
                <th>Endpoint</th>
                <th>Destination</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody data-list="hooks"></tbody>
          </table>
        </div>
      </section>

      <section class="panel" data-tab-panel="timers">
        <div class="panel-header">
          <h2>Timers</h2>
        </div>
        <form class="form-grid" data-form="timer">
          <label>
            <span>Name</span>
            <input name="name" autocomplete="off" required />
          </label>
          <label>
            <span>Destination</span>
            <select name="destinationId" required></select>
          </label>
          <label>
            <span>Max items</span>
            <input name="maxItems" type="number" min="1" max="20" value="5" required />
          </label>
          <label class="check-row">
            <input name="postOnFirstRun" type="checkbox" />
            <span>Post first run</span>
          </label>
          <label class="check-row">
            <input name="isActive" type="checkbox" checked />
            <span>Active</span>
          </label>
          <div class="form-actions">
            <button type="submit" class="primary-button">Create</button>
          </div>
        </form>
        <form class="form-grid compact" data-form="feed">
          <label>
            <span>Timer</span>
            <select name="timerId" required></select>
          </label>
          <label class="wide">
            <span>Feed URL</span>
            <input name="feedUrl" type="url" autocomplete="off" required />
          </label>
          <label>
            <span>Title</span>
            <input name="title" autocomplete="off" />
          </label>
          <div class="form-actions">
            <button type="submit" class="primary-button">Add feed</button>
          </div>
        </form>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Destination</th>
                <th>Config</th>
                <th>Feeds</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody data-list="timers"></tbody>
          </table>
        </div>
        <div class="subsection-header">
          <h3>Feeds</h3>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timer</th>
                <th>Title</th>
                <th>URL</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody data-list="feeds"></tbody>
          </table>
        </div>
      </section>

      <section class="panel" data-tab-panel="deliveries">
        <div class="panel-header">
          <h2>Deliveries</h2>
          <div class="filters">
            <select data-filter="sourceType">
              <option value="">All sources</option>
              <option value="hook">Hooks</option>
              <option value="timer">Timers</option>
            </select>
            <button type="button" class="icon-button" data-action="refresh-deliveries" title="Refresh deliveries" aria-label="Refresh deliveries">
              ↻
            </button>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Created</th>
                <th>Source</th>
                <th>Destination</th>
                <th>Status</th>
                <th>Response</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody data-list="deliveries"></tbody>
          </table>
        </div>
      </section>

      <script src="/static/theme-change.js"></script>
      <script src="/static/admin.js" type="module"></script>
    </main>
  )
}

app.get('/api/destinations', async (c) => {
  const destinations = await listDiscordDestinations(c.env.DB)

  return c.json({ destinations })
})

app.post('/api/destinations', async (c) => {
  const body = await readJson(c.req.raw)
  const input = parseDestinationInput(body, true)

  if (!input.ok) {
    return jsonError(c, 400, 'bad_request', input.message)
  }

  const destination = await createDiscordDestination(c.env.DB, input.value)

  return c.json({ destination }, 201)
})

app.get('/api/destinations/:id', async (c) => {
  const destination = await getDiscordDestination(c.env.DB, c.req.param('id'))

  if (!destination) {
    return jsonError(c, 404, 'not_found', 'Discord destination was not found.')
  }

  return c.json({ destination })
})

app.patch('/api/destinations/:id', async (c) => {
  const body = await readJson(c.req.raw)
  const input = parseDestinationInput(body, false)

  if (!input.ok) {
    return jsonError(c, 400, 'bad_request', input.message)
  }

  const destination = await updateDiscordDestination(c.env.DB, c.req.param('id'), input.value)

  if (!destination) {
    return jsonError(c, 404, 'not_found', 'Discord destination was not found.')
  }

  return c.json({ destination })
})

app.delete('/api/destinations/:id', async (c) => {
  const destination = await disableDiscordDestination(c.env.DB, c.req.param('id'))

  if (!destination) {
    return jsonError(c, 404, 'not_found', 'Discord destination was not found.')
  }

  return c.json({ destination })
})

app.post('/api/destinations/:id/test', async (c) => {
  const destination = await getDiscordDestination(c.env.DB, c.req.param('id'))

  if (!destination) {
    return jsonError(c, 404, 'not_found', 'Discord destination was not found.')
  }

  if (!destination.isActive) {
    return jsonError(c, 409, 'inactive', 'Discord destination is inactive.')
  }

  const result = await postDiscordWebhook(toWebhookDestination(destination), {
    content: `webhook-manager test message: ${new Date().toISOString()}`,
  })

  return c.json({ result }, result.ok ? 200 : 502)
})

app.get('/api/hooks', async (c) => {
  const hooks = await listHooks(c.env.DB)

  return c.json({ hooks })
})

app.post('/api/hooks', async (c) => {
  const body = await readJson(c.req.raw)
  const input = parseHookInput(body, true)

  if (!input.ok) {
    return jsonError(c, 400, 'bad_request', input.message)
  }

  const destination = await getDiscordDestination(c.env.DB, input.value.destinationId)
  if (!destination) {
    return jsonError(c, 400, 'bad_request', 'destinationId does not exist.')
  }

  const hook = await createHook(c.env.DB, input.value)

  return c.json({ hook, url: `/hooks/${hook.pathToken}` }, 201)
})

app.patch('/api/hooks/:id', async (c) => {
  const body = await readJson(c.req.raw)
  const input = parseHookInput(body, false)

  if (!input.ok) {
    return jsonError(c, 400, 'bad_request', input.message)
  }

  if (input.value.destinationId) {
    const destination = await getDiscordDestination(c.env.DB, input.value.destinationId)
    if (!destination) {
      return jsonError(c, 400, 'bad_request', 'destinationId does not exist.')
    }
  }

  const hook = await updateHook(c.env.DB, c.req.param('id'), input.value)

  if (!hook) {
    return jsonError(c, 404, 'not_found', 'Hook was not found.')
  }

  return c.json({ hook, url: `/hooks/${hook.pathToken}` })
})

app.delete('/api/hooks/:id', async (c) => {
  const hook = await disableHook(c.env.DB, c.req.param('id'))

  if (!hook) {
    return jsonError(c, 404, 'not_found', 'Hook was not found.')
  }

  return c.json({ hook })
})

app.get('/api/hooks/:id/deliveries', async (c) => {
  const hook = await getHook(c.env.DB, c.req.param('id'))

  if (!hook) {
    return jsonError(c, 404, 'not_found', 'Hook was not found.')
  }

  const options = parseDeliveryListOptions(c.req.query(), {
    sourceType: 'hook',
    sourceId: hook.id,
  })

  if (!options.ok) {
    return jsonError(c, 400, 'bad_request', options.message)
  }

  const deliveries = await listDeliveries(c.env.DB, options.value)

  return c.json({ deliveries })
})

app.get('/api/deliveries', async (c) => {
  const options = parseDeliveryListOptions(c.req.query())

  if (!options.ok) {
    return jsonError(c, 400, 'bad_request', options.message)
  }

  const deliveries = await listDeliveries(c.env.DB, options.value)

  return c.json({ deliveries })
})

app.get('/api/timers', async (c) => {
  const timers = await listTimers(c.env.DB)

  return c.json({ timers })
})

app.post('/api/timers', async (c) => {
  const body = await readJson(c.req.raw)
  const input = parseTimerInput(body, true)

  if (!input.ok) {
    return jsonError(c, 400, 'bad_request', input.message)
  }

  const destination = await getDiscordDestination(c.env.DB, input.value.destinationId)
  if (!destination) {
    return jsonError(c, 400, 'bad_request', 'destinationId does not exist.')
  }

  const timer = await createTimer(c.env.DB, input.value)

  return c.json({ timer }, 201)
})

app.get('/api/timers/:id', async (c) => {
  const timer = await getTimer(c.env.DB, c.req.param('id'))

  if (!timer) {
    return jsonError(c, 404, 'not_found', 'Timer was not found.')
  }

  return c.json({ timer })
})

app.patch('/api/timers/:id', async (c) => {
  const body = await readJson(c.req.raw)
  const input = parseTimerInput(body, false)

  if (!input.ok) {
    return jsonError(c, 400, 'bad_request', input.message)
  }

  if (input.value.destinationId) {
    const destination = await getDiscordDestination(c.env.DB, input.value.destinationId)
    if (!destination) {
      return jsonError(c, 400, 'bad_request', 'destinationId does not exist.')
    }
  }

  const timer = await updateTimer(c.env.DB, c.req.param('id'), input.value)

  if (!timer) {
    return jsonError(c, 404, 'not_found', 'Timer was not found.')
  }

  return c.json({ timer })
})

app.delete('/api/timers/:id', async (c) => {
  const timer = await disableTimer(c.env.DB, c.req.param('id'))

  if (!timer) {
    return jsonError(c, 404, 'not_found', 'Timer was not found.')
  }

  return c.json({ timer })
})

app.get('/api/timers/:id/feeds', async (c) => {
  const timer = await getTimer(c.env.DB, c.req.param('id'))

  if (!timer) {
    return jsonError(c, 404, 'not_found', 'Timer was not found.')
  }

  const feeds = await listRssFeedsByTimerId(c.env.DB, timer.id)

  return c.json({ feeds })
})

app.post('/api/timers/:id/feeds', async (c) => {
  const timer = await getTimer(c.env.DB, c.req.param('id'))

  if (!timer) {
    return jsonError(c, 404, 'not_found', 'Timer was not found.')
  }

  const body = await readJson(c.req.raw)
  const input = parseRssFeedInput(body, timer.id, true)

  if (!input.ok) {
    return jsonError(c, 400, 'bad_request', input.message)
  }

  const feed = await createRssFeed(c.env.DB, input.value)

  return c.json({ feed }, 201)
})

app.patch('/api/rss-feeds/:id', async (c) => {
  const body = await readJson(c.req.raw)
  const input = parseRssFeedInput(body, undefined, false)

  if (!input.ok) {
    return jsonError(c, 400, 'bad_request', input.message)
  }

  const feed = await updateRssFeed(c.env.DB, c.req.param('id'), input.value)

  if (!feed) {
    return jsonError(c, 404, 'not_found', 'RSS feed was not found.')
  }

  return c.json({ feed })
})

app.delete('/api/rss-feeds/:id', async (c) => {
  const deleted = await deleteRssFeed(c.env.DB, c.req.param('id'))

  if (!deleted) {
    return jsonError(c, 404, 'not_found', 'RSS feed was not found.')
  }

  return c.json({ ok: true })
})

app.post('/api/timers/rss/run', async (c) => {
  const result = await runRssTimers(c.env.DB)

  return c.json({ result })
})

app.post('/hooks/:pathToken', async (c) => {
  const hook = await getActiveHookByPathToken(c.env.DB, c.req.param('pathToken'))

  if (!hook) {
    return jsonError(c, 404, 'not_found', 'Hook was not found.')
  }

  if (hook.kind !== 'statuspage') {
    return jsonError(c, 422, 'unsupported_kind', `Unsupported hook kind: ${hook.kind}`)
  }

  const body = await readJson(c.req.raw)
  const payload = buildStatuspageDiscordPayload(body)

  if (!payload) {
    return jsonError(c, 400, 'bad_request', 'Invalid Statuspage payload.')
  }

  const destination = await getDiscordDestination(c.env.DB, hook.destinationId)
  if (!destination || !destination.isActive) {
    await createDelivery(c.env.DB, {
      sourceType: 'hook',
      sourceId: hook.id,
      destinationId: hook.destinationId,
      status: 'skipped',
      errorMessage: 'Destination was not found or inactive.',
    })

    return jsonError(c, 409, 'inactive', 'Discord destination is not available.')
  }

  const result = await postDiscordWebhook(
    toWebhookDestination(destination),
    payload as unknown as DiscordWebhookPayload,
  )
  const delivery = await createDelivery(c.env.DB, {
    sourceType: 'hook',
    sourceId: hook.id,
    destinationId: destination.id,
    status: result.ok ? 'success' : 'failed',
    responseStatus: result.status,
    errorMessage: result.error ?? (result.ok ? null : result.body),
  })

  if (!result.ok) {
    return c.json({ result, delivery }, 502)
  }

  return c.json({ result, delivery })
})

export default {
  fetch: app.fetch,
  scheduled: async (_controller, env) => {
    await runRssTimers(env.DB)
  },
} satisfies ExportedHandler<CloudflareBindings>

type ValidationResult<T> = { ok: true; value: T } | { ok: false; message: string }

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

function parseDestinationInput(
  value: unknown,
  requireFields: true,
): ValidationResult<CreateDiscordDestinationInput>
function parseDestinationInput(
  value: unknown,
  requireFields: false,
): ValidationResult<UpdateDiscordDestinationInput>
function parseDestinationInput(
  value: unknown,
  requireFields: boolean,
): ValidationResult<CreateDiscordDestinationInput | UpdateDiscordDestinationInput> {
  if (!isRecord(value)) {
    return { ok: false, message: 'Request body must be a JSON object.' }
  }

  const name = getString(value.name)
  const webhookUrl = getString(value.webhookUrl) ?? getString(value.webhook_url)
  const isActive = parseBooleanFlag(value.isActive ?? value.is_active)

  if (requireFields && !name) {
    return { ok: false, message: 'name is required.' }
  }

  if (requireFields && !webhookUrl) {
    return { ok: false, message: 'webhookUrl is required.' }
  }

  if (webhookUrl && !isHttpUrl(webhookUrl)) {
    return { ok: false, message: 'webhookUrl must be an HTTP URL.' }
  }

  if ((value.isActive !== undefined || value.is_active !== undefined) && isActive === undefined) {
    return { ok: false, message: 'isActive must be boolean-like.' }
  }

  return {
    ok: true,
    value: {
      ...(name ? { name } : {}),
      ...(webhookUrl ? { webhookUrl } : {}),
      threadId: getNullableString(value.threadId ?? value.thread_id),
      username: getNullableString(value.username),
      avatarUrl: getNullableString(value.avatarUrl ?? value.avatar_url),
      ...(isActive !== undefined ? { isActive: isActive === 1 } : {}),
    },
  }
}

function parseHookInput(value: unknown, requireFields: true): ValidationResult<CreateHookInput>
function parseHookInput(value: unknown, requireFields: false): ValidationResult<UpdateHookInput>
function parseHookInput(
  value: unknown,
  requireFields: boolean,
): ValidationResult<CreateHookInput | UpdateHookInput> {
  if (!isRecord(value)) {
    return { ok: false, message: 'Request body must be a JSON object.' }
  }

  const name = getString(value.name)
  const kind = getString(value.kind) ?? 'statuspage'
  const pathToken = getString(value.pathToken) ?? getString(value.path_token)
  const destinationId = getString(value.destinationId) ?? getString(value.destination_id)
  const isActive = parseBooleanFlag(value.isActive ?? value.is_active)
  const configJson = normalizeConfigJson(value.configJson ?? value.config_json)

  if (requireFields && !name) {
    return { ok: false, message: 'name is required.' }
  }

  if (kind !== 'statuspage') {
    return { ok: false, message: 'Only statuspage hooks are supported for now.' }
  }

  if (requireFields && !pathToken) {
    return { ok: false, message: 'pathToken is required.' }
  }

  if (pathToken && !/^[A-Za-z0-9_-]{16,}$/.test(pathToken)) {
    return { ok: false, message: 'pathToken must be at least 16 URL-safe characters.' }
  }

  if (requireFields && !destinationId) {
    return { ok: false, message: 'destinationId is required.' }
  }

  if ((value.isActive !== undefined || value.is_active !== undefined) && isActive === undefined) {
    return { ok: false, message: 'isActive must be boolean-like.' }
  }

  if (!configJson.ok) {
    return { ok: false, message: configJson.message }
  }

  return {
    ok: true,
    value: {
      ...(name ? { name } : {}),
      kind,
      ...(pathToken ? { pathToken } : {}),
      ...(destinationId ? { destinationId } : {}),
      ...(configJson.value !== undefined ? { configJson: configJson.value } : {}),
      ...(isActive !== undefined ? { isActive: isActive === 1 } : {}),
    },
  }
}

function parseTimerInput(value: unknown, requireFields: true): ValidationResult<CreateTimerInput>
function parseTimerInput(value: unknown, requireFields: false): ValidationResult<UpdateTimerInput>
function parseTimerInput(
  value: unknown,
  requireFields: boolean,
): ValidationResult<CreateTimerInput | UpdateTimerInput> {
  if (!isRecord(value)) {
    return { ok: false, message: 'Request body must be a JSON object.' }
  }

  const name = getString(value.name)
  const kind = getString(value.kind) ?? 'rss'
  const destinationId = getString(value.destinationId) ?? getString(value.destination_id)
  const isActive = parseBooleanFlag(value.isActive ?? value.is_active)
  const lastRunAt = getNullableString(value.lastRunAt ?? value.last_run_at)
  const configJson = normalizeConfigJson(value.configJson ?? value.config_json)

  if (requireFields && !name) {
    return { ok: false, message: 'name is required.' }
  }

  if (kind !== 'rss') {
    return { ok: false, message: 'Only rss timers are supported for now.' }
  }

  if (requireFields && !destinationId) {
    return { ok: false, message: 'destinationId is required.' }
  }

  if ((value.isActive !== undefined || value.is_active !== undefined) && isActive === undefined) {
    return { ok: false, message: 'isActive must be boolean-like.' }
  }

  if (lastRunAt && Number.isNaN(Date.parse(lastRunAt))) {
    return { ok: false, message: 'lastRunAt must be an ISO-compatible datetime.' }
  }

  if (!configJson.ok) {
    return { ok: false, message: configJson.message }
  }

  return {
    ok: true,
    value: {
      ...(name ? { name } : {}),
      kind,
      ...(destinationId ? { destinationId } : {}),
      ...(configJson.value !== undefined ? { configJson: configJson.value } : {}),
      ...(isActive !== undefined ? { isActive: isActive === 1 } : {}),
      ...(lastRunAt !== undefined ? { lastRunAt } : {}),
    },
  }
}

function parseRssFeedInput(
  value: unknown,
  timerId: string,
  requireFields: true,
): ValidationResult<CreateRssFeedInput>
function parseRssFeedInput(
  value: unknown,
  timerId: undefined,
  requireFields: false,
): ValidationResult<UpdateRssFeedInput>
function parseRssFeedInput(
  value: unknown,
  timerId: string | undefined,
  requireFields: boolean,
): ValidationResult<CreateRssFeedInput | UpdateRssFeedInput> {
  if (!isRecord(value)) {
    return { ok: false, message: 'Request body must be a JSON object.' }
  }

  const feedUrl = getString(value.feedUrl) ?? getString(value.feed_url)
  const title = getNullableString(value.title)

  if (requireFields && !feedUrl) {
    return { ok: false, message: 'feedUrl is required.' }
  }

  if (feedUrl && !isHttpUrl(feedUrl)) {
    return { ok: false, message: 'feedUrl must be an HTTP URL.' }
  }

  return {
    ok: true,
    value: {
      ...(timerId ? { timerId } : {}),
      ...(feedUrl ? { feedUrl } : {}),
      ...(title !== undefined ? { title } : {}),
    },
  }
}

function normalizeConfigJson(value: unknown): ValidationResult<string | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined }
  }

  if (typeof value === 'string') {
    try {
      JSON.parse(value)
      return { ok: true, value }
    } catch {
      return { ok: false, message: 'configJson must be valid JSON.' }
    }
  }

  try {
    return { ok: true, value: JSON.stringify(value) }
  } catch {
    return { ok: false, message: 'configJson must be serializable.' }
  }
}

function parseDeliveryListOptions(
  query: Record<string, string | string[]>,
  enforced: Pick<ListDeliveriesOptions, 'sourceType' | 'sourceId'> = {},
): ValidationResult<ListDeliveriesOptions> {
  const sourceType =
    enforced.sourceType ??
    parseSourceType(getQueryString(query, 'sourceType') ?? getQueryString(query, 'source_type'))
  const sourceId = enforced.sourceId ?? getQueryString(query, 'sourceId') ?? getQueryString(query, 'source_id')
  const destinationId = getQueryString(query, 'destinationId') ?? getQueryString(query, 'destination_id')
  const limit = parsePositiveInteger(getQueryString(query, 'limit'))
  const offset = parseNonNegativeInteger(getQueryString(query, 'offset'))

  if (sourceType === false) {
    return { ok: false, message: 'sourceType must be hook or timer.' }
  }

  if (limit === false) {
    return { ok: false, message: 'limit must be a positive integer.' }
  }

  if (offset === false) {
    return { ok: false, message: 'offset must be a non-negative integer.' }
  }

  return {
    ok: true,
    value: {
      ...(sourceType ? { sourceType } : {}),
      ...(sourceId ? { sourceId } : {}),
      ...(destinationId ? { destinationId } : {}),
      ...(limit !== undefined ? { limit } : {}),
      ...(offset !== undefined ? { offset } : {}),
    },
  }
}

function parseSourceType(value: string | undefined): SourceType | undefined | false {
  if (value === undefined) {
    return undefined
  }

  return value === 'hook' || value === 'timer' ? value : false
}

function parsePositiveInteger(value: string | undefined): number | undefined | false {
  if (value === undefined) {
    return undefined
  }

  const numberValue = Number(value)
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : false
}

function parseNonNegativeInteger(value: string | undefined): number | undefined | false {
  if (value === undefined) {
    return undefined
  }

  const numberValue = Number(value)
  return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : false
}

function getQueryString(query: Record<string, string | string[]>, key: string): string | undefined {
  const value = query[key]
  return Array.isArray(value) ? value[0] : value
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

function getNullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null
  }

  return value === undefined ? undefined : getString(value) ?? null
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function toWebhookDestination(destination: DbDiscordDestination): WebhookDiscordDestination {
  return {
    id: destination.id,
    name: destination.name,
    webhook_url: destination.webhookUrl,
    thread_id: destination.threadId,
    username: destination.username,
    avatar_url: destination.avatarUrl,
    is_active: destination.isActive ? 1 : 0,
    created_at: destination.createdAt,
    updated_at: destination.updatedAt,
  }
}
