import type { CreateDeliveryInput, Delivery, DeliveryRow } from './types';

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
