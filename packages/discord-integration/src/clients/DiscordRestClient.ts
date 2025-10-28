/**
 * Discord REST API Client
 *
 * Provides methods for interacting with Discord REST API with:
 * - Automatic rate limit handling with exponential backoff
 * - Request validation using Zod schemas
 * - Comprehensive error handling
 * - Audit log reasons for all mutations
 */

import type {
  AddGuildMemberRequest,
  ChannelResponse,
  CreateRoleRequest,
  CreateVoiceChannelRequest,
  DiscordErrorResponse,
  GuildChannelListResponse,
  GuildMember,
  GuildRoleListResponse,
  GuildVoiceStateSnapshot,
  MessageResponse,
  Role,
  SendMessageRequest,
  VoiceState,
} from '../types/rest-schemas.js'
import {
  AddGuildMemberRequestSchema,
  ChannelResponseSchema,
  CreateRoleRequestSchema,
  CreateVoiceChannelRequestSchema,
  DiscordErrorResponseSchema,
  GuildChannelListResponseSchema,
  GuildRoleListResponseSchema,
  GuildVoiceStateSnapshotSchema,
  GuildMemberSchema,
  MessageResponseSchema,
  RateLimitResponseSchema,
  RoleSchema,
  SendMessageRequestSchema,
  VoiceStateSchema,
} from '../types/rest-schemas.js'

const DISCORD_API_BASE = 'https://discord.com/api/v10'
const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 1000

export interface DiscordRestClientConfig {
  botToken: string
  maxRetries?: number
  initialBackoffMs?: number
  onRateLimit?: (retryAfter: number, isGlobal: boolean) => void
  onError?: (error: DiscordRestError) => void
}

export class DiscordRestError extends Error {
  constructor(
    message: string,
    public code?: number,
    public status?: number,
    public response?: DiscordErrorResponse,
  ) {
    super(message)
    this.name = 'DiscordRestError'
  }
}

export class DiscordRestClient {
  private botToken: string
  private maxRetries: number
  private initialBackoffMs: number
  private onRateLimit?: (retryAfter: number, isGlobal: boolean) => void
  private onError?: (error: DiscordRestError) => void

  constructor(config: DiscordRestClientConfig) {
    this.botToken = config.botToken
    this.maxRetries = config.maxRetries ?? MAX_RETRIES
    this.initialBackoffMs = config.initialBackoffMs ?? INITIAL_BACKOFF_MS
    this.onRateLimit = config.onRateLimit
    this.onError = config.onError
  }

  // ============================================================================
  // Channel Methods
  // ============================================================================

  /**
   * Ensure a user is in a guild
   */
  async ensureUserInGuild(
    guildId: string,
    userId: string,
    request: { access_token: string },
  ): Promise<GuildMember | null> {
    const response = await this.request<GuildMember | undefined>(
      'PUT',
      `/guilds/${guildId}/members/${userId}`,
      request,
    )
    if (!response) {
      return null
    }
    return GuildMemberSchema.parse(response)
  }

  /**
   * Create a voice channel in a guild
   */
  async createVoiceChannel(
    guildId: string,
    request: CreateVoiceChannelRequest,
    auditLogReason?: string,
  ): Promise<ChannelResponse> {
    // Validate request
    const validatedRequest = CreateVoiceChannelRequestSchema.parse(request)

    const response = await this.request<ChannelResponse>(
      'POST',
      `/guilds/${guildId}/channels`,
      {
        ...validatedRequest,
        type: 2, // Voice channel
      },
      auditLogReason,
    )

    return ChannelResponseSchema.parse(response)
  }

  /**
   * Fetch a channel by ID
   */
  async getChannel(channelId: string): Promise<ChannelResponse> {
    const response = await this.request<ChannelResponse>(
      'GET',
      `/channels/${channelId}`,
    )

    return ChannelResponseSchema.parse(response)
  }

