import {
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputStyle,
  ActionRowBuilder,
  TextInputBuilder,
} from 'discord.js';
import { config as appConfig } from '../../config.js';
import {
  ensureGuild,
  getLeaveConfig,
  saveLeaveConfig,
} from '../../db/repositories.js';
import { buildPreview } from '../../welcome/service.js';
import { logEvent } from '../audit.js';
import {
  button,
  buttonRow,
  linkButton,
  panel,
  replyError,
  replyPanel,
  replySuccess,
  sendPreviewMessage,
} from '../ui.js';

function dashboardUrl(guildId, page = 'leave') {
  return `${appConfig.dashboardUrl}/servers/${guildId}/${page}`;
}

function input(customId, label, style, { value = '', required = false, maxLength = 1000 } = {}) {
  const builder = new TextInputBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(style)
    .setRequired(required)
    .setMaxLength(maxLength);
  if (value) builder.setValue(String(value).slice(0, maxLength));
  return new ActionRowBuilder().addComponents(builder);
}

function summary(config) {
  return [
    `**Status:** ${config.enabled ? 'Enabled' : 'Disabled'}`,
    `**Channel:** ${config.channelId ? `<#${config.channelId}>` : 'not set'}`,
    `**Style:** ${config.style}`,
    `**Banner:** ${config.image.enabled ? 'on' : 'off'}`,
  ].join('\n');
}

export async function handleLeaveCommand(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return replyError(interaction, 'You need the **Manage Server** permission to configure leave messages.');
  }
  const sub = interaction.options.getSubcommand();
  const guild = interaction.guild;
  ensureGuild({
    guildId: guild.id,
    name: guild.name,
    icon: guild.iconURL({ extension: 'png', size: 256 }),
    ownerId: guild.ownerId,
    memberCount: guild.memberCount,
  });
  const config = getLeaveConfig(guild.id);

  if (sub === 'setup') {
    const channel = interaction.options.getChannel('channel');
    if (channel) config.channelId = channel.id;
    config.enabled = true;
    const saved = saveLeaveConfig(guild.id, config);
    await logEvent(interaction.client, guild.id, 'config', 'leave_setup', `Leave system configured${channel ? ` with channel <#${channel.id}>` : ''}.`, {
      userId: interaction.user.id,
    });
    return replySuccess(interaction, 'Leave system ready', [summary(saved)], {
      rows: [
        buttonRow(
          button('Preview', 'wui:preview:leave', { emoji: '👁️' }),
          linkButton('Open dashboard', dashboardUrl(guild.id), { emoji: '🖥️' }),
        ),
      ],
    });
  }
  if (sub === 'enable' || sub === 'disable') {
    config.enabled = sub === 'enable';
    saveLeaveConfig(guild.id, config);
    await logEvent(interaction.client, guild.id, 'config', sub, `Leave messages ${sub}d.`, { userId: interaction.user.id });
    return replySuccess(interaction, sub === 'enable' ? 'Leave messages enabled' : 'Leave messages disabled', [summary(config)]);
  }
  if (sub === 'channel') {
    const channel = interaction.options.getChannel('channel', true);
    config.channelId = channel.id;
    const saved = saveLeaveConfig(guild.id, config);
    await logEvent(interaction.client, guild.id, 'config', 'leave_channel', `Leave channel set to <#${channel.id}>.`, {
      userId: interaction.user.id,
    });
    return replySuccess(interaction, 'Leave channel saved', [summary(saved)], {
      rows: [buttonRow(linkButton('Open dashboard', dashboardUrl(guild.id), { emoji: '🖥️' }))],
    });
  }
  if (sub === 'message') {
    const modal = new ModalBuilder()
      .setCustomId(`wmodal:leave:${guild.id}`)
      .setTitle('Leave message editor')
      .addComponents(
        input('title', 'Title', TextInputStyle.Short, { value: config.content.title, maxLength: 256 }),
        input('description', 'Description (markdown supported)', TextInputStyle.Paragraph, {
          value: config.content.description,
          maxLength: 3500,
        }),
        input('footer', 'Footer', TextInputStyle.Short, { value: config.content.footer, maxLength: 1024 }),
        input('emoji', 'Emoji', TextInputStyle.Short, { value: config.content.emoji, maxLength: 64 }),
      );
    return interaction.showModal(modal);
  }
  if (sub === 'preview') {
    const style = interaction.options.getString('style');
    if (style) config.style = style;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const result = await buildPreview({ guild, leaveConfig: config, kind: 'leave', generateImage: true });
      return await sendPreviewMessage(interaction, result, { ephemeral: true });
    } catch (error) {
      return replyError(interaction, `Preview failed: ${error.message}`);
    }
  }
  if (sub === 'test') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!config.channelId) {
      return replyPanel(
        interaction,
        panel({
          title: 'No leave channel configured',
          accent: 0xf43f5e,
          lines: ['Set one with `/leave channel` or `/leave setup`, then try again.'],
        }),
      );
    }
    const { deliverTest } = await import('../../welcome/service.js');
    const result = await deliverTest(interaction.client, guild, interaction.member, 'leave');
    const lines = [];
    if (result.skipped) lines.push(`Nothing was sent: **${result.skipped}**.`);
    else if (result.ok) lines.push(`✅ Leave message sent to <#${config.channelId}>`);
    else lines.push(`❌ ${result.reason || 'Send failed'}`);
    return replyPanel(
      interaction,
      panel({ title: 'Leave test complete', accent: result.ok ? 0x34d399 : 0xf43f5e, lines }),
    );
  }
  if (sub === 'image') {
    const enabled = interaction.options.getBoolean('enabled', true);
    config.image.enabled = enabled;
    saveLeaveConfig(guild.id, config);
    await logEvent(interaction.client, guild.id, 'config', 'leave_image', `Leave banner ${enabled ? 'enabled' : 'disabled'}.`, {
      userId: interaction.user.id,
    });
    return replySuccess(interaction, 'Leave banner updated', [summary(config)], {
      rows: [buttonRow(linkButton('Image studio', dashboardUrl(guild.id, 'images'), { emoji: '🖼️' }))],
    });
  }
  return replyError(interaction, 'Unknown subcommand.');
}
