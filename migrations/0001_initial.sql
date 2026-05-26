CREATE TABLE IF NOT EXISTS discord_destinations (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	webhook_url TEXT NOT NULL,
	thread_id TEXT,
	username TEXT,
	avatar_url TEXT,
	is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hooks (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	kind TEXT NOT NULL DEFAULT 'statuspage',
	path_token TEXT NOT NULL UNIQUE,
	destination_id TEXT NOT NULL,
	config_json TEXT NOT NULL DEFAULT '{}',
	is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (destination_id) REFERENCES discord_destinations(id)
);

CREATE TABLE IF NOT EXISTS timers (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	kind TEXT NOT NULL DEFAULT 'rss',
	destination_id TEXT NOT NULL,
	config_json TEXT NOT NULL DEFAULT '{}',
	is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
	last_run_at TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (destination_id) REFERENCES discord_destinations(id)
);

CREATE TABLE IF NOT EXISTS rss_feeds (
	id TEXT PRIMARY KEY,
	timer_id TEXT NOT NULL,
	feed_url TEXT NOT NULL,
	title TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (timer_id) REFERENCES timers(id)
);

CREATE TABLE IF NOT EXISTS rss_items (
	id TEXT PRIMARY KEY,
	feed_id TEXT NOT NULL,
	guid TEXT NOT NULL,
	link TEXT,
	title TEXT NOT NULL,
	published_at TEXT,
	first_seen_at TEXT NOT NULL,
	posted_at TEXT,
	FOREIGN KEY (feed_id) REFERENCES rss_feeds(id),
	UNIQUE (feed_id, guid)
);

CREATE TABLE IF NOT EXISTS deliveries (
	id TEXT PRIMARY KEY,
	source_type TEXT NOT NULL CHECK (source_type IN ('hook', 'timer')),
	source_id TEXT NOT NULL,
	destination_id TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
	discord_message_id TEXT,
	response_status INTEGER,
	error_message TEXT,
	created_at TEXT NOT NULL,
	FOREIGN KEY (destination_id) REFERENCES discord_destinations(id)
);

CREATE INDEX IF NOT EXISTS idx_hooks_path_token ON hooks(path_token);
CREATE INDEX IF NOT EXISTS idx_hooks_destination_id ON hooks(destination_id);
CREATE INDEX IF NOT EXISTS idx_timers_destination_id ON timers(destination_id);
CREATE INDEX IF NOT EXISTS idx_rss_feeds_timer_id ON rss_feeds(timer_id);
CREATE INDEX IF NOT EXISTS idx_rss_items_feed_id ON rss_items(feed_id);
CREATE INDEX IF NOT EXISTS idx_rss_items_posted_at ON rss_items(posted_at);
CREATE INDEX IF NOT EXISTS idx_deliveries_source ON deliveries(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_destination_id ON deliveries(destination_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON deliveries(created_at);
