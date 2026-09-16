// Signed session cookie — short-lived (10 min), carries the mock player_id
// so /api/oauth/start knows who the user authenticated as.
//
// This is the layer that prevents "type someone else's UUID to hijack them".
// The cookie can only be created by a successful /api/auth/login or /register.

import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { env } from './env'

const COOKIE_NAME = 'session'
const TTL_MS = 10 * 60 * 1000

interface SessionPayload {
  playerId: string
  username: string
  issuedAt: number
}

function sign(payload: string): string {
  return createHmac('sha256', env.session.secret).update(payload).digest('base64url')
}

function encode(playerId: string, username: string): string {
  const payload: SessionPayload = { playerId, username, issuedAt: Date.now() }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = sign(encoded)
  return `${encoded}.${sig}`
}

function decode(raw: string): SessionPayload | null {
  const parts = raw.split('.')
  if (parts.length !== 2) return null
  const [encoded, sig] = parts as [string, string]

  const expected = sign(encoded)
  const a = Buffer.from(sig, 'base64url')
  const b = Buffer.from(expected, 'base64url')
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  let payload: SessionPayload
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (Date.now() - payload.issuedAt > TTL_MS) return null
  return payload
}

export function setSession(playerId: string, username: string): void {
  const value = encode(playerId, username)
  cookies().set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TTL_MS / 1000,
    path: '/',
  })
}

export function getSession(): SessionPayload | null {
  const raw = cookies().get(COOKIE_NAME)?.value
  if (!raw) return null
  return decode(raw)
}

export function clearSession(): void {
  cookies().delete(COOKIE_NAME)
}
