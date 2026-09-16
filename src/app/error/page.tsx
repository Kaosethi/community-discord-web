// Error page — one page that renders differently based on ?type=.
// Types map to the F03 journey diagram's error outcomes.

interface ErrorInfo {
  tone: 'warn' | 'danger'
  title: string
  message: string
  action?: string
}

const ERRORS: Record<string, ErrorInfo> = {
  cancelled: {
    tone: 'warn',
    title: 'Link cancelled',
    message:
      "You cancelled the Discord authorization. No account was linked. You can start over any time.",
    action: 'Try again',
  },
  state_invalid: {
    tone: 'warn',
    title: 'Link expired',
    message:
      "This link expired or was tampered with. Please start again from the landing page.",
    action: 'Start over',
  },
  collision: {
    tone: 'danger',
    title: 'This Discord is already linked',
    message:
      "This Discord account is linked to a different game account. If this is your Discord, please contact support with your Discord username so we can help sort it out.",
    action: 'Back to landing',
  },
  cooldown: {
    tone: 'warn',
    title: 'Cooldown active',
    message:
      "You recently switched linked Discord accounts. You can switch again after the 7-day cooldown ends.",
    action: 'Back to landing',
  },
  rate_limit: {
    tone: 'warn',
    title: 'Too many switches',
    message:
      "You've hit the annual switch limit. Please contact support if you need help.",
    action: 'Back to landing',
  },
  discord_down: {
    tone: 'warn',
    title: 'Discord is having trouble',
    message:
      "We couldn't reach Discord to complete your link. Please try again in a moment.",
    action: 'Try again',
  },
  unknown: {
    tone: 'warn',
    title: 'Something went wrong',
    message:
      "The link didn't complete. If this keeps happening, please contact support.",
    action: 'Back to landing',
  },
    already_linked: {
    tone: 'warn',
    title: 'This game account already has a Discord',
    message:
      "This game account is already linked to a Discord. To switch to a different Discord, please contact support — self-serve switching isn't available in the PoC.",
    action: 'Back to landing',
  },
}

export default function ErrorPage({
  searchParams,
}: {
  searchParams: { type?: string; existing?: string }
}) {
  const info = ERRORS[searchParams.type ?? 'unknown'] ?? ERRORS.unknown

  const message =
    searchParams.type === 'already_linked' && searchParams.existing
      ? `This game account is already linked to Discord @${searchParams.existing}. To switch to a different Discord, please contact support — self-serve switching isn't available in the PoC.`
      : info.message

  return (
    <main className="page">
      <span className={`status status-${info.tone}`}>
        {info.tone === 'danger' ? '⚠' : 'ⓘ'} {info.title}
      </span>
      <h1>{info.title}</h1>
      <p className="lede">{info.message}</p>
      {info.action && (
        <div className="actions">
          <a className="btn btn-primary" href="/">
            {info.action}
          </a>
        </div>
      )}
    </main>
  )
}
