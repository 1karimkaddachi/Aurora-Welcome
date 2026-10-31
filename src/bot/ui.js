import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { buildMessagePayload } from '../welcome/components.js';

export function panel({ title, accent = 0x5865f2, lines = [], rows = [], footer = null }) {
  const container = new ContainerBuilder().setAccentColor(accent);
  if (title) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
  }
  for (const line of lines.filter((value) => value !== null && value !== undefined && value !== '')) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(String(line)));
  }
  if (footer) {
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footer}`));
  }
  for (const row of rows) container.addActionRowComponents(row);
  return container;
}

export function button(label, customId, { style = ButtonStyle.Secondary, emoji = null, disabled = false } = {}) {
  const builder = new ButtonBuilder().setLabel(label).setCustomId(customId).setStyle(style);
  if (emoji) builder.setEmoji(emoji);
  if (disabled) builder.setDisabled(true);
  return builder;
}

export function linkButton(label, url, { emoji = null } = {}) {
  const builder = new ButtonBuilder().setLabel(label).setURL(url).setStyle(ButtonStyle.Link);
  if (emoji) builder.setEmoji(emoji);
  return builder;
}

export function buttonRow(...components) {
  return new ActionRowBuilder().addComponents(...components.flat());
}

export function channelUrl(guildId, channelId) {
  return channelId ? `https://discord.com/channels/${guildId}/${channelId}` : null;
}

export function formatDate(timestamp) {
  if (!timestamp) return 'Unknown';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(timestamp));
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value) || 0);
}

function flagsFor(ephemeral) {
  return MessageFlags.IsComponentsV2 | (ephemeral ? MessageFlags.Ephemeral : 0);
}

export async function replyPanel(interaction, container, { ephemeral = true } = {}) {
  const components = Array.isArray(container) ? container : [container];
  if (interaction.deferred) {
    return interaction.editReply({ components, flags: MessageFlags.IsComponentsV2 });
  }
  if (interaction.replied) {
    return interaction.followUp({ components, flags: flagsFor(ephemeral) });
  }
  return interaction.reply({ components, flags: flagsFor(ephemeral) });
}

export async function replyError(interaction, message) {
  return replyPanel(
    interaction,
    panel({
      title: 'Something went wrong',
      accent: 0xf43f5e,
      lines: [message],
      footer: 'Adjust the input and try again.',
    }),
  );
}

export async function replySuccess(interaction, title, lines = [], { footer = null, rows = [] } = {}) {
  return replyPanel(interaction, panel({ title, accent: 0x34d399, lines, footer, rows }));
}

export async function sendPreviewMessage(interaction, result, { ephemeral = true } = {}) {
  const payload = buildMessagePayload(result.model, { files: result.files, ephemeral });
  if (interaction.deferred) {
    return interaction.editReply({
      components: payload.components,
      flags: MessageFlags.IsComponentsV2,
      files: payload.files,
      allowedMentions: payload.allowedMentions,
    });
  }
  return interaction.reply(payload);
}

export async function sendPreparedPayload(interaction, payload, { ephemeral = true } = {}) {
  if (interaction.deferred) {
    return interaction.editReply({
      ...payload,
      flags: MessageFlags.IsComponentsV2 | (payload.flags || 0),
    });
  }
  return interaction.reply(payload);
}

export function configSummary(config) {
  const channelText = config.channels?.main ? `<#${config.channels.main}>` : 'not set';
  return [
    `**Status:** ${config.enabled ? 'Enabled' : 'Disabled'}`,
    `**Main channel:** ${channelText}`,
    `**Send mode:** ${config.sendMode}`,
    `**Style:** ${config.style}`,
    `**Bots:** ${config.botMode === 'skip' ? 'skipped' : 'welcomed'} • **Returning:** ${config.returningMode}`,
  ].join('\n');
}
