export type DiscordDestination = {
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

export type DiscordJsonValue =
  | string
  | number
  | boolean
  | null
  | DiscordJsonValue[]
  | { [key: string]: DiscordJsonValue | undefined };

export type DiscordWebhookPayload = {
  content?: string;
  username?: string;
  avatar_url?: string;
  tts?: boolean;
  embeds?: Array<{ [key: string]: DiscordJsonValue | undefined }>;
  allowed_mentions?: { [key: string]: DiscordJsonValue | undefined };
  components?: DiscordJsonValue[];
  attachments?: Array<{ [key: string]: DiscordJsonValue | undefined }>;
  flags?: number;
  thread_name?: string;
  [key: string]: DiscordJsonValue | undefined;
};

export type DiscordFetch = (
  input: string,
  init: {
    method: 'POST';
    headers: Record<string, string>;
    body: string;
  },
) => Promise<Response>;

export type DiscordWebhookResult = {
  ok: boolean;
  status: number | null;
  body: string | null;
  url: string;
  error: string | null;
};
