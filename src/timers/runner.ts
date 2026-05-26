import {
  createDelivery,
  getDiscordDestination,
  insertRssItemIfNew,
  listActiveTimersByKind,
  listRssFeedsByTimerId,
  markRssItemPosted,
  updateRssFeed,
  updateTimerLastRunAt,
  type DiscordDestination as DbDiscordDestination,
  type RssFeed,
  type Timer,
} from '../db';
import {
  postDiscordWebhook,
  type DiscordDestination as WebhookDiscordDestination,
} from '../discord';
import { buildRssDiscordPayload, parseRssFeed, type ParsedRssItem } from './rss';

type RssTimerConfig = {
  max_items_per_run?: number;
  post_on_first_run?: boolean;
};

type RunRssTimersResult = {
  timers: number;
  feeds: number;
  posted: number;
  skipped: number;
  failed: number;
};

const DEFAULT_MAX_ITEMS_PER_RUN = 5;
const MAX_ITEMS_PER_RUN_LIMIT = 20;

export async function runRssTimers(db: D1Database): Promise<RunRssTimersResult> {
  const timers = await listActiveTimersByKind(db, 'rss');
  const result: RunRssTimersResult = {
    timers: timers.length,
    feeds: 0,
    posted: 0,
    skipped: 0,
    failed: 0,
  };

  for (const timer of timers) {
    const timerResult = await runRssTimer(db, timer);
    result.feeds += timerResult.feeds;
    result.posted += timerResult.posted;
    result.skipped += timerResult.skipped;
    result.failed += timerResult.failed;
  }

  return result;
}

async function runRssTimer(
  db: D1Database,
  timer: Timer,
): Promise<Omit<RunRssTimersResult, 'timers'>> {
  const config = parseRssTimerConfig(timer.configJson);
  const destination = await getDiscordDestination(db, timer.destinationId);
  const feeds = await listRssFeedsByTimerId(db, timer.id);
  const result = {
    feeds: feeds.length,
    posted: 0,
    skipped: 0,
    failed: 0,
  };

  if (!destination || !destination.isActive) {
    for (const feed of feeds) {
      await createDelivery(db, {
        sourceType: 'timer',
        sourceId: timer.id,
        destinationId: timer.destinationId,
        status: 'skipped',
        errorMessage: `RSS destination unavailable for feed: ${feed.feedUrl}`,
      });
      result.skipped += 1;
    }

    await updateTimerLastRunAt(db, timer.id, new Date().toISOString());
    return result;
  }

  for (const feed of feeds) {
    const feedResult = await runRssFeed(db, timer, feed, destination, config);
    result.posted += feedResult.posted;
    result.skipped += feedResult.skipped;
    result.failed += feedResult.failed;
  }

  await updateTimerLastRunAt(db, timer.id, new Date().toISOString());
  return result;
}

async function runRssFeed(
  db: D1Database,
  timer: Timer,
  feed: RssFeed,
  destination: DbDiscordDestination,
  config: Required<RssTimerConfig>,
): Promise<Pick<RunRssTimersResult, 'posted' | 'skipped' | 'failed'>> {
  const result = {
    posted: 0,
    skipped: 0,
    failed: 0,
  };

  try {
    const response = await fetch(feed.feedUrl, {
      headers: {
        accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
    });

    if (!response.ok) {
      await createDelivery(db, {
        sourceType: 'timer',
        sourceId: timer.id,
        destinationId: destination.id,
        status: 'failed',
        responseStatus: response.status,
        errorMessage: `Failed to fetch RSS feed: ${feed.feedUrl}`,
      });
      result.failed += 1;
      return result;
    }

    const parsed = parseRssFeed(await response.text(), feed.feedUrl);
    if (parsed.title !== feed.title) {
      await updateRssFeed(db, feed.id, { title: parsed.title });
    }

    const items = parsed.items.slice(0, config.max_items_per_run);
    for (const item of items) {
      const inserted = await insertFeedItem(db, feed, item, timer, config);
      if (!inserted.shouldPost) {
        result.skipped += inserted.wasNew ? 1 : 0;
        continue;
      }

      const delivery = await postDiscordWebhook(
        toWebhookDestination(destination),
        buildRssDiscordPayload(parsed.title ?? feed.title, item),
      );
      await createDelivery(db, {
        sourceType: 'timer',
        sourceId: timer.id,
        destinationId: destination.id,
        status: delivery.ok ? 'success' : 'failed',
        responseStatus: delivery.status,
        errorMessage: delivery.error ?? (delivery.ok ? null : delivery.body),
      });

      if (delivery.ok) {
        await markRssItemPosted(db, inserted.itemId);
        result.posted += 1;
      } else {
        result.failed += 1;
      }
    }
  } catch (error) {
    await createDelivery(db, {
      sourceType: 'timer',
      sourceId: timer.id,
      destinationId: destination.id,
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    result.failed += 1;
  }

  return result;
}

async function insertFeedItem(
  db: D1Database,
  feed: RssFeed,
  item: ParsedRssItem,
  timer: Timer,
  config: Required<RssTimerConfig>,
): Promise<{ itemId: string; shouldPost: boolean; wasNew: boolean }> {
  const shouldPost = timer.lastRunAt !== null || config.post_on_first_run;
  const inserted = await insertRssItemIfNew(db, {
    feedId: feed.id,
    guid: item.guid,
    link: item.link,
    title: item.title,
    publishedAt: item.publishedAt,
    postedAt: shouldPost ? null : new Date().toISOString(),
  });

  return {
    itemId: inserted?.id ?? '',
    shouldPost: Boolean(inserted && shouldPost),
    wasNew: inserted !== null,
  };
}

function parseRssTimerConfig(configJson: string): Required<RssTimerConfig> {
  const fallback: Required<RssTimerConfig> = {
    max_items_per_run: DEFAULT_MAX_ITEMS_PER_RUN,
    post_on_first_run: false,
  };

  try {
    const config = JSON.parse(configJson) as RssTimerConfig;
    const maxItems = Number(config.max_items_per_run);

    return {
      max_items_per_run: Number.isInteger(maxItems)
        ? Math.min(Math.max(maxItems, 1), MAX_ITEMS_PER_RUN_LIMIT)
        : fallback.max_items_per_run,
      post_on_first_run: config.post_on_first_run === true,
    };
  } catch {
    return fallback;
  }
}

function toWebhookDestination(destination: DbDiscordDestination): WebhookDiscordDestination {
  return {
    id: destination.id,
    name: destination.name,
    webhook_url: destination.webhookUrl,
    thread_id: destination.threadId,
    username: destination.username,
    avatar_url: destination.avatarUrl,
    is_active: destination.isActive ? 1 : 0,
    created_at: destination.createdAt,
    updated_at: destination.updatedAt,
  };
}
