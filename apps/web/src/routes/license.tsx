import { createFileRoute } from '@tanstack/react-router'

const githubLicenseUrl =
  'https://github.com/FrimJo/spell-casters-mono/blob/main/LICENSE'

export const Route = createFileRoute('/license')({
  ssr: true,
  component: LicenseRoute,
})

function LicenseRoute() {
  return (
    <main className="min-h-screen bg-surface-0 text-text-primary">
      <div className="max-w-3xl gap-4 px-4 py-16 container mx-auto flex flex-col">
        <h1 className="text-2xl font-semibold">License</h1>
        <p className="text-sm text-text-muted">
          Licensed{' '}
          <a
            className="text-brand-muted-foreground hover:text-brand"
            href="https://polyformproject.org/licenses/noncommercial/1.0.0/"
            rel="noreferrer"
            target="_blank"
          >
            PolyForm Noncommercial 1.0.0
          </a>{' '}
          — non-commercial use only.
        </p>
        <a
          className="text-sm text-brand-muted-foreground hover:text-brand"
          href={githubLicenseUrl}
          rel="noreferrer"
          target="_blank"
        >
          View LICENSE on GitHub
        </a>
      </div>
    </main>
  )
}