  /**
   * Fetch a guild role by ID
   */
  async getGuildRole(guildId: string, roleId: string): Promise<Role> {
    const response = await this.request<GuildRoleListResponse>(
      'GET',
      `/guilds/${guildId}/roles`,
    )

    const roles = GuildRoleListResponseSchema.parse(response)
    const role = roles.find((entry) => entry.id === roleId)

    if (!role) {
      throw new DiscordRestError(
        `Role ${roleId} not found in guild ${guildId}`,
        10011,
        404,
      )
    }

    return role
  }

  /**
   * Fetch a guild member by ID
   */
  async getGuildMember(guildId: string, userId: string): Promise<GuildMember> {
    const response = await this.request<GuildMember>(
      'GET',
      `/guilds/${guildId}/members/${userId}`,
    )

    return GuildMemberSchema.parse(response)
  }

  /**
   * Snapshot current voice states for a guild
   */
  async getVoiceStateSnapshot(
    guildId: string,
    channelId?: string,
  ): Promise<VoiceState[]> {
    const response = await this.request<GuildVoiceStateSnapshot>(
      'GET',
      `/guilds/${guildId}/voice-states`,
    )

    const snapshot = GuildVoiceStateSnapshotSchema.parse(response)

    const states = snapshot.voice_states.map((state) =>
      VoiceStateSchema.parse(state),
    )

    if (channelId) {
      return states.filter((state) => state.channel_id === channelId)
    }

    return states
  }

  /**
   * Delete a channel
   */
  async deleteChannel(
    channelId: string,
    auditLogReason?: string,
  ): Promise<ChannelResponse> {
    const response = await this.request<ChannelResponse>(
      'DELETE',
      `/channels/${channelId}`,
      undefined,
      auditLogReason,
    )

    return ChannelResponseSchema.parse(response)
  }

  /**
   * Get a list of channels in a guild
   */
  async getChannels(guildId: string): Promise<GuildChannelListResponse> {
    const response = await this.request<GuildChannelListResponse>(
      'GET',
      `/guilds/${guildId}/channels`,
    )

    return GuildChannelListResponseSchema.parse(response)
  }

  /**
   * Create a role in a guild
   */
  async createRole(
    guildId: string,
    request: CreateRoleRequest,
    auditLogReason?: string,
  ): Promise<Role> {
    const validatedRequest = CreateRoleRequestSchema.parse(request)

    const response = await this.request<Role>(
      'POST',
      `/guilds/${guildId}/roles`,
      validatedRequest,
      auditLogReason,
    )

    return RoleSchema.parse(response)
  }

  /**
   * Delete a role in a guild
   */
  async deleteRole(
    guildId: string,
    roleId: string,
    auditLogReason?: string,
  ): Promise<void> {
    await this.request<void>(
      'DELETE',
      `/guilds/${guildId}/roles/${roleId}`,
      undefined,
      auditLogReason,
    )
  }

  /**
   * Add (or update) a guild member using an OAuth token
   */
  async addGuildMember(
    guildId: string,
    userId: string,
    request: AddGuildMemberRequest,
    auditLogReason?: string,
  ): Promise<GuildMember | null> {
    const validatedRequest = AddGuildMemberRequestSchema.parse(request)

    const response = await this.request<GuildMember | undefined>(
      'PUT',
      `/guilds/${guildId}/members/${userId}`,
      validatedRequest,
      auditLogReason,
    )

    if (!response) {
      return null
    }

    return GuildMemberSchema.parse(response)
  }

  /**
   * Add a role to a guild member
   */
  async addMemberRole(
    guildId: string,
    userId: string,
    roleId: string,
    auditLogReason?: string,
  ): Promise<void> {
    await this.request<void>(
      'PUT',
      `/guilds/${guildId}/members/${userId}/roles/${roleId}`,
      undefined,
      auditLogReason,
    )
  }

  /**
   * Remove a role from a guild member
   */
  async removeMemberRole(
    guildId: string,
    userId: string,
    roleId: string,
    auditLogReason?: string,
  ): Promise<void> {
    await this.request<void>(
      'DELETE',
      `/guilds/${guildId}/members/${userId}/roles/${roleId}`,
      undefined,
      auditLogReason,
    )
  }

