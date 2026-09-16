// Landing page — the two-path choice from F03's locked design.

export default function LandingPage() {
  return (
    <main className="page">
      <p className="eyebrow">Community Discord</p>
      <h1>Join the pre-launch community</h1>
      <p className="lede">
        Link your Discord to unlock member roles, earn Social Coin, and grab
        rewards on launch day.
      </p>

      <div className="actions">
        <a className="btn btn-primary" href="/register">
          Pre-register (I'm new)
        </a>
        <a className="btn" href="/login">
          Link my existing game account
        </a>
      </div>

      <p className="footnote">
        By continuing you agree to link your Discord identity to your community
        profile. See the Discord authorize screen for what we access.
      </p>
    </main>
  )
}
