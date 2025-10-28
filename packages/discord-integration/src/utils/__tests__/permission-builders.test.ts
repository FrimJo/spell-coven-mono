import { PermissionFlagsBits } from 'discord-api-types/v10'
import { describe, expect, it } from 'vitest'

import {
  buildBotAllowOverwrite,
  buildCreatorAllowOverwrite,
  buildEveryoneDenyOverwrite,
  buildRoleAllowOverwrite,
  buildRoomPermissionOverwrites,
} from '../permission-builders'

const EVERYONE_DENY = (
  PermissionFlagsBits.ViewChannel | PermissionFlagsBits.Connect
).toString()

const ROOM_MEMBER_ALLOW = (
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.Connect |
  PermissionFlagsBits.Speak |
  PermissionFlagsBits.Stream
).toString()

const BOT_ALLOW = (
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.Connect |
  PermissionFlagsBits.Speak |
  PermissionFlagsBits.Stream |
  PermissionFlagsBits.MoveMembers |
  PermissionFlagsBits.MuteMembers |
  PermissionFlagsBits.DeafenMembers |
  PermissionFlagsBits.ManageChannels |
  PermissionFlagsBits.ManageRoles
).toString()

describe('permission-builders', () => {
  it('builds an @everyone deny overwrite', () => {
    const overwrite = buildEveryoneDenyOverwrite('1')
    expect(overwrite).toEqual({
      id: '1',
      type: 0,
      allow: '0',
      deny: EVERYONE_DENY,
    })
  })

  it('builds a role allow overwrite', () => {
    const overwrite = buildRoleAllowOverwrite('2')
    expect(overwrite).toEqual({
      id: '2',
      type: 0,
      allow: ROOM_MEMBER_ALLOW,
      deny: '0',
    })
  })

  it('builds a bot allow overwrite', () => {
    const overwrite = buildBotAllowOverwrite('3')
    expect(overwrite).toEqual({
      id: '3',
      type: 1,
      allow: BOT_ALLOW,
      deny: '0',
    })
  })

  it('builds an optional creator overwrite', () => {
    const overwrite = buildCreatorAllowOverwrite('4')
    expect(overwrite).toEqual({
      id: '4',
      type: 1,
      allow: ROOM_MEMBER_ALLOW,
      deny: '0',
    })
  })

  it('builds full overwrite set including creator', () => {
    const overwrites = buildRoomPermissionOverwrites({
      guildId: '1',
      roleId: '2',
      botUserId: '3',
      creatorId: '4',
    })

    expect(overwrites).toHaveLength(4)
    expect(overwrites[0].id).toBe('1')
    expect(overwrites[1].id).toBe('2')
    expect(overwrites[2].id).toBe('3')
    expect(overwrites[3].id).toBe('4')
  })

  it('omits creator overwrite when not provided', () => {
    const overwrites = buildRoomPermissionOverwrites({
      guildId: '1',
      roleId: '2',
      botUserId: '3',
    })

    expect(overwrites).toHaveLength(3)
    expect(overwrites.map((o) => o.id)).toEqual(['1', '2', '3'])
  })
})
