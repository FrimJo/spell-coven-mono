import { createFileRoute } from '@tanstack/react-router'

const githubLicenseUrl =
  'https://github.com/FrimJo/spell-coven-mono/blob/main/LICENSE'

export const Route = createFileRoute('/license')({
  component: LicenseRoute,
})

function LicenseRoute() {
  return (
    <main className="bg-surface-0 text-text-primary min-h-screen">
      <div className="container mx-auto flex max-w-3xl flex-col gap-4 px-4 py-16">
        <h1 className="text-2xl font-semibold">License</h1>
        <p className="text-text-muted text-sm">
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
          className="text-brand-muted-foreground text-sm hover:text-brand"
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
