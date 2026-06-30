import { createFileRoute, redirect } from '@tanstack/react-router'

const githubRepositoryUrl = 'https://github.com/FrimJo/spell-coven-mono'

export const Route = createFileRoute('/github')({
  beforeLoad: () => {
    throw redirect({
      href: githubRepositoryUrl,
      statusCode: 307,
    })
  },
})
