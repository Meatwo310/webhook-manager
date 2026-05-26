import type { CreateTimerInput, Timer, TimerRow, UpdateTimerInput } from './types';

const selectTimerColumns = `
	id,
	name,
	kind,
	destination_id,
	config_json,
	is_active,
	last_run_at,
	created_at,
	updated_at
`;

function toTimer(row: TimerRow): Timer {
	return {
		id: row.id,
		name: row.name,
		kind: row.kind,
		destinationId: row.destination_id,
		configJson: row.config_json,
		isActive: row.is_active === 1,
		lastRunAt: row.last_run_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export async function createTimer(db: D1Database, input: CreateTimerInput): Promise<Timer> {
	const now = new Date().toISOString();
	const timer: Timer = {
		id: crypto.randomUUID(),
		name: input.name,
		kind: input.kind ?? 'rss',
		destinationId: input.destinationId,
		configJson: input.configJson ?? '{}',
		isActive: input.isActive ?? true,
		lastRunAt: input.lastRunAt ?? null,
		createdAt: now,
		updatedAt: now,
	};

	await db
		.prepare(
			`
			INSERT INTO timers (
				id,
				name,
				kind,
				destination_id,
				config_json,
				is_active,
				last_run_at,
				created_at,
				updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
		)
		.bind(
			timer.id,
			timer.name,
			timer.kind,
			timer.destinationId,
			timer.configJson,
			timer.isActive ? 1 : 0,
			timer.lastRunAt,
			timer.createdAt,
			timer.updatedAt,
		)
		.run();

	return timer;
}

export async function listTimers(db: D1Database): Promise<Timer[]> {
	const statement: D1PreparedStatement = db.prepare(
		`
		SELECT ${selectTimerColumns}
		FROM timers
		ORDER BY created_at DESC
		`,
	);
	const { results } = await statement.all<TimerRow>();

	return results.map(toTimer);
}

export async function getTimer(db: D1Database, id: string): Promise<Timer | null> {
	const statement: D1PreparedStatement = db.prepare(
		`
		SELECT ${selectTimerColumns}
		FROM timers
		WHERE id = ?
		`,
	);
	const row = await statement.bind(id).first<TimerRow>();

	return row ? toTimer(row) : null;
}

export async function updateTimer(
	db: D1Database,
	id: string,
	input: UpdateTimerInput,
): Promise<Timer | null> {
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

	if (input.lastRunAt !== undefined) {
		updates.push('last_run_at = ?');
		values.push(input.lastRunAt);
	}

	if (updates.length === 0) {
		return getTimer(db, id);
	}

	updates.push('updated_at = ?');
	values.push(new Date().toISOString(), id);

	const statement: D1PreparedStatement = db.prepare(
		`
		UPDATE timers
		SET ${updates.join(', ')}
		WHERE id = ?
		RETURNING ${selectTimerColumns}
		`,
	);
	const row = await statement.bind(...values).first<TimerRow>();

	return row ? toTimer(row) : null;
}

export async function disableTimer(db: D1Database, id: string): Promise<Timer | null> {
	const statement: D1PreparedStatement = db.prepare(
		`
		UPDATE timers
		SET is_active = 0, updated_at = ?
		WHERE id = ?
		RETURNING ${selectTimerColumns}
		`,
	);
	const row = await statement.bind(new Date().toISOString(), id).first<TimerRow>();

	return row ? toTimer(row) : null;
}

export async function listActiveTimersByKind(
	db: D1Database,
	kind: string,
): Promise<Timer[]> {
	const statement: D1PreparedStatement = db.prepare(
		`
		SELECT ${selectTimerColumns}
		FROM timers
		WHERE kind = ? AND is_active = 1
		ORDER BY created_at DESC
		`,
	);
	const { results } = await statement.bind(kind).all<TimerRow>();

	return results.map(toTimer);
}

export async function updateTimerLastRunAt(
	db: D1Database,
	id: string,
	lastRunAt: string,
): Promise<Timer | null> {
	const statement: D1PreparedStatement = db.prepare(
		`
		UPDATE timers
		SET last_run_at = ?, updated_at = ?
		WHERE id = ?
		RETURNING ${selectTimerColumns}
		`,
	);
	const row = await statement
		.bind(lastRunAt, new Date().toISOString(), id)
		.first<TimerRow>();

	return row ? toTimer(row) : null;
}
