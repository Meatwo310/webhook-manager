import { XMLParser } from 'fast-xml-parser';
import type { DiscordWebhookPayload } from '../discord';

type XmlRecord = Record<string, unknown>;

export type ParsedRssFeed = {
  title: string | null;
  items: ParsedRssItem[];
};

export type ParsedRssItem = {
  guid: string;
  title: string;
  link: string | null;
  summary: string | null;
  publishedAt: string | null;
};

const EMBED_TITLE_LIMIT = 256;
const EMBED_DESCRIPTION_LIMIT = 2048;

const parser = new XMLParser({
  attributeNamePrefix: '',
  ignoreAttributes: false,
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
});

export function parseRssFeed(xml: string, feedUrl: string): ParsedRssFeed {
  const parsed = parser.parse(xml) as unknown;
  const root = asRecord(parsed);
  const rssChannel = asRecord(asRecord(root?.rss)?.channel);
  const atomFeed = asRecord(root?.feed);

  if (rssChannel) {
    return parseRssChannel(rssChannel, feedUrl);
  }

  if (atomFeed) {
    return parseAtomFeed(atomFeed, feedUrl);
  }

  return { title: null, items: [] };
}

export function buildRssDiscordPayload(
  feedTitle: string | null,
  item: ParsedRssItem,
): DiscordWebhookPayload {
  return {
    embeds: [
      {
        title: truncate(item.title, EMBED_TITLE_LIMIT),
        ...(item.link ? { url: item.link } : {}),
        ...(item.summary ? { description: truncate(item.summary, EMBED_DESCRIPTION_LIMIT) } : {}),
        ...(item.publishedAt ? { timestamp: item.publishedAt } : {}),
        ...(feedTitle ? { footer: { text: feedTitle } } : {}),
      },
    ],
  };
}

function parseRssChannel(channel: XmlRecord, feedUrl: string): ParsedRssFeed {
  const rawItems = getRecords(channel.item);

  return {
    title: getString(channel.title) ?? null,
    items: rawItems.map((item) => parseRssItem(item, feedUrl)).filter((item): item is ParsedRssItem => item !== null),
  };
}

function parseAtomFeed(feed: XmlRecord, feedUrl: string): ParsedRssFeed {
  const rawItems = getRecords(feed.entry);

  return {
    title: getString(feed.title) ?? null,
    items: rawItems.map((item) => parseAtomItem(item, feedUrl)).filter((item): item is ParsedRssItem => item !== null),
  };
}

function parseRssItem(item: XmlRecord, feedUrl: string): ParsedRssItem | null {
  const title = getString(item.title) ?? getString(item.link);
  if (!title) {
    return null;
  }

  const link = getUrl(item.link);
  const publishedAt = normalizeDate(getString(item.pubDate) ?? getString(item.published) ?? getString(item.updated));
  const guid = getString(item.guid) ?? link ?? stableFallbackGuid(feedUrl, title, publishedAt);

  return {
    guid,
    title,
    link: link ?? null,
    summary: normalizeSummary(getString(item.description) ?? getString(item.summary) ?? getString(item['content:encoded'])),
    publishedAt,
  };
}

function parseAtomItem(item: XmlRecord, feedUrl: string): ParsedRssItem | null {
  const title = getString(item.title);
  if (!title) {
    return null;
  }

  const link = getAtomLink(item.link);
  const publishedAt = normalizeDate(getString(item.published) ?? getString(item.updated));
  const guid = getString(item.id) ?? link ?? stableFallbackGuid(feedUrl, title, publishedAt);

  return {
    guid,
    title,
    link: link ?? null,
    summary: normalizeSummary(getString(item.summary) ?? getString(item.content)),
    publishedAt,
  };
}

function getAtomLink(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return getUrl(value);
  }

  const links = getRecords(value);
  const alternate = links.find((link) => getString(link.rel) === 'alternate') ?? links[0];
  return getUrl(alternate?.href);
}

function normalizeSummary(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const stripped = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();

  return stripped || null;
}

function normalizeDate(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function stableFallbackGuid(feedUrl: string, title: string, publishedAt: string | null): string {
  return `${feedUrl}:${title}:${publishedAt ?? ''}`;
}

function asRecord(value: unknown): XmlRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as XmlRecord : null;
}

function getRecords(value: unknown): XmlRecord[] {
  if (Array.isArray(value)) {
    return value.map(asRecord).filter((item): item is XmlRecord => item !== null);
  }

  const record = asRecord(value);
  return record ? [record] : [];
}

function getString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  const record = asRecord(value);
  return record ? getString(record['#text']) : undefined;
}

function getUrl(value: unknown): string | undefined {
  const url = getString(value);
  if (!url) {
    return undefined;
  }

  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:' ? url : undefined;
  } catch {
    return undefined;
  }
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit - 3)}...`;
}
