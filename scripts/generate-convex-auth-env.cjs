const { generateKeyPairSync } = require('crypto')

const siteUrl = 'http://127.0.0.1:3210'
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
})
const kid = 'convex-e2e'
const privateJwk = privateKey.export({ format: 'jwk' })
const publicJwk = publicKey.export({ format: 'jwk' })
const withMeta = (jwk, keyOps) => ({
  ...jwk,
  use: 'sig',
  alg: 'RS256',
  kid,
  key_ops: keyOps,
})
const jwtPrivateKey = JSON.stringify(withMeta(privateJwk, ['sign']))
const jwks = JSON.stringify({ keys: [withMeta(publicJwk, ['verify'])] })

const lines = [
  `SITE_URL=${siteUrl}`,
  `JWT_PRIVATE_KEY=${jwtPrivateKey}`,
  `JWKS=${jwks}`,
  'CONVEX_AUTH_TEST_MODE=true',
]

process.stdout.write(lines.join('\n'))