  /**
   * Count active voice connections for a channel
   */
  async countVoiceChannelMembers(
    guildId: string,
    channelId: string,
  ): Promise<number> {
    const voiceStates = await this.getVoiceStateSnapshot(guildId, channelId)
    return voiceStates.length
  }

  // ============================================================================
  // Message Methods
  // ============================================================================

  /**
   * Send a message to a channel
   */
  async sendMessage(
    channelId: string,
    request: SendMessageRequest,
  ): Promise<MessageResponse> {
    // Validate request
    const validatedRequest = SendMessageRequestSchema.parse(request)

    const response = await this.request<MessageResponse>(
      'POST',
      `/channels/${channelId}/messages`,
      validatedRequest,
    )

    return MessageResponseSchema.parse(response)
  }

  // ============================================================================
  // Private HTTP Methods
  // ============================================================================

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    auditLogReason?: string,
  ): Promise<T> {
    let lastError: DiscordRestError | null = null

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const headers: Record<string, string> = {
          Authorization: `Bot ${this.botToken}`,
          'Content-Type': 'application/json',
        }

        if (auditLogReason) {
          headers['X-Audit-Log-Reason'] = encodeURIComponent(auditLogReason)
        }

        const response = await fetch(`${DISCORD_API_BASE}${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        })

        // Handle rate limits (429)
        if (response.status === 429) {
          const rateLimitData = await response.json()
          const rateLimit = RateLimitResponseSchema.parse(rateLimitData)

          if (this.onRateLimit) {
            this.onRateLimit(rateLimit.retry_after, rateLimit.global)
          }

          if (attempt < this.maxRetries) {
            const waitMs = rateLimit.retry_after * 1000
            console.warn(
              `[DiscordRestClient] Rate limited. Retrying after ${waitMs}ms (attempt ${attempt + 1}/${this.maxRetries})`,
            )
            await this.sleep(waitMs)
            continue
          } else {
            lastError = new DiscordRestError(
              `Rate limit exceeded after ${this.maxRetries} retries`,
              rateLimit.code,
              429,
            )
            break
          }
        }

        // Handle other errors
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          const discordError = DiscordErrorResponseSchema.safeParse(errorData)

          const error = new DiscordRestError(
            discordError.success
              ? discordError.data.message
              : `Discord API error: ${response.status} ${response.statusText}`,
            discordError.success ? discordError.data.code : undefined,
            response.status,
            discordError.success ? discordError.data : undefined,
          )

          // Retry on 5xx errors
          if (response.status >= 500 && attempt < this.maxRetries) {
            const backoffMs = this.calculateBackoff(attempt)
            console.warn(
              `[DiscordRestClient] Server error ${response.status}. Retrying after ${backoffMs}ms (attempt ${attempt + 1}/${this.maxRetries})`,
            )
            await this.sleep(backoffMs)
            lastError = error
            continue
          }

          throw error
        }

        if (response.status === 204) {
          return undefined as T
        }

        return await response.json()
      } catch (error) {
        if (error instanceof DiscordRestError) {
          lastError = error
          if (this.onError) {
            this.onError(error)
          }
          throw error
        }

        // Network or other errors - retry
        if (attempt < this.maxRetries) {
          const backoffMs = this.calculateBackoff(attempt)
          console.warn(
            `[DiscordRestClient] Request failed. Retrying after ${backoffMs}ms (attempt ${attempt + 1}/${this.maxRetries})`,
            error,
          )
          lastError = new DiscordRestError(
            error instanceof Error ? error.message : 'Unknown error',
          )
          await this.sleep(backoffMs)
          continue
        }

        throw new DiscordRestError(
          error instanceof Error ? error.message : 'Unknown error',
        )
      }
    }

    // If we get here, we've exhausted all retries
    throw (
      lastError ||
      new DiscordRestError(`Request failed after ${this.maxRetries} retries`)
    )
  }

  private calculateBackoff(attempt: number): number {
    return this.initialBackoffMs * Math.pow(2, attempt)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
