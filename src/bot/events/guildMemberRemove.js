import { Events } from 'discord.js';
import {
  markMemberLeft,
  recordLeaveStat,
  setGuildMemberCount,
} from '../../db/repositories.js';
import { createLogger } from '../../logger.js';
import { deliverLeave } from '../../welcome/service.js';
import { logEvent } from '../audit.js';

const log = createLogger('member-remove');

export async function onGuildMemberRemove(member) {
  const guild = member.guild;
  const isBot = Boolean(member.user?.bot);
  try {
    const history = markMemberLeft(guild.id, member.id);
    recordLeaveStat(guild.id, { isBot, totalMembers: guild.memberCount });
    setGuildMemberCount(guild.id, guild.memberCount);
    await logEvent(
      member.client,
      guild.id,
      'member',
      'left',
      `@${member.user.username} left the server. ${guild.memberCount} members remain.`,
      { userId: member.id, meta: { isBot, memberNumber: history?.memberNumber || null } },
    );
    await deliverLeave(member.client, member, history);
  } catch (error) {
    log.error('Member leave handling failed', { guildId: guild.id, userId: member.id, error: error.message });
  }
}

export function attachGuildMemberRemove(client) {
  client.on(Events.GuildMemberRemove, (member) => {
    onGuildMemberRemove(member).catch((error) => log.error('Unhandled leave error', { error: error.message }));
  });
}
