import { config as appConfig } from '../../config.js';
import {
  getGuildSettings,
  getInviteLeaderboard,
  getInviterStats,
  getRecentInviteUses,
} from '../../db/repositories.js';
import { formatDate, formatNumber, linkButton, buttonRow, panel, replyPanel } from '../ui.js';

function dashboardUrl(guildId, page = 'invites') {
  return `${appConfig.dashboardUrl}/servers/${guildId}/${page}`;
}

export async function handleInvitesCommand(interaction) {
  if (!interaction.guild) return;
  const sub = interaction.options.getSubcommand();
  const settings = getGuildSettings(interaction.guildId);
  const footer = settings.inviteTracking
    ? 'Attribution uses invite use-count diffs; simultaneous joins can be ambiguous.'
    : 'Invite tracking is currently disabled in Advanced Settings.';

  if (sub === 'user') {
    const user = interaction.options.getUser('member', true);
    const stats = getInviterStats(interaction.guildId, user.id);
    const lines = [
      `**Invites by** <@${user.id}>`,
      `> **Total** ${formatNumber(stats.total)}`,
      `> **Last 7 days** ${formatNumber(stats.last7Days)}`,
    ];
    if (stats.invitees.length) {
      lines.push('', '**RECENT INVITEES**');
      for (const invitee of stats.invitees.slice(0, 10)) {
        const type = invitee.type === 'unknown' ? 'unknown source' : invitee.type === 'vanity' ? 'vanity URL' : `\`${invitee.code}\``;
        lines.push(`> <@${invitee.user_id}> — ${type} • ${formatDate(invitee.joined_at)}`);
      }
    } else {
      lines.push('', 'No attributed joins yet.');
    }
    return replyPanel(
      interaction,
      panel({
        title: 'Invite statistics',
        accent: 0xf0b429,
        lines,
        footer,
        rows: [buttonRow(linkButton('Invite dashboard', dashboardUrl(interaction.guildId), { emoji: '📊' }))],
      }),
    );
  }

  if (sub === 'leaderboard') {
    const leaderboard = getInviteLeaderboard(interaction.guildId, 10);
    const recent = getRecentInviteUses(interaction.guildId, 5);
    const lines = [];
    if (leaderboard.length) {
      leaderboard.forEach((entry, index) => {
        const who = entry.inviterId ? `<@${entry.inviterId}>` : entry.inviterName || 'Unknown';
        lines.push(`> **${index + 1}.** ${who} — ${formatNumber(entry.joins)} join${entry.joins === 1 ? '' : 's'}`);
      });
    } else {
      lines.push('No attributed joins have been recorded yet.');
    }
    if (recent.length) {
      lines.push('', '**LATEST ATTRIBUTIONS**');
      for (const use of recent) {
        const who = use.inviter_id ? `<@${use.inviter_id}>` : 'Unknown source';
        lines.push(`> <@${use.user_id}> ← ${who} • \`${use.code}\` • ${formatDate(use.joined_at)}`);
      }
    }
    return replyPanel(
      interaction,
      panel({
        title: 'Invite leaderboard',
        accent: 0xf0b429,
        lines,
        footer,
        rows: [buttonRow(linkButton('Invite dashboard', dashboardUrl(interaction.guildId), { emoji: '📊' }))],
      }),
    );
  }
}
