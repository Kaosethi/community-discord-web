// Pre-register form — username + password. Creates a mock game account
// and lands the user in the Discord OAuth flow authenticated as that account.

export default function RegisterPage({ searchParams }: { searchParams: { error?: string } }) {
  const err = searchParams.error

  return (
    <main className="page">
      <p className="eyebrow">Pre-register</p>
      <h1>Create your account</h1>
      <p className="lede">
        Set up your game account. In production this would be your real game
        signup — here it&apos;s a mock that stores a bcrypt-hashed password so
        we can prove real ownership checks on later links.
      </p>

      {err && (
        <span className="status status-danger">
          ⚠ {
            err === 'username_taken' ? 'That username is already taken.'
            : err === 'password_mismatch' ? "Passwords don't match."
            : err === 'password_short' ? 'Password must be at least 6 characters.'
            : err === 'username_short' ? 'Username must be at least 3 characters.'
            : 'Something went wrong. Please try again.'
          }
        </span>
      )}

      <form method="POST" action="/api/auth/register">
        <div className="field">
          <label htmlFor="username">Username</label>
          <input id="username" name="username" required autoFocus minLength={3} autoComplete="username" />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required minLength={6} autoComplete="new-password" />
        </div>
        <div className="field">
          <label htmlFor="confirm">Confirm password</label>
          <input id="confirm" name="confirm" type="password" required minLength={6} autoComplete="new-password" />
        </div>
        <div className="actions">
          <button type="submit" className="btn btn-primary">
            Create account & continue to Discord
          </button>
          <a className="btn" href="/">Back</a>
        </div>
      </form>
    </main>
  )
}
