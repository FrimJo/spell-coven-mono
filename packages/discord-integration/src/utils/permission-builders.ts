import { PermissionFlagsBits } from 'discord-api-types/v10'

export interface PermissionOverwrite {
  id: string
  type: 0 | 1
  allow: string
  deny: string
}

const EVERYONE_DENY =
  PermissionFlagsBits.ViewChannel | PermissionFlagsBits.Connect

const ROOM_MEMBER_ALLOW =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.Connect |
  PermissionFlagsBits.Speak |
  PermissionFlagsBits.Stream

const BOT_ALLOW =
  ROOM_MEMBER_ALLOW |
  PermissionFlagsBits.MoveMembers |
  PermissionFlagsBits.MuteMembers |
  PermissionFlagsBits.DeafenMembers |
  PermissionFlagsBits.ManageChannels

const ZERO = 0n

function toStringBits(bits: bigint): string {
  return bits.toString()
}

export function buildEveryoneDenyOverwrite(
  guildId: string,
): PermissionOverwrite {
  return {
    id: guildId,
    type: 0,
    allow: toStringBits(ZERO),
    deny: toStringBits(EVERYONE_DENY),
  }
}

export function buildRoleAllowOverwrite(roleId: string): PermissionOverwrite {
  return {
    id: roleId,
    type: 0,
    allow: toStringBits(ROOM_MEMBER_ALLOW),
    deny: toStringBits(ZERO),
  }
}

export function buildBotAllowOverwrite(botUserId: string): PermissionOverwrite {
  return {
    id: botUserId,
    type: 1,
    allow: toStringBits(BOT_ALLOW),
    deny: toStringBits(ZERO),
  }
}

export function buildCreatorAllowOverwrite(
  creatorId: string,
): PermissionOverwrite {
  return {
    id: creatorId,
    type: 1,
    allow: toStringBits(ROOM_MEMBER_ALLOW),
    deny: toStringBits(ZERO),
  }
}

export function buildRoomPermissionOverwrites(options: {
  guildId: string
  roleId: string
  botUserId: string
  creatorId?: string
}): PermissionOverwrite[] {
  const overwrites: PermissionOverwrite[] = [
    buildEveryoneDenyOverwrite(options.guildId),
    buildRoleAllowOverwrite(options.roleId),
    buildBotAllowOverwrite(options.botUserId),
  ]

  if (options.creatorId) {
    overwrites.push(buildCreatorAllowOverwrite(options.creatorId))
  }

  return overwrites
}
