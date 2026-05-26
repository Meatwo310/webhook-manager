import type {
	CreateRssFeedInput,
	CreateRssItemInput,
	RssFeed,
	RssFeedRow,
	RssItem,
	RssItemRow,
	UpdateRssFeedInput,
} from './types';

const selectRssFeedColumns = `
	id,
	timer_id,
	feed_url,
	title,
	created_at,
	updated_at
`;

const selectRssItemColumns = `
	id,
	feed_id,
	guid,
	link,
	title,
	published_at,
	first_seen_at,
	posted_at
`;

function toRssFeed(row: RssFeedRow): RssFeed {
	return {
		id: row.id,
		timerId: row.timer_id,
		feedUrl: row.feed_url,
		title: row.title,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function toRssItem(row: RssItemRow): RssItem {
	return {
		id: row.id,
		feedId: row.feed_id,
		guid: row.guid,
		link: row.link,
		title: row.title,
		publishedAt: row.published_at,
		firstSeenAt: row.first_seen_at,
		postedAt: row.posted_at,
	};
}

export async function createRssFeed(
	db: D1Database,
	input: CreateRssFeedInput,
): Promise<RssFeed> {
	const now = new Date().toISOString();
	const feed: RssFeed = {
		id: crypto.randomUUID(),
		timerId: input.timerId,
		feedUrl: input.feedUrl,
		title: input.title ?? null,
		createdAt: now,
		updatedAt: now,
	};

	await db
		.prepare(
			`
			INSERT INTO rss_feeds (
				id,
				timer_id,
				feed_url,
				title,
				created_at,
				updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?)
			`,
		)
		.bind(feed.id, feed.timerId, feed.feedUrl, feed.title, feed.createdAt, feed.updatedAt)
		.run();

	return feed;
}

export async function listRssFeedsByTimerId(
	db: D1Database,
	timerId: string,
): Promise<RssFeed[]> {
	const statement: D1PreparedStatement = db.prepare(
		`
		SELECT ${selectRssFeedColumns}
		FROM rss_feeds
		WHERE timer_id = ?
		ORDER BY created_at DESC
		`,
	);
	const { results } = await statement.bind(timerId).all<RssFeedRow>();

	return results.map(toRssFeed);
}

export async function updateRssFeed(
	db: D1Database,
	id: string,
	input: UpdateRssFeedInput,
): Promise<RssFeed | null> {
	const updates: string[] = [];
	const values: (string | null)[] = [];

	if (input.feedUrl !== undefined) {
		updates.push('feed_url = ?');
		values.push(input.feedUrl);
	}

	if (input.title !== undefined) {
		updates.push('title = ?');
		values.push(input.title);
	}

	if (updates.length === 0) {
		const statement: D1PreparedStatement = db.prepare(
			`
			SELECT ${selectRssFeedColumns}
			FROM rss_feeds
			WHERE id = ?
			`,
		);
		const row = await statement.bind(id).first<RssFeedRow>();

		return row ? toRssFeed(row) : null;
	}

	updates.push('updated_at = ?');
	values.push(new Date().toISOString(), id);

	const statement: D1PreparedStatement = db.prepare(
		`
		UPDATE rss_feeds
		SET ${updates.join(', ')}
		WHERE id = ?
		RETURNING ${selectRssFeedColumns}
		`,
	);
	const row = await statement.bind(...values).first<RssFeedRow>();

	return row ? toRssFeed(row) : null;
}

export async function insertRssItemIfNew(
	db: D1Database,
	input: CreateRssItemInput,
): Promise<RssItem | null> {
	const item: RssItem = {
		id: crypto.randomUUID(),
		feedId: input.feedId,
		guid: input.guid,
		link: input.link ?? null,
		title: input.title,
		publishedAt: input.publishedAt ?? null,
		firstSeenAt: input.firstSeenAt ?? new Date().toISOString(),
		postedAt: input.postedAt ?? null,
	};

	const statement: D1PreparedStatement = db.prepare(
		`
		INSERT OR IGNORE INTO rss_items (
			id,
			feed_id,
			guid,
			link,
			title,
			published_at,
			first_seen_at,
			posted_at
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		RETURNING ${selectRssItemColumns}
		`,
	);
	const row = await statement
		.bind(
			item.id,
			item.feedId,
			item.guid,
			item.link,
			item.title,
			item.publishedAt,
			item.firstSeenAt,
			item.postedAt,
		)
		.first<RssItemRow>();

	return row ? toRssItem(row) : null;
}

export async function markRssItemPosted(
	db: D1Database,
	id: string,
	postedAt = new Date().toISOString(),
): Promise<RssItem | null> {
	const statement: D1PreparedStatement = db.prepare(
		`
		UPDATE rss_items
		SET posted_at = ?
		WHERE id = ?
		RETURNING ${selectRssItemColumns}
		`,
	);
	const row = await statement.bind(postedAt, id).first<RssItemRow>();

	return row ? toRssItem(row) : null;
}
