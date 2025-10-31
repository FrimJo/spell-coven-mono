export { DiscordOAuthClient, OAuthError } from './DiscordOAuthClient.js'
export type { DiscordOAuthClientConfig } from './DiscordOAuthClient.js'

export { DiscordGatewayClient } from './DiscordGatewayClient.js'

export type {
  ConnectionStateEvent,
  EventListener,
  GatewayEventData,
} from './DiscordGatewayClient.js'

export { DiscordRestClient, DiscordRestError } from './DiscordRestClient.js'
export type { DiscordRestClientConfig } from './DiscordRestClient.js'

export type {
  AddGuildMemberRequest,
  CreateRoleRequest,
  Role,
  VoiceState,
  GuildMember,
} from '../types/rest-schemas.js'

export { DiscordRtcClient } from './DiscordRtcClient.js'
