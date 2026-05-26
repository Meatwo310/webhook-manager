import type { CreateHookInput, Hook, HookRow, UpdateHookInput } from './types';
import { generatePathToken } from '../security';

const selectHookColumns = `
	id,
	name,
	kind,
	path_token,
	destination_id,
	config_json,
	is_active,
	created_at,
	updated_at
`;

function toHook(row: HookRow): Hook {
	return {
		id: row.id,
		name: row.name,
		kind: row.kind,
		pathToken: row.path_token,
		destinationId: row.destination_id,
		configJson: row.config_json,
		isActive: row.is_active === 1,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export async function createHook(db: D1Database, input: CreateHookInput): Promise<Hook> {
	const now = new Date().toISOString();
	const hook: Hook = {
		id: crypto.randomUUID(),
		name: input.name,
		kind: input.kind ?? 'statuspage',
		pathToken: input.pathToken ?? generatePathToken(),
		destinationId: input.destinationId,
		configJson: input.configJson ?? '{}',
		isActive: input.isActive ?? true,
		createdAt: now,
		updatedAt: now,
	};

	await db
		.prepare(
			`
			INSERT INTO hooks (
				id,
				name,
				kind,
				path_token,
				destination_id,
				config_json,
				is_active,
				created_at,
				updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
		)
		.bind(
			hook.id,
			hook.name,
			hook.kind,
			hook.pathToken,
			hook.destinationId,
			hook.configJson,
			hook.isActive ? 1 : 0,
			hook.createdAt,
			hook.updatedAt,
		)
		.run();

	return hook;
}

export async function listHooks(db: D1Database): Promise<Hook[]> {
	const statement: D1PreparedStatement = db.prepare(
		`
		SELECT ${selectHookColumns}
		FROM hooks
		ORDER BY created_at DESC
		`,
	);
	const { results } = await statement.all<HookRow>();

	return results.map(toHook);
}

export async function getHook(db: D1Database, id: string): Promise<Hook | null> {
	const statement: D1PreparedStatement = db.prepare(
		`
		SELECT ${selectHookColumns}
		FROM hooks
		WHERE id = ?
		`,
	);
	const row = await statement.bind(id).first<HookRow>();

	return row ? toHook(row) : null;
}

export async function getActiveHookByPathToken(
	db: D1Database,
	pathToken: string,
): Promise<Hook | null> {
	const statement: D1PreparedStatement = db.prepare(
		`
		SELECT ${selectHookColumns}
		FROM hooks
		WHERE path_token = ? AND is_active = 1
		`,
	);
	const row = await statement.bind(pathToken).first<HookRow>();

	return row ? toHook(row) : null;
}

export async function updateHook(
	db: D1Database,
	id: string,
	input: UpdateHookInput,
): Promise<Hook | null> {
	const updates: string[] = [];
	const values: (string | number | null)[] = [];

	if (input.name !== undefined) {
		updates.push('name = ?');
		values.push(input.name);
	}

	if (input.kind !== undefined) {
		updates.push('kind = ?');
		values.push(input.kind);
	}

	if (input.pathToken !== undefined) {
		updates.push('path_token = ?');
		values.push(input.pathToken);
	}

	if (input.destinationId !== undefined) {
		updates.push('destination_id = ?');
		values.push(input.destinationId);
	}

	if (input.configJson !== undefined) {
		updates.push('config_json = ?');
		values.push(input.configJson);
	}

	if (input.isActive !== undefined) {
		updates.push('is_active = ?');
		values.push(input.isActive ? 1 : 0);
	}

	if (updates.length === 0) {
		return getHook(db, id);
	}

	updates.push('updated_at = ?');
	values.push(new Date().toISOString(), id);

	const statement: D1PreparedStatement = db.prepare(
		`
		UPDATE hooks
		SET ${updates.join(', ')}
		WHERE id = ?
		RETURNING ${selectHookColumns}
		`,
	);
	const row = await statement.bind(...values).first<HookRow>();

	return row ? toHook(row) : null;
}

export async function disableHook(db: D1Database, id: string): Promise<Hook | null> {
	const statement: D1PreparedStatement = db.prepare(
		`
		UPDATE hooks
		SET is_active = 0, updated_at = ?
		WHERE id = ?
		RETURNING ${selectHookColumns}
		`,
	);
	const row = await statement.bind(new Date().toISOString(), id).first<HookRow>();

	return row ? toHook(row) : null;
}

export type DeleteHookResult = { ok: true } | { ok: false; reason: 'not_found' | 'active' };

export async function deleteInactiveHook(db: D1Database, id: string): Promise<DeleteHookResult> {
	const hook = await getHook(db, id);

	if (!hook) {
		return { ok: false, reason: 'not_found' };
	}

	if (hook.isActive) {
		return { ok: false, reason: 'active' };
	}

	await db.prepare("DELETE FROM deliveries WHERE source_type = 'hook' AND source_id = ?").bind(id).run();
	const result = await db.prepare('DELETE FROM hooks WHERE id = ?').bind(id).run();

	return result.meta.changes > 0 ? { ok: true } : { ok: false, reason: 'not_found' };
}
