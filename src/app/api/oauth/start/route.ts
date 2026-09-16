// OAuth start: read the authenticated player_id from the session cookie
// (set by /api/auth/register or /api/auth/login), build a signed state,
// redirect to Discord authorize.
//
// If there's no session cookie, redirect back to the appropriate auth page.

import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { encodeState, type OAuthMode } from '@/lib/state'
import { getSession } from '@/lib/session'

function toDiscordAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.discord.clientId,
    response_type: 'code',
    scope: 'identify',
    redirect_uri: env.oauth.redirectUri,
    state,
    prompt: 'consent',
  })
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`
}

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('mode') as OAuthMode | null
  if (mode !== 'preregister' && mode !== 'link') {
    return NextResponse.redirect(new URL('/error?type=unknown', req.url))
  }

  // No fallback to query-param player_id — that was the hijack hole.
  // Must have a valid session cookie set by a real auth step.
  const session = getSession()
  if (!session) {
    return NextResponse.redirect(new URL(mode === 'preregister' ? '/register' : '/login', req.url))
  }

  const state = encodeState({ playerId: session.playerId, mode })
  return NextResponse.redirect(toDiscordAuthorizeUrl(state))
}
