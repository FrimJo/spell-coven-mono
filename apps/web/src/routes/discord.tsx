import { createFileRoute, redirect } from '@tanstack/react-router'

const discordInviteUrl = 'https://discord.gg/fndz4wXQGJ'

export const Route = createFileRoute('/discord')({
  beforeLoad: () => {
    throw redirect({
      href: discordInviteUrl,
      statusCode: 307,
    })
  },
})
