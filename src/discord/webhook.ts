import type {
  DiscordDestination,
  DiscordFetch,
  DiscordWebhookPayload,
  DiscordWebhookResult,
} from './types';

const withThreadId = (webhookUrl: string, threadId: string | null): string => {
  if (!threadId) {
    return webhookUrl;
  }

  const url = new URL(webhookUrl);
  url.searchParams.set('thread_id', threadId);
  return url.toString();
};

const withDestinationOverrides = (
  destination: DiscordDestination,
  payload: DiscordWebhookPayload,
): DiscordWebhookPayload => {
  return {
    ...payload,
    ...(destination.username ? { username: destination.username } : {}),
    ...(destination.avatar_url ? { avatar_url: destination.avatar_url } : {}),
  };
};

const readResponseBody = async (response: Response): Promise<string | null> => {
  try {
    return await response.text();
  } catch {
    return null;
  }
};

export const postDiscordWebhook = async (
  destination: DiscordDestination,
  payload: DiscordWebhookPayload,
  fetchImpl: DiscordFetch = fetch,
): Promise<DiscordWebhookResult> => {
  const url = withThreadId(destination.webhook_url, destination.thread_id);
  const requestPayload = withDestinationOverrides(destination, payload);

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    return {
      ok: response.ok,
      status: response.status,
      body: await readResponseBody(response),
      url,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      body: null,
      url,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
