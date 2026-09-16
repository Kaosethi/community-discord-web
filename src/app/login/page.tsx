// Login for the "link existing" path. Real password check against the
// mock_game_account table. This is what stops "type someone else's UUID
// and hijack them" — you need the account's password to proceed.

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const err = searchParams.error

  return (
    <main className="page">
      <p className="eyebrow">Link existing account</p>
      <h1>Log in</h1>
      <p className="lede">
        Enter the credentials from the game account you want to link. In
        production this would authenticate against the real game backend.
      </p>

      {err && (
        <span className="status status-danger">
          ⚠ {
            err === 'invalid_credentials' ? 'Wrong username or password.'
            : 'Something went wrong. Please try again.'
          }
        </span>
      )}

      <form method="POST" action="/api/auth/login">
        <div className="field">
          <label htmlFor="username">Username</label>
          <input id="username" name="username" required autoFocus autoComplete="username" />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <div className="actions">
          <button type="submit" className="btn btn-primary">
            Log in & continue to Discord
          </button>
          <a className="btn" href="/">Back</a>
        </div>
      </form>
    </main>
  )
}
