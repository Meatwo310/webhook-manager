type StatuspageRecord = Record<string, unknown>;

export type DiscordEmbedField = {
  name: string;
  value: string;
  inline?: boolean;
};

export type DiscordWebhookPayload = {
  embeds: Array<{
    title: string;
    url?: string;
    description?: string;
    color: number;
    fields: DiscordEmbedField[];
    timestamp?: string;
  }>;
};

const EMBED_TITLE_LIMIT = 256;
const EMBED_DESCRIPTION_LIMIT = 2048;
const EMBED_FIELD_VALUE_LIMIT = 1024;

const STATUS_COLORS: Record<string, number> = {
  investigating: 0xd83c3c,
  identified: 0xf2c94c,
  monitoring: 0x2f80ed,
  resolved: 0x27ae60,
  scheduled: 0x56ccf2,
  in_progress: 0xf2994a,
  verifying: 0x2d9cdb,
  completed: 0x27ae60,
  postmortem: 0x828282,
};

const DEFAULT_COLOR = 0x828282;

export function buildStatuspageDiscordPayload(payload: unknown): DiscordWebhookPayload | null {
  const root = asRecord(payload);
  const incident = asRecord(root?.incident);
  if (!incident) {
    return null;
  }

  const title = getString(incident.name);
  if (!title) {
    return null;
  }

  const updates = getRecords(incident.incident_updates);
  const latestUpdate = getLatestUpdate(updates);
  const status = getString(incident.status) ?? getString(latestUpdate?.status);
  const impact = getString(incident.impact);
  const affectedComponents = getAffectedComponents(incident, latestUpdate);
  const url = getUrl(incident.shortlink) ?? getUrl(incident.url);
  const description = getString(latestUpdate?.body);
  const timestamp = getTimestamp(latestUpdate) ?? getString(incident.updated_at) ?? getString(incident.created_at);

  return {
    embeds: [
      {
        title: truncate(title, EMBED_TITLE_LIMIT),
        ...(url ? { url } : {}),
        ...(description ? { description: truncate(description, EMBED_DESCRIPTION_LIMIT) } : {}),
        color: getStatusColor(status),
        fields: [
          {
            name: 'Status',
            value: truncate(status ?? 'unknown', EMBED_FIELD_VALUE_LIMIT),
            inline: true,
          },
          {
            name: 'Impact',
            value: truncate(impact ?? 'unknown', EMBED_FIELD_VALUE_LIMIT),
            inline: true,
          },
          {
            name: 'Affected components',
            value: truncate(affectedComponents || 'none', EMBED_FIELD_VALUE_LIMIT),
            inline: false,
          },
        ],
        ...(timestamp ? { timestamp } : {}),
      },
    ],
  };
}

function asRecord(value: unknown): StatuspageRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as StatuspageRecord : null;
}

function getRecords(value: unknown): StatuspageRecord[] {
  return Array.isArray(value) ? value.map(asRecord).filter((item): item is StatuspageRecord => item !== null) : [];
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
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

function getLatestUpdate(updates: StatuspageRecord[]): StatuspageRecord | undefined {
  return updates.reduce<StatuspageRecord | undefined>((latest, update) => {
    if (!latest) {
      return update;
    }

    return getUpdateTime(update) > getUpdateTime(latest) ? update : latest;
  }, undefined);
}

function getUpdateTime(update: StatuspageRecord): number {
  const date = getTimestamp(update);
  return date ? Date.parse(date) : 0;
}

function getTimestamp(record: StatuspageRecord | undefined): string | undefined {
  if (!record) {
    return undefined;
  }

  return getString(record.created_at) ?? getString(record.updated_at);
}

function getAffectedComponents(incident: StatuspageRecord, latestUpdate: StatuspageRecord | undefined): string {
  const updateComponents = getRecords(latestUpdate?.affected_components);
  const incidentComponents = getRecords(incident.components);
  const names = [...updateComponents, ...incidentComponents]
    .map((component) => getString(component.name))
    .filter((name): name is string => name !== undefined);

  return [...new Set(names)].join(', ');
}

function getStatusColor(status: string | undefined): number {
  if (!status) {
    return DEFAULT_COLOR;
  }

  return STATUS_COLORS[status.toLowerCase()] ?? DEFAULT_COLOR;
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit - 3)}...`;
}
