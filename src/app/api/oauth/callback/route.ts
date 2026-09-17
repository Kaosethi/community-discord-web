// OAuth callback — the heart of F03.
//
// Handles all five outcomes from the F03 journey diagram:
//   Path A — first link (INSERT + role assign)
//   Path B — already linked, same player (no-op, ensure role)
//   Path C — collision (same Discord, different player_id) — REFUSE + flag
//   Path D — same player, different Discord — self-serve switch with guards
//   Path E — user cancelled at Discord — no writes

import { NextRequest, NextResponse } from 'next/server'
import { decodeState } from '@/lib/state'
import { supabase } from '@/lib/supabase'
import { exchangeCode, fetchUser, assignLinkedRole, postWelcomeMessage } from '@/lib/discord'

const CONSENT_VERSION = 'v1-2026-09'

// Q1 locked: REFUSE Path D self-serve switching in the mock PoC.
// Real launch flips this to true AFTER adding email confirmation + MFA.
const ALLOW_SELF_SERVE_SWITCH = false

// Config knobs used only if ALLOW_SELF_SERVE_SWITCH is later enabled.
const COOLDOWN_MS = 0            // 7 * 24 * 60 * 60 * 1000 in prod
const MAX_UNLINKS_PER_YEAR = 999 // 3 in prod

