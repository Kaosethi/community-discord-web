# Community Discord — Web

Next.js app that hosts:

1. **F03 OAuth link** — the "1-Click Pre-Register" flow. Landing page → register / login → Discord OAuth → callback with all five outcome paths.
2. **F16 Web-Shop** (later) — the launch-day redemption UI. Reuses the auth flow from F03 and the same Supabase schema.

## What's real vs mocked

- **Real**: Discord OAuth handshake, HMAC-signed state, HMAC-signed session cookies, all five outcome paths (A/B/C/D/E), abuse guards on Path D, `platform_identity` writes, `member_event` writes, `abuse_flag` writes on collisions, role assignment via Discord API.
- **Mocked**: the game account backend. `/register` and `/login` write to a `mock_game_account` table with bcrypt-hashed passwords. In production this whole path is replaced by the real game backend's auth API. The mock exists specifically to prove the *ownership check* pattern for the demo, not to be shipped.

Deploys to Vercel. Talks to the same Supabase project as the bot.

## Quick start (local dev)

```bash
npm install
cp .env.example .env.local
# Edit .env.local — see the file for each var
# Apply the mock_game_account migration in Supabase SQL Editor:
#   see migration-add-mock-game-account.sql alongside this repo
npm run dev
```

Open http://localhost:3000. Click either button. Complete the Discord OAuth flow (Discord Developer Portal must have `http://localhost:3000/api/oauth/callback` registered as a valid redirect URI). Land on the success page.

## Env vars

| Var | Where |
|---|---|
| `DISCORD_CLIENT_ID` | Developer Portal → OAuth2 → General |
| `DISCORD_CLIENT_SECRET` | Same page, Reset Secret |
| `DISCORD_BOT_TOKEN` | Bot tab → same token you already have for the worker |
| `DISCORD_GUILD_ID` | Right-click your server → Copy Server ID |
| `DISCORD_LINKED_ROLE_ID` | `1549269893600383026` (already filled in `.env.example`) |
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page, `sb_secret_...` |
| `OAUTH_REDIRECT_URI` | `http://localhost:3000/api/oauth/callback` (dev) or `https://<your-app>.vercel.app/api/oauth/callback` (prod) |
| `STATE_SECRET` | `openssl rand -hex 32` (or any long random hex string) |
| `SESSION_SECRET` | Same generation as `STATE_SECRET`, different value. Signs the session cookie. |

## Register the callback URL in Discord

Before OAuth works, both dev and prod callback URLs must be in the Developer Portal:

1. https://discord.com/developers/applications → your app → **OAuth2** → **General**
2. Under **Redirects**, add both:
   - `http://localhost:3000/api/oauth/callback`
   - `https://<your-vercel-domain>/api/oauth/callback` (after you deploy)
3. Save.

## Project structure

```
src/
├── app/
│   ├── page.tsx                          landing (two buttons)
│   ├── login/page.tsx                    mock game login (link-existing path)
│   ├── success/page.tsx                  success page
│   ├── error/page.tsx                    error page (renders by ?type=)
│   ├── layout.tsx                        root layout
│   ├── globals.css                       design tokens matching the F03 artifact
│   └── api/oauth/
│       ├── start/route.ts                builds signed state, redirects to Discord
│       └── callback/route.ts             the heart of F03 — all 5 outcome paths
└── lib/
    ├── env.ts                            centralised env validation
    ├── state.ts                          HMAC-signed state payload
    ├── supabase.ts                       service_role client
    └── discord.ts                        OAuth exchange + role assign, 3× retry
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. https://vercel.com → **Add New Project** → import the repo.
3. **Environment Variables**: paste every var from `.env.local` (Vercel has a bulk paste UI). Change `OAUTH_REDIRECT_URI` to the Vercel URL.
4. Deploy. Vercel auto-detects Next.js.
5. Copy the deployed URL and add it to Discord Developer Portal → OAuth2 → Redirects. Save.
6. Update `OAUTH_REDIRECT_URI` in Vercel to the new Vercel URL. Redeploy.

Note: the callback URL must match EXACTLY between Discord Portal and `OAUTH_REDIRECT_URI` — any difference (trailing slash, http vs https, wrong port) and Discord refuses the callback.

## The five outcome paths (from F03's journey diagram)

| Path | Trigger | What the callback does | Where the user lands |
|---|---|---|---|
| A | First time linking | INSERT `platform_identity` + `member_event`, assign role | `/success` |
| B | Same Discord + same player_id | No-op (reactivate if previously unlinked), ensure role | `/success` |
| C | Same Discord, different player_id | Write `abuse_flag`, refuse | `/error?type=collision` |
| D | Same player_id, different Discord | Unlink old row, insert new (with cooldown + rate-limit checks) | `/success` |
| E | User cancelled at Discord | No writes | `/error?type=cancelled` |

## Testing the paths locally

1. **Path A** (first link): `/register` → username `alice`, password `secret1`, confirm → Discord OAuth → success.
2. **Path B** (idempotent): back to `/`, click "Link existing", log in as `alice` with `secret1`, complete OAuth with same Discord → success, no new row.
3. **Path C** (collision): register a second account `bob`, then try to log in as `bob` and OAuth with Alice's already-linked Discord → collision error.
4. **Path D** (self-serve switch): log in as `alice` again, OAuth with a *different* Discord account → old row unlinked, new one active. Cooldown/rate-limit checks fire here.
5. **Path E** (cancel): register a new account, then click Cancel on Discord's authorize screen → error page.

**Security test the demo can show:**
- Register `alice` / `secret1`. Note the player_id UUID on the success page.
- Bob knows Alice's UUID (from a leak). Bob tries to visit `/api/oauth/start?mode=link` directly → redirected to `/login` (no session cookie, no bypass).
- Bob tries logging in as `alice` with wrong password → "Wrong username or password".
- Only Alice can drive the OAuth flow as Alice.

Verify each via `select * from platform_identity order by created_at desc` in Supabase.

## Abuse guards (Q1 locked decisions)

The Path D guards live in `src/app/api/oauth/callback/route.ts`:

- `COOLDOWN_MS` — currently `0` for testers. Set to `7 * 24 * 60 * 60 * 1000` for prod.
- `MAX_UNLINKS_PER_YEAR` — currently `999` for testers. Set to `3` for prod.

Both are const values at the top of the file.
