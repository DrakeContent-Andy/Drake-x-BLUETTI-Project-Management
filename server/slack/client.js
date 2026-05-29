import '../env.js';
import { WebClient } from '@slack/web-api';

let client = null;

export function slackConfigured() {
  return !!process.env.SLACK_BOT_TOKEN;
}

function getClient() {
  if (!slackConfigured()) throw new Error('SLACK_BOT_TOKEN is not set');
  if (!client) client = new WebClient(process.env.SLACK_BOT_TOKEN);
  return client;
}

export async function postMessage(channel, text, blocks) {
  if (!channel) throw new Error('No channel specified');
  return getClient().chat.postMessage({ channel, text, blocks, unfurl_links: false });
}

// List public + private channels the workspace exposes, for the admin dropdown.
export async function listChannels() {
  const out = [];
  let cursor;
  do {
    const resp = await getClient().conversations.list({
      types: 'public_channel,private_channel',
      exclude_archived: true,
      limit: 200,
      cursor,
    });
    for (const c of resp.channels || []) out.push({ id: c.id, name: c.name, isPrivate: c.is_private });
    cursor = resp.response_metadata && resp.response_metadata.next_cursor;
  } while (cursor);
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
