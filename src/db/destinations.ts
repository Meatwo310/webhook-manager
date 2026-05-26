import type {
	CreateDiscordDestinationInput,
	DiscordDestination,
	DiscordDestinationRow,
	UpdateDiscordDestinationInput,
} from './types';

const selectDiscordDestinationColumns = `
	id,
	name,
	webhook_url,
	thread_id,
	username,
	avatar_url,
	is_active,
	created_at,
	updated_at
`;

function toDiscordDestination(row: DiscordDestinationRow): DiscordDestination {
	return {
		id: row.id,
		name: row.name,
		webhookUrl: row.webhook_url,
		threadId: row.thread_id,
		username: row.username,
		avatarUrl: row.avatar_url,
		isActive: row.is_active === 1,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export async function createDiscordDestination(
	db: D1Database,
	input: CreateDiscordDestinationInput,
): Promise<DiscordDestination> {
	const now = new Date().toISOString();
	const destination: DiscordDestination = {
		id: crypto.randomUUID(),
		name: input.name,
		webhookUrl: input.webhookUrl,
		threadId: input.threadId ?? null,
		username: input.username ?? null,
		avatarUrl: input.avatarUrl ?? null,
		isActive: input.isActive ?? true,
		createdAt: now,
		updatedAt: now,
	};

	await db
		.prepare(
			`
			INSERT INTO discord_destinations (
				id,
				name,
				webhook_url,
				thread_id,
				username,
				avatar_url,
				is_active,
				created_at,
				updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
		)
		.bind(
			destination.id,
			destination.name,
			destination.webhookUrl,
			destination.threadId,
			destination.username,
			destination.avatarUrl,
			destination.isActive ? 1 : 0,
			destination.createdAt,
			destination.updatedAt,
		)
		.run();

	return destination;
}

export async function listDiscordDestinations(db: D1Database): Promise<DiscordDestination[]> {
	const statement: D1PreparedStatement = db.prepare(
		`
		SELECT ${selectDiscordDestinationColumns}
		FROM discord_destinations
		ORDER BY created_at DESC
		`,
	);
	const { results } = await statement.all<DiscordDestinationRow>();

	return results.map(toDiscordDestination);
}

export async function getDiscordDestination(
	db: D1Database,
	id: string,
): Promise<DiscordDestination | null> {
	const statement: D1PreparedStatement = db.prepare(
		`
		SELECT ${selectDiscordDestinationColumns}
		FROM discord_destinations
		WHERE id = ?
		`,
	);
	const row = await statement.bind(id).first<DiscordDestinationRow>();

	return row ? toDiscordDestination(row) : null;
}

export async function updateDiscordDestination(
	db: D1Database,
	id: string,
	input: UpdateDiscordDestinationInput,
): Promise<DiscordDestination | null> {
	const updates: string[] = [];
	const values: (string | number | null)[] = [];

	if (input.name !== undefined) {
		updates.push('name = ?');
		values.push(input.name);
	}

	if (input.webhookUrl !== undefined) {
		updates.push('webhook_url = ?');
		values.push(input.webhookUrl);
	}

	if (input.threadId !== undefined) {
		updates.push('thread_id = ?');
		values.push(input.threadId);
	}

	if (input.username !== undefined) {
		updates.push('username = ?');
		values.push(input.username);
	}

	if (input.avatarUrl !== undefined) {
		updates.push('avatar_url = ?');
		values.push(input.avatarUrl);
	}

	if (input.isActive !== undefined) {
		updates.push('is_active = ?');
		values.push(input.isActive ? 1 : 0);
	}

	if (updates.length === 0) {
		return getDiscordDestination(db, id);
	}

	const updatedAt = new Date().toISOString();
	updates.push('updated_at = ?');
	values.push(updatedAt, id);

	const statement: D1PreparedStatement = db.prepare(
		`
		UPDATE discord_destinations
		SET ${updates.join(', ')}
		WHERE id = ?
		RETURNING ${selectDiscordDestinationColumns}
		`,
	);
	const row = await statement.bind(...values).first<DiscordDestinationRow>();

	return row ? toDiscordDestination(row) : null;
}

export async function disableDiscordDestination(
	db: D1Database,
	id: string,
): Promise<DiscordDestination | null> {
	const updatedAt = new Date().toISOString();
	const statement: D1PreparedStatement = db.prepare(
		`
		UPDATE discord_destinations
		SET is_active = 0, updated_at = ?
		WHERE id = ?
		RETURNING ${selectDiscordDestinationColumns}
		`,
	);
	const row = await statement.bind(updatedAt, id).first<DiscordDestinationRow>();

	return row ? toDiscordDestination(row) : null;
}
