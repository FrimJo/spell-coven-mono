import z from 'zod'

export const isE2ePreview = z.coerce
  .boolean()
  .safeParse(process.env.E2E_TEST).data
