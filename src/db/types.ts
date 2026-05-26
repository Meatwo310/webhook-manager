export type SourceType = 'hook' | 'timer';

export type DeliveryStatus = 'success' | 'failed' | 'skipped';

export type DiscordDestination = {
	id: string;
	name: string;
	webhookUrl: string;
	threadId: string | null;
	username: string | null;
	avatarUrl: string | null;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
};

export type DiscordDestinationRow = {
	id: string;
	name: string;
	webhook_url: string;
	thread_id: string | null;
	username: string | null;
	avatar_url: string | null;
	is_active: number;
	created_at: string;
	updated_at: string;
};

export type CreateDiscordDestinationInput = {
	name: string;
	webhookUrl: string;
	threadId?: string | null;
	username?: string | null;
	avatarUrl?: string | null;
	isActive?: boolean;
};

export type UpdateDiscordDestinationInput = {
	name?: string;
	webhookUrl?: string;
	threadId?: string | null;
	username?: string | null;
	avatarUrl?: string | null;
	isActive?: boolean;
};

export type Hook = {
	id: string;
	name: string;
	kind: string;
	pathToken: string;
	destinationId: string;
	configJson: string;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
};

export type HookRow = {
	id: string;
	name: string;
	kind: string;
	path_token: string;
	destination_id: string;
	config_json: string;
	is_active: number;
	created_at: string;
	updated_at: string;
};

export type CreateHookInput = {
	name: string;
	kind?: string;
	pathToken: string;
	destinationId: string;
	configJson?: string;
	isActive?: boolean;
};

export type UpdateHookInput = {
	name?: string;
	kind?: string;
	pathToken?: string;
	destinationId?: string;
	configJson?: string;
	isActive?: boolean;
};

export type Delivery = {
	id: string;
	sourceType: SourceType;
	sourceId: string;
	destinationId: string;
	status: DeliveryStatus;
	discordMessageId: string | null;
	responseStatus: number | null;
	errorMessage: string | null;
	createdAt: string;
};

export type DeliveryRow = {
	id: string;
	source_type: SourceType;
	source_id: string;
	destination_id: string;
	status: DeliveryStatus;
	discord_message_id: string | null;
	response_status: number | null;
	error_message: string | null;
	created_at: string;
};

export type CreateDeliveryInput = {
	sourceType: SourceType;
	sourceId: string;
	destinationId: string;
	status: DeliveryStatus;
	discordMessageId?: string | null;
	responseStatus?: number | null;
	errorMessage?: string | null;
};

export type ListDeliveriesOptions = {
	sourceType?: SourceType;
	sourceId?: string;
	destinationId?: string;
	limit?: number;
	offset?: number;
};
