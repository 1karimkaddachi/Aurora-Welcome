import { Events } from 'discord.js';
import {
  addMemberJoin,
  ensureGuild,
  getAbuseWindowCount,
  getGuildSettings,
  recordInviteUse,
  recordJoinStat,
  setGuildMemberCount,
} from '../../db/repositories.js';
import { attributeJoin } from '../../invites/tracker.js';
import { createLogger } from '../../logger.js';
import { deliverWelcome } from '../../welcome/service.js';
import { applyAutoRoles } from '../autoroles.js';
import { logEvent } from '../audit.js';

const log = createLogger('member-add');

export async function onGuildMemberAdd(member) {
  const guild = member.guild;
  try {
    ensureGuild({
      guildId: guild.id,
      name: guild.name,
      icon: guild.iconURL({ extension: 'png', size: 256 }),
      ownerId: guild.ownerId,
      memberCount: guild.memberCount,
    });
    const settings = getGuildSettings(guild.id);
    const invite = await attributeJoin(guild, settings);
    const username = member.user.username;
    const displayName = member.displayName || member.user.globalName || username;
    const avatar = member.displayAvatarURL({ extension: 'png', size: 512 });
    const isBot = Boolean(member.user.bot);

    const history = addMemberJoin({
      guildId: guild.id,
      userId: member.id,
      username,
      displayName,
      avatar,
      isBot,
      inviterId: invite.inviterId,
      inviterName: invite.inviterName,
      inviteCode: invite.code,
      inviteType: invite.type,
      joinedAt: member.joinedTimestamp || Date.now(),
    });

    recordJoinStat(guild.id, { isBot, totalMembers: guild.memberCount });
    setGuildMemberCount(guild.id, guild.memberCount);

    if (settings.inviteTracking && invite.type !== 'disabled') {
      recordInviteUse({
        guildId: guild.id,
        code: invite.code || (invite.type === 'unknown' ? 'unknown' : 'vanity'),
        inviterId: invite.inviterId,
        inviterName: invite.inviterName,
        userId: member.id,
        username,
        type: invite.type,
        joinedAt: Date.now(),
      });
      if (invite.ambiguous) {
        await logEvent(
          member.client,
          guild.id,
          'invite',
          'ambiguous',
          `Ambiguous invite attribution for @${username}: ${invite.ambiguous.map((item) => item.code).join(', ')}.`,
          { userId: member.id, notify: false },
        );
      }
      if (invite.inviterId && settings.abuseThreshold > 0) {
        const windowCount = getAbuseWindowCount(guild.id, invite.inviterId, settings.abuseWindowMinutes);
        if (windowCount >= settings.abuseThreshold) {
          await logEvent(
            member.client,
            guild.id,
            'invite',
            'abuse_suspected',
            `Possible invite abuse: <@${invite.inviterId}> has ${windowCount} joins in ${settings.abuseWindowMinutes} minutes.`,
            { userId: invite.inviterId, meta: { windowCount } },
          );
        }
      }
    }

    const inviteLabel = invite.inviterId
      ? `invited by <@${invite.inviterId}> via \`${invite.code}\``
      : invite.type === 'vanity'
        ? 'joined via vanity URL'
        : invite.type === 'disabled'
          ? 'invite tracking disabled'
          : 'invite source unknown';
    await logEvent(
      member.client,
      guild.id,
      'member',
      'joined',
      `@${username} joined (member #${history.memberNumber}); ${inviteLabel}.`,
      {
        userId: member.id,
        meta: {
          memberNumber: history.memberNumber,
          returning: history.returning,
          inviteCode: invite.code,
          inviteType: invite.type,
          inviterId: invite.inviterId,
          isBot,
        },
      },
    );

    await applyAutoRoles(member.client, member);
    const result = await deliverWelcome(member.client, member, {
      invite,
      memberNumber: history.memberNumber,
      returning: history.returning,
    });
    if (result.skipped) log.debug(`Welcome skipped for ${member.id}: ${result.skipped}`);
  } catch (error) {
    log.error('Member join handling failed', { guildId: guild.id, userId: member.id, error: error.message });
    try {
      await logEvent(member.client, guild.id, 'system', 'join_error', `Join flow failed for @${member.user.username}: ${error.message}`, {
        userId: member.id,
      });
    } catch {
      /* ignore */
    }
  }
}

export function attachGuildMemberAdd(client) {
  client.on(Events.GuildMemberAdd, (member) => {
    onGuildMemberAdd(member).catch((error) => log.error('Unhandled join error', { error: error.message }));
  });
}
