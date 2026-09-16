// Mock login: verify username + password against mock_game_account, set
// session cookie carrying the account's player_id, redirect to Discord OAuth.
//
// This is the check that makes the "link existing" path safe. Without a
// real password on the account, no one else can drive the OAuth flow as
// that account, so Path D (self-serve switch) can't be used to hijack.

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabase } from '@/lib/supabase'
import { setSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const username = (form.get('username') as string | null)?.trim() ?? ''
  const password = (form.get('password') as string | null) ?? ''

  if (!username || !password) {
    return redirectWith(req, 'invalid_credentials')
  }

  const { data: account } = await supabase
    .from('mock_game_account')
    .select('player_id, username, password_hash')
    .eq('username', username)
    .maybeSingle()

  // Timing: always run bcrypt.compare even if the user doesn't exist, so
  // response time doesn't leak whether the username is registered.
  const hash = account?.password_hash ?? '$2a$10$00000000000000000000000000000000000000000000000000000'
  const ok = await bcrypt.compare(password, hash)

  if (!account || !ok) {
    return redirectWith(req, 'invalid_credentials')
  }

  setSession(account.player_id, account.username)
  return NextResponse.redirect(new URL('/api/oauth/start?mode=link', req.url), { status: 303 })
}

function redirectWith(req: NextRequest, err: string) {
  const url = new URL('/login', req.url)
  url.searchParams.set('error', err)
  return NextResponse.redirect(url, { status: 303 })
}
