import { convex } from '@/integrations/convex/provider'
import { api } from '@convex/_generated/api'
import z from 'zod'

const previewLoginResponseSchema = z.object({
  userId: z.string(),
  token: z.string(),
  refreshToken: z.string(),
})

export type PreviewLoginResponse = z.infer<typeof previewLoginResponseSchema>

export async function exchangePreviewLoginCode(params: {
  code: string
  userId?: string
}): Promise<PreviewLoginResponse> {
  const result = await convex.action(api.auth.previewLogin as any, {
    code: params.code,
    userId: params.userId,
  })
  return previewLoginResponseSchema.parse(result)
}