function redirect(req: NextRequest, path: string, params?: Record<string, string>) {
  const url = new URL(path, req.url)
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return NextResponse.redirect(url)
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams

  // Path E — user cancelled at Discord's consent screen.
  if (sp.get('error') === 'access_denied') {
    return redirect(req, '/error', { type: 'cancelled' })
  }

  const code = sp.get('code')
  const stateRaw = sp.get('state')
  if (!code || !stateRaw) return redirect(req, '/error', { type: 'state_invalid' })

  // Verify signed state — decoded payload survives the browser round-trip.
  let state
  try {
    state = decodeState(stateRaw)
  } catch {
    return redirect(req, '/error', { type: 'state_invalid' })
  }

  // Exchange authorization code → access token → discord user.
  let discordUser
  try {
    const { access_token } = await exchangeCode(code)
    discordUser = await fetchUser(access_token)
  } catch (err) {
    console.error('[oauth callback] discord api failure', err)
    return redirect(req, '/error', { type: 'discord_down' })
  }

  const discordId = discordUser.id
  const username = discordUser.global_name ?? discordUser.username
  const playerId = state.playerId
  const mode = state.mode

  // Check existing rows for this discord_id (any status).
  const { data: byDiscord } = await supabase
    .from('platform_identity')
    .select('id, player_id, status')
    .eq('platform', 'discord')
    .eq('external_id', discordId)
    .limit(1)
    .maybeSingle()

  if (byDiscord) {
    if (byDiscord.player_id === playerId) {
      // Path B — already linked to same player. Idempotent: reactivate if unlinked.
      if (byDiscord.status !== 'active') {
        // Before reactivating, unlink any OTHER active row for this player,
        // otherwise the partial-unique-index on (player_id, platform)
        // WHERE status='active' would blow up.
        await supabase
          .from('platform_identity')
          .update({ status: 'unlinked', unlinked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('platform', 'discord')
          .eq('player_id', playerId)
          .eq('status', 'active')
          .neq('id', byDiscord.id)

        await supabase
          .from('platform_identity')
          .update({ status: 'active', unlinked_at: null, updated_at: new Date().toISOString() })
          .eq('id', byDiscord.id)
      }
      const roleResult = await tryAssignRole(discordId)
      return redirect(req, '/success', {
        player_id: playerId,
        mode,
        queued: roleResult.queued ? '1' : '0',
      })
    }
    // Path C — same Discord, different player. REFUSE and flag.
    await supabase.from('abuse_flag').insert({
      discord_id: discordId,
      reason: 'oauth_collision',
      severity: 3,
      evidence: {
        attempted_player_id: playerId,
        existing_player_id: byDiscord.player_id,
        mode,
        username,
      },
    })
    return redirect(req, '/error', { type: 'collision' })
  }

  // No existing row for this discord_id. Check if this player already has a
  // different active Discord — that's Path D (self-serve switch).
  const { data: byPlayer } = await supabase
    .from('platform_identity')
    .select('id, external_id, username, linked_at, unlinked_at')
    .eq('platform', 'discord')
    .eq('player_id', playerId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

   if (byPlayer) {
    // Q1 locked: refuse the switch in the mock PoC.
    if (!ALLOW_SELF_SERVE_SWITCH) {
      return redirect(req, '/error', {
        type: 'already_linked',
        existing: byPlayer.username ?? 'a previous Discord account',
      })
    }

    // Cooldown check — 7 days since last unlink for this player_id (config-gated).
    if (COOLDOWN_MS > 0) {
      const { data: recentUnlink } = await supabase
        .from('platform_identity')
        .select('unlinked_at')
        .eq('platform', 'discord')
        .eq('player_id', playerId)
        .eq('status', 'unlinked')
        .order('unlinked_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (recentUnlink?.unlinked_at) {
        const ageMs = Date.now() - new Date(recentUnlink.unlinked_at).getTime()
        if (ageMs < COOLDOWN_MS) return redirect(req, '/error', { type: 'cooldown' })
      }
    }

    // Rate limit — max N unlinks per calendar year for this player_id.
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()
    const { count: unlinksThisYear } = await supabase
      .from('platform_identity')
      .select('*', { count: 'exact', head: true })
      .eq('platform', 'discord')
      .eq('player_id', playerId)
      .eq('status', 'unlinked')
      .gte('unlinked_at', yearStart)
    if ((unlinksThisYear ?? 0) >= MAX_UNLINKS_PER_YEAR) {
      return redirect(req, '/error', { type: 'rate_limit' })
    }

    // Mark the old row unlinked; the new row is inserted below.
    await supabase
      .from('platform_identity')
      .update({ status: 'unlinked', unlinked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', byPlayer.id)
  }

  // Path A — first link (or Path D after old row soft-deleted). Insert new row.
  const now = new Date().toISOString()
  const { error: insertErr } = await supabase.from('platform_identity').insert({
    player_id: playerId,
    platform: 'discord',
    external_id: discordId,
    username,
    linked_at: now,
    status: 'active',
    consent_version: CONSENT_VERSION,
    consent_at: now,
  })
  if (insertErr) {
    // Race with a concurrent insert on the same discord_id → treat as collision.
    if (insertErr.code === '23505') {
      return redirect(req, '/error', { type: 'collision' })
    }
    console.error('[oauth callback] insert platform_identity failed', insertErr)
    return redirect(req, '/error', { type: 'unknown' })
  }

  // Funnel event — F11 reads this later.
  await supabase.from('member_event').insert({
    discord_id: discordId,
    player_id: playerId,
    event_type: 'linked',
    metadata: { mode, username },
  })

  // Assign the Linked role. If the user isn't in the server yet, this
  // returns queued=true and F02's join handler will apply the role later.
  const roleResult = await tryAssignRole(discordId)

  // Post the welcome message in #welcome — only if role actually applied
  // (user in server). Non-fatal on failure — user is still linked.
  if (roleResult.applied) {
    try {
      await postWelcomeMessage(discordId)
    } catch (err) {
      console.error('[oauth callback] welcome post failed', err)
    }
  }

  return redirect(req, '/success', {
    player_id: playerId,
    mode,
    queued: roleResult.queued ? '1' : '0',
  })
}

async function tryAssignRole(discordId: string): Promise<{ applied: boolean; queued: boolean }> {
  try {
    return await assignLinkedRole(discordId)
  } catch (err) {
    // Role assign failed non-recoverably. Don't fail the whole link —
    // log and consider it queued for the bot to retry.
    console.error('[oauth callback] role assign failed, will retry via bot', err)
    return { applied: false, queued: true }
  }
}
