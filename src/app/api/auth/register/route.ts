// Mock pre-register: create a game account, hash the password, set a session
// cookie carrying the new player_id, then send the user to Discord OAuth.

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabase } from '@/lib/supabase'
import { setSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const username = (form.get('username') as string | null)?.trim() ?? ''
  const password = (form.get('password') as string | null) ?? ''
  const confirm = (form.get('confirm') as string | null) ?? ''

  if (username.length < 3) return redirectWith(req, '/register', 'username_short')
  if (password.length < 6) return redirectWith(req, '/register', 'password_short')
  if (password !== confirm) return redirectWith(req, '/register', 'password_mismatch')

  const passwordHash = await bcrypt.hash(password, 10)
  const playerId = crypto.randomUUID()

  const { error } = await supabase.from('mock_game_account').insert({
    player_id: playerId,
    username,
    password_hash: passwordHash,
  })

  if (error) {
    if (error.code === '23505') {
      // unique_violation — username taken
      return redirectWith(req, '/register', 'username_taken')
    }
    console.error('[auth/register] insert failed', error)
    return redirectWith(req, '/register', 'unknown')
  }

  setSession(playerId, username)
  return NextResponse.redirect(new URL('/api/oauth/start?mode=preregister', req.url), { status: 303 })
}

function redirectWith(req: NextRequest, path: string, err: string) {
  const url = new URL(path, req.url)
  url.searchParams.set('error', err)
  return NextResponse.redirect(url, { status: 303 })
}
