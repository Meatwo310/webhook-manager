import { Hono } from 'hono'
import {
  createDelivery,
  createDiscordDestination,
  createHook,
  disableDiscordDestination,
  disableHook,
  getActiveHookByPathToken,
  getDiscordDestination,
  listDiscordDestinations,
  listHooks,
  updateDiscordDestination,
  updateHook,
  type CreateDiscordDestinationInput,
  type CreateHookInput,
  type DiscordDestination as DbDiscordDestination,
  type UpdateDiscordDestinationInput,
  type UpdateHookInput,
} from './db'
import {
  postDiscordWebhook,
  type DiscordDestination as WebhookDiscordDestination,
  type DiscordWebhookPayload,
} from './discord'
import { buildStatuspageDiscordPayload } from './hooks'
import { jsonError, parseBooleanFlag, type AppBindings } from './http'
import { renderer } from './renderer'

const app = new Hono<AppBindings>();

app.use(renderer)

app.get('/', (c) => {
  return c.render(<h1>Hello!</h1>)
})

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

export default app

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
