// HMAC-signed OAuth state payload.
//
// The OAuth flow leaves our server, bounces through Discord, and comes back.
// The state param is how we carry (player_id, mode) across that bounce
// without trusting the browser. We sign it here and verify on the callback.

import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from './env'

export type OAuthMode = 'preregister' | 'link'

export interface StatePayload {
  playerId: string          // UUID (preregister) or real game id (link)
  mode: OAuthMode
  issuedAt: number          // ms since epoch — for TTL check
  nonce: string             // random per-request, defeats replay
}

const TTL_MS = 10 * 60 * 1000  // 10 minutes

function b64url(input: Buffer): string {
  return input.toString('base64url')
}
function fromB64url(input: string): Buffer {
  return Buffer.from(input, 'base64url')
}

function sign(payload: string): string {
  return createHmac('sha256', env.oauth.stateSecret).update(payload).digest('base64url')
}

export function encodeState(input: Omit<StatePayload, 'issuedAt' | 'nonce'>): string {
  const payload: StatePayload = {
    ...input,
    issuedAt: Date.now(),
    nonce: b64url(Buffer.from(crypto.getRandomValues(new Uint8Array(12)))),
  }
  const json = JSON.stringify(payload)
  const encoded = b64url(Buffer.from(json))
  const sig = sign(encoded)
  return `${encoded}.${sig}`
}

export function decodeState(input: string): StatePayload {
  const parts = input.split('.')
  if (parts.length !== 2) throw new Error('malformed state')
  const [encoded, sig] = parts as [string, string]

  const expected = sign(encoded)
  const a = fromB64url(sig)
  const b = fromB64url(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('state signature invalid')
  }

  const json = fromB64url(encoded).toString('utf8')
  const payload = JSON.parse(json) as StatePayload

  if (Date.now() - payload.issuedAt > TTL_MS) {
    throw new Error('state expired')
  }
  return payload
}
