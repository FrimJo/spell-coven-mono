import z from 'zod'

export const isE2ePreview = z.coerce
  .boolean()
  .safeParse(process.env.E2E_TEST).data

const liveKitEnvSchema = z.object({
  serverUrl: z.url('LIVEKIT_URL must be a valid URL'),
  apiKey: z.string().min(1, 'LIVEKIT_API_KEY is required'),
  apiSecret: z.string().min(1, 'LIVEKIT_API_SECRET is required'),
})

export function getLiveKitEnv() {
  return liveKitEnvSchema.parse({
    serverUrl: process.env.LIVEKIT_URL,
    apiKey: process.env.LIVEKIT_API_KEY,
    apiSecret: process.env.LIVEKIT_API_SECRET,
  })
}
