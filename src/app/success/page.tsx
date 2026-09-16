// Success page after the OAuth callback has written platform_identity.

export default function SuccessPage({
  searchParams,
}: {
  searchParams: { player_id?: string; mode?: string; queued?: string }
}) {
  const roleQueued = searchParams.queued === '1'

  return (
    <main className="page">
      <span className="status status-ok">✓ Linked</span>
      <h1>You&apos;re in.</h1>
      <p className="lede">
        {searchParams.mode === 'preregister'
          ? "Pre-registration complete. Your Social Coin balance will accrue against this account."
          : "Your Discord is now linked to your game account."}
      </p>

      {roleQueued && (
        <p className="footnote">
          You aren&apos;t in the community server yet — join it now and the{' '}
          <b>Linked</b> role will be applied automatically.
        </p>
      )}

      <dl className="details">
        <dt>Player ID</dt>
        <dd>{searchParams.player_id ?? '(hidden)'}</dd>
        <dt>Mode</dt>
        <dd>{searchParams.mode ?? '(unknown)'}</dd>
      </dl>

      <p className="footnote">
        Next: hop into <a href="#">the Discord server</a> and start earning
        Social Coin in the quest channels.
      </p>
    </main>
  )
}
