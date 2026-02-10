import z from 'zod'

const previewLoginResponseSchema = z.object({
  userId: z.string(),
  token: z.string(),
  refreshToken: z.string(),
})

export type PreviewLoginResponse = z.infer<typeof previewLoginResponseSchema>

export async function exchangePreviewLoginCode(params: {
  convexUrl: string
  code: string
  userId?: string
}): Promise<PreviewLoginResponse> {
  const response = await fetch(`${params.convexUrl}/api/test/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-PREVIEW-LOGIN': params.code,
    },
    body: JSON.stringify(params.userId ? { userId: params.userId } : {}),
  })

  if (!response.ok) {
    throw new Error(response.status === 401 ? 'Unauthorized' : 'Login failed')
  }

  const body = await response.json()
  return previewLoginResponseSchema.parse(body)
}
