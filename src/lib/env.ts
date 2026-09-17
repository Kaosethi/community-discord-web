// Env access is centralised here so a missing var is caught once, not everywhere.
//
// IMPORTANT: values are read lazily (via getters). If we read them at module
// load time, Next.js's build step evaluates route modules with no env set
// and the whole build fails. Lazy access defers the check to actual request time.

function required(name: string): string {
  const v = process.env[name]
  if (!v || v.trim() === '') {
    throw new Error(`Missing required env var: ${name}`)
  }
  return v
}

export const env = {
  discord: {
    get clientId() { return required('DISCORD_CLIENT_ID') },
    get clientSecret() { return required('DISCORD_CLIENT_SECRET') },
    get botToken() { return required('DISCORD_BOT_TOKEN') },
    get guildId() { return required('DISCORD_GUILD_ID') },
    get linkedRoleId() { return required('DISCORD_LINKED_ROLE_ID') },
    get welcomeChannelId() { return required('DISCORD_WELCOME_CHANNEL_ID') },
  },
  supabase: {
    get url() { return required('SUPABASE_URL') },
    get serviceRoleKey() { return required('SUPABASE_SERVICE_ROLE_KEY') },
  },
  oauth: {
    get redirectUri() { return required('OAUTH_REDIRECT_URI') },
    get stateSecret() { return required('STATE_SECRET') },
  },
  session: {
    get secret() { return required('SESSION_SECRET') },
  },
} as const
