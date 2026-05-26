import type { CreateDeliveryInput, Delivery, DeliveryRow, ListDeliveriesOptions } from './types';

const DEFAULT_DELIVERIES_LIMIT = 50;
const MAX_DELIVERIES_LIMIT = 100;

const selectDeliveryColumns = `
	id,
	source_type,
	source_id,
	destination_id,
	status,
	discord_message_id,
	response_status,
	error_message,
	created_at
`;

function toDelivery(row: DeliveryRow): Delivery {
	return {
		id: row.id,
		sourceType: row.source_type,
		sourceId: row.source_id,
		destinationId: row.destination_id,
		status: row.status,
		discordMessageId: row.discord_message_id,
		responseStatus: row.response_status,
		errorMessage: row.error_message,
		createdAt: row.created_at,
	};
}

export async function createDelivery(
	db: D1Database,
	input: CreateDeliveryInput,
): Promise<Delivery> {
	const delivery: Delivery = {
		id: crypto.randomUUID(),
		sourceType: input.sourceType,
		sourceId: input.sourceId,
		destinationId: input.destinationId,
		status: input.status,
		discordMessageId: input.discordMessageId ?? null,
		responseStatus: input.responseStatus ?? null,
		errorMessage: input.errorMessage ?? null,
		createdAt: new Date().toISOString(),
	};

	const statement: D1PreparedStatement = db.prepare(
		`
		INSERT INTO deliveries (
			id,
			source_type,
			source_id,
			destination_id,
			status,
			discord_message_id,
			response_status,
			error_message,
			created_at
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		RETURNING
			id,
			source_type,
			source_id,
			destination_id,
			status,
			discord_message_id,
			response_status,
			error_message,
			created_at
		`,
	);
	const row = await statement
		.bind(
			delivery.id,
			delivery.sourceType,
			delivery.sourceId,
			delivery.destinationId,
			delivery.status,
			delivery.discordMessageId,
			delivery.responseStatus,
			delivery.errorMessage,
			delivery.createdAt,
		)
		.first<DeliveryRow>();

	return row ? toDelivery(row) : delivery;
}

export async function listDeliveries(
	db: D1Database,
	options: ListDeliveriesOptions = {},
): Promise<Delivery[]> {
	const where: string[] = [];
	const values: (number | string)[] = [];

	if (options.sourceType !== undefined) {
		where.push('source_type = ?');
		values.push(options.sourceType);
	}

	if (options.sourceId !== undefined) {
		where.push('source_id = ?');
		values.push(options.sourceId);
	}

	if (options.destinationId !== undefined) {
		where.push('destination_id = ?');
		values.push(options.destinationId);
	}

	const limit = Math.min(
		Math.max(Math.trunc(options.limit ?? DEFAULT_DELIVERIES_LIMIT), 1),
		MAX_DELIVERIES_LIMIT,
	);
	const offset = Math.max(Math.trunc(options.offset ?? 0), 0);
	values.push(limit, offset);

	const statement: D1PreparedStatement = db.prepare(
		`
		SELECT ${selectDeliveryColumns}
		FROM deliveries
		${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
		`,
	);
	const { results } = await statement.bind(...values).all<DeliveryRow>();

	return results.map(toDelivery);
}
