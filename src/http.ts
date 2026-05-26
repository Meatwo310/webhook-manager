import type { Context } from 'hono'

export type AppBindings = {
  Bindings: CloudflareBindings
}

export type ApiErrorCode =
  | 'bad_request'
  | 'not_found'
  | 'inactive'
  | 'unsupported_kind'
  | 'delivery_failed'

export function jsonError(
  c: Context<AppBindings>,
  status: 400 | 404 | 409 | 422 | 500 | 502,
  code: ApiErrorCode,
  message: string
) {
  return c.json({ error: { code, message } }, status)
}

export function parseBooleanFlag(value: unknown): 0 | 1 | undefined {
  if (value === undefined) {
    return undefined
  }

  if (value === true || value === 1 || value === '1') {
    return 1
  }

  if (value === false || value === 0 || value === '0') {
    return 0
  }

  return undefined
}
