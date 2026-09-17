// Discord OAuth + role-assign helpers.
//
// 3× exponential backoff on transient failures — the "Discord is having
// trouble" retry pattern from the F03 locked decisions.

import { env } from './env'

const RETRY_DELAYS_MS = [200, 500, 1200]

async function fetchWithRetry(url: string, init: RequestInit, ctx: string): Promise<Response> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(url, init)
      // Retry on 5xx (server-side) and 429 (rate limit). Don't retry on 4xx (client error).
      if (res.status >= 500 || res.status === 429) {
        lastErr = new Error(`${ctx} returned ${res.status}`)
        if (attempt < RETRY_DELAYS_MS.length) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]))
          continue
        }
        throw lastErr
      }
      return res
    } catch (err) {
      lastErr = err
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]))
        continue
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`${ctx} failed`)
}

export interface DiscordUser {
  id: string
  username: string
  global_name?: string | null
  avatar?: string | null
}

export async function exchangeCode(code: string): Promise<{ access_token: string }> {
  const body = new URLSearchParams({
    client_id: env.discord.clientId,
    client_secret: env.discord.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: env.oauth.redirectUri,
  })

  const res = await fetchWithRetry(
    'https://discord.com/api/oauth2/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
    'token exchange'
  )
  if (!res.ok) {
    throw new Error(`token exchange failed: ${res.status}`)
  }
  return res.json()
}

export async function fetchUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetchWithRetry(
    'https://discord.com/api/users/@me',
    { headers: { Authorization: `Bearer ${accessToken}` } },
    'user fetch'
  )
  if (!res.ok) {
    throw new Error(`user fetch failed: ${res.status}`)
  }
  return res.json()
}

/**
 * Assign the Linked role. If the user isn't in the server yet, Discord returns 404;
 * we swallow that specific case and rely on the bot's GUILD_MEMBER_ADD handler
 * (F01/F02) to apply the role when the user eventually joins.
 */
export async function assignLinkedRole(discordUserId: string): Promise<{ applied: boolean; queued: boolean }> {
  const url = `https://discord.com/api/guilds/${env.discord.guildId}/members/${discordUserId}/roles/${env.discord.linkedRoleId}`
  const res = await fetchWithRetry(
    url,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bot ${env.discord.botToken}`,
        'Content-Length': '0',
      },
    },
    'role assign'
  )
  if (res.status === 204) return { applied: true, queued: false }
  if (res.status === 404) {
    // User not in the guild yet — queue for the bot's join handler.
    return { applied: false, queued: true }
  }
  throw new Error(`role assign failed: ${res.status}`)
}

/**
 * Post the "welcome to the community" message in #welcome after a
 * successful Link. Uses the bot token to author the message.
 */
export async function postWelcomeMessage(discordUserId: string): Promise<void> {
  const content =
    `👋 Welcome to the community, <@${discordUserId}>! You're all linked up. 🎉\n` +
    `\n` +
    `Here's what to do next:\n` +
    `- Chat here in #welcome to start earning Social Coin\n` +
    `- Points show up automatically as you engage\n` +
    `- You'll unlock tier roles (Bronze → Silver → Gold) as your balance grows\n` +
    `\n` +
    `Have fun!`

  const res = await fetchWithRetry(
    `https://discord.com/api/channels/${env.discord.welcomeChannelId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bot ${env.discord.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        allowed_mentions: { users: [discordUserId] },
      }),
    },
    'welcome post'
  )
  if (!res.ok) {
    throw new Error(`welcome post failed: ${res.status}`)
  }
}
