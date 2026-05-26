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

export type Timer = {
	id: string;
	name: string;
	kind: string;
	destinationId: string;
	configJson: string;
	isActive: boolean;
	lastRunAt: string | null;
	createdAt: string;
	updatedAt: string;
};

export type TimerRow = {
	id: string;
	name: string;
	kind: string;
	destination_id: string;
	config_json: string;
	is_active: number;
	last_run_at: string | null;
	created_at: string;
	updated_at: string;
};

export type CreateTimerInput = {
	name: string;
	kind?: string;
	destinationId: string;
	configJson?: string;
	isActive?: boolean;
	lastRunAt?: string | null;
};

export type UpdateTimerInput = {
	name?: string;
	kind?: string;
	destinationId?: string;
	configJson?: string;
	isActive?: boolean;
	lastRunAt?: string | null;
};

export type RssFeed = {
	id: string;
	timerId: string;
	feedUrl: string;
	title: string | null;
	createdAt: string;
	updatedAt: string;
};

export type RssFeedRow = {
	id: string;
	timer_id: string;
	feed_url: string;
	title: string | null;
	created_at: string;
	updated_at: string;
};

export type CreateRssFeedInput = {
	timerId: string;
	feedUrl: string;
	title?: string | null;
};

export type UpdateRssFeedInput = {
	feedUrl?: string;
	title?: string | null;
};

export type RssItem = {
	id: string;
	feedId: string;
	guid: string;
	link: string | null;
	title: string;
	publishedAt: string | null;
	firstSeenAt: string;
	postedAt: string | null;
};

export type RssItemRow = {
	id: string;
	feed_id: string;
	guid: string;
	link: string | null;
	title: string;
	published_at: string | null;
	first_seen_at: string;
	posted_at: string | null;
};

export type CreateRssItemInput = {
	feedId: string;
	guid: string;
	link?: string | null;
	title: string;
	publishedAt?: string | null;
	firstSeenAt?: string;
	postedAt?: string | null;
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
