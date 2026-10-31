import {
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import { config as appConfig } from '../../config.js';
import {
  countInvites,
  createAutoRole,
  createButton,
  deleteAutoRole,
  deleteButton,
  ensureGuild,
  getGuildSettings,
  getInviteLeaderboard,
  getStatistics,
  getTemplate,
  getWelcomeConfig,
  listAutoRoles,
  listButtons,
  saveWelcomeConfig,
} from '../../db/repositories.js';
import { DEFAULT_DM_CONTENT, DEFAULT_IMAGE_CONFIG, DEFAULT_WELCOME_CONTENT } from '../../shared/defaults.js';
import { validateAutoRole, validateButton } from '../../shared/validation.js';
import { buildPreview } from '../../welcome/service.js';
import {
  applyWelcomeTemplate,
  deleteTemplate,
  findTemplate,
  listAllTemplates,
  saveWelcomeTemplate,
} from '../../welcome/templates.js';
import { logEvent } from '../audit.js';
import {
  button,
  buttonRow,
  configSummary,
  formatNumber,
  linkButton,
  panel,
  replyError,
  replyPanel,
  replySuccess,
  sendPreviewMessage,
} from '../ui.js';

function dashboardUrl(guildId, page = 'overview') {
  return `${appConfig.dashboardUrl}/servers/${guildId}/${page}`;
}

function dashboardRow(guildId, page = 'welcome') {
  return buttonRow(linkButton('Open dashboard', dashboardUrl(guildId, page), { emoji: '🖥️' }));
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

async function logConfig(interaction, action, message) {
  await logEvent(interaction.client, interaction.guildId, 'config', action, message, {
    userId: interaction.user.id,
    notify: false,
  });
}

async function ensurePermission(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await replyError(interaction, 'You need the **Manage Server** permission to configure the welcome system.');
    return false;
  }
  return true;
}

export async function handleWelcomeCommand(interaction) {
  if (!(await ensurePermission(interaction))) return;
  const group = interaction.options.getSubcommandGroup(false);
  const sub = group ? interaction.options.getSubcommand(true) : interaction.options.getSubcommand();
  if (group === 'template') return handleTemplate(interaction, sub);
  if (group === 'autorole') return handleAutoRole(interaction, sub);
  if (group === 'dm') return handleDm(interaction, sub);
  if (group === 'buttons') return handleButtons(interaction, sub);

  const guild = interaction.guild;
  ensureGuild({
    guildId: guild.id,
    name: guild.name,
    icon: guild.iconURL({ extension: 'png', size: 256 }),
    ownerId: guild.ownerId,
    memberCount: guild.memberCount,
  });

  switch (sub) {
    case 'setup': {
      const config = getWelcomeConfig(guild.id);
      const channel = interaction.options.getChannel('channel');
      if (channel) config.channels.main = channel.id;
      config.enabled = true;
      const saved = saveWelcomeConfig(guild.id, config);
      await logConfig(interaction, 'setup', `Welcome system configured${channel ? ` with main channel <#${channel.id}>` : ''}.`);
      await replySuccess(interaction, 'Welcome system ready', [configSummary(saved)], {
        footer: 'Use the dashboard for full visual editing and live preview.',
        rows: [
          buttonRow(
            button('Preview', 'wui:preview:welcome', { emoji: '👁️' }),
            linkButton('Open dashboard', dashboardUrl(guild.id, 'welcome'), { emoji: '🖥️' }),
          ),
        ],
      });
      return;
    }
    case 'enable':
    case 'disable': {
      const config = getWelcomeConfig(guild.id);
      config.enabled = sub === 'enable';
      saveWelcomeConfig(guild.id, config);
      await logConfig(interaction, sub, `Welcome messages ${sub}d.`);
      await replySuccess(interaction, sub === 'enable' ? 'Welcome enabled' : 'Welcome disabled', [configSummary(config)]);
      return;
    }
    case 'channel': {
      const type = interaction.options.getString('type', true);
      const channel = interaction.options.getChannel('channel', true);
      const config = getWelcomeConfig(guild.id);
      config.channels[type] = channel.id;
      const saved = saveWelcomeConfig(guild.id, config);
      await logConfig(interaction, 'channel', `Set **${type}** channel to <#${channel.id}>.`);
      await replySuccess(interaction, 'Channel saved', [configSummary(saved), `**${type}:** <#${channel.id}>`], {
        rows: [dashboardRow(guild.id, 'welcome')],
      });
      return;
    }
    case 'message': {
      const config = getWelcomeConfig(guild.id);
      const modal = new ModalBuilder()
        .setCustomId(`wmodal:message:${guild.id}`)
        .setTitle('Welcome message editor')
        .addComponents(
          input('title', 'Title', TextInputStyle.Short, { value: config.content.title, maxLength: 256 }),
          input('description', 'Description (markdown supported)', TextInputStyle.Paragraph, {
            value: config.content.description,
            maxLength: 3500,
          }),
          input('footer', 'Footer', TextInputStyle.Short, { value: config.content.footer, maxLength: 1024 }),
          input('emoji', 'Emoji', TextInputStyle.Short, { value: config.content.emoji, maxLength: 64 }),
        );
      await interaction.showModal(modal);
      return;
    }
    case 'preview': {
      const style = interaction.options.getString('style');
      const config = getWelcomeConfig(guild.id);
      if (style) config.style = style;
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const result = await buildPreview({ guild, welcomeConfig: config, kind: 'welcome', generateImage: true });
        await sendPreviewMessage(interaction, result, { ephemeral: true });
      } catch (error) {
        await replyError(interaction, `Preview failed: ${error.message}`);
      }
      return;
    }
    case 'test': {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { deliverTest } = await import('../../welcome/service.js');
      const result = await deliverTest(interaction.client, guild, interaction.member, 'welcome');
      const lines = [];
      if (result.skipped) lines.push(`Nothing was sent: **${result.skipped}**. Check that welcome is enabled and a channel is configured.`);
      for (const channel of result.channels || []) {
        lines.push(channel.ok ? `✅ Sent to <#${channel.channelId}>` : `❌ <#${channel.channelId}>: ${channel.reason}`);
      }
      if (!result.channels?.length && !result.skipped) lines.push('No welcome channel is configured.');
      if (result.dm) lines.push(result.dm.ok ? '✅ DM delivered' : `❌ DM failed: ${result.dm.reason}`);
      await replyPanel(
        interaction,
        panel({
          title: 'Welcome test complete',
          accent: lines.some((line) => line.startsWith('❌')) ? 0xf43f5e : 0x34d399,
          lines: lines.length ? lines : ['No delivery targets were configured.'],
          footer: result.imageGenerated ? 'The generated banner was included.' : 'The message was sent without a banner.',
        }),
      );
      return;
    }
    case 'image': {
      const enabled = interaction.options.getBoolean('enabled');
      const preview = interaction.options.getBoolean('preview');
      const config = getWelcomeConfig(guild.id);
      if (enabled !== null) {
        config.image.enabled = enabled;
        saveWelcomeConfig(guild.id, config);
        await logConfig(interaction, 'image', `Welcome banner ${enabled ? 'enabled' : 'disabled'}.`);
      }
      if (preview) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const result = await buildPreview({ guild, welcomeConfig: config, kind: 'welcome', generateImage: true });
        await sendPreviewMessage(interaction, result, { ephemeral: true });
        return;
      }
      await replyPanel(
        interaction,
        panel({
          title: 'Welcome banner',
          accent: 0x22d3ee,
          lines: [
            `**Status:** ${config.image.enabled ? 'Enabled' : 'Disabled'}`,
            `**Dimensions:** ${config.image.width} × ${config.image.height}`,
            `**Background:** ${config.image.background.type}`,
            `**Avatar:** ${config.image.avatar.shape}, ${config.image.avatar.size}px`,
            '',
            'Upload backgrounds, move layers and preview the banner live in the dashboard image studio.',
          ],
          rows: [
            buttonRow(
              button(config.image.enabled ? 'Disable banner' : 'Enable banner', 'wui:image:toggle', {
                style: config.image.enabled ? 4 : 3,
              }),
              linkButton('Image studio', dashboardUrl(guild.id, 'images'), { emoji: '🖼️' }),
            ),
          ],
        }),
      );
      return;
    }
    case 'reset': {
      await replyPanel(
        interaction,
        panel({
          title: 'Reset welcome configuration?',
          accent: 0xf43f5e,
          lines: [
            'This resets the welcome message, DM content, style and banner to their defaults.',
            'Channels, buttons, auto roles and invite settings are kept.',
          ],
          rows: [
            buttonRow(
              button('Reset configuration', 'wui:reset:welcome:confirm', { style: 4, emoji: '⚠️' }),
              button('Cancel', 'wui:reset:cancel'),
            ),
          ],
        }),
      );
      return;
    }
    case 'stats': {
      const stats = getStatistics(guild.id);
      const config = getWelcomeConfig(guild.id);
      const settings = getGuildSettings(guild.id);
      const leaderboard = getInviteLeaderboard(guild.id, 3);
      const lines = [
        '**MEMBERSHIP**',
        `> **Current members** ${formatNumber(guild.memberCount)}`,
        `> **Tracked joins** ${formatNumber(stats.totalJoins)} • **Leaves** ${formatNumber(stats.totalLeaves)}`,
        `> **Today** +${formatNumber(stats.today.joins)} / -${formatNumber(stats.today.leaves)}`,
        `> **7 days** +${formatNumber(stats.week.joins)} • **30 days** +${formatNumber(stats.month.joins)}`,
        `> **Growth** ${stats.growthPercent >= 0 ? '+' : ''}${stats.growthPercent}% week over week`,
        '',
        '**WELCOME**',
        `> **Status** ${config.enabled ? 'Enabled' : 'Disabled'} • **Style** ${config.style}`,
        `> **Channel** ${config.channels.main ? `<#${config.channels.main}>` : 'Not set'}`,
        `> **Delivery** ${config.sendMode} • **Banner** ${config.image.enabled ? 'on' : 'off'}`,
        `> **Invite tracking** ${settings.inviteTracking ? 'on' : 'off'} • **Attributions** ${formatNumber(countInvites(guild.id))}`,
      ];
      if (leaderboard.length) {
        lines.push('', '**TOP INVITERS**');
        leaderboard.forEach((entry, index) => {
          const who = entry.inviterId ? `<@${entry.inviterId}>` : entry.inviterName || 'Unknown';
          lines.push(`> ${index + 1}. ${who} — **${formatNumber(entry.joins)}** join${entry.joins === 1 ? '' : 's'}`);
        });
      }
      await replyPanel(interaction, panel({ title: 'Welcome statistics', accent: 0x5865f2, lines, rows: [dashboardRow(guild.id, 'statistics')] }));
      return;
    }
    default:
      await replyError(interaction, 'Unknown subcommand. Run the command again to see the current options.');
  }
}

async function handleTemplate(interaction, sub) {
  const guild = interaction.guild;
  if (sub === 'list') {
    const templates = listAllTemplates(guild.id, 'welcome');
    const lines = templates.map(
      (template) => `> ${template.builtin ? '📦' : '💾'} **${template.name}** — ${template.style}${template.description ? `\n> -# ${template.description}` : ''}`,
    );
    await replyPanel(
      interaction,
      panel({
        title: 'Welcome templates',
        accent: 0x5865f2,
        lines: lines.length ? lines : ['No templates available.'],
        footer: 'Apply with /welcome template apply • Save with /welcome template save',
      }),
    );
    return;
  }
  if (sub === 'apply') {
    const name = interaction.options.getString('name', true);
    const template = findTemplate(guild.id, 'welcome', name);
    if (!template) return replyError(interaction, `Template **${name}** was not found.`);
    const saved = applyWelcomeTemplate(guild.id, template);
    await logConfig(interaction, 'template', `Applied welcome template **${template.name}**.`);
    await replySuccess(interaction, 'Template applied', [configSummary(saved)], {
      rows: [buttonRow(button('Preview', 'wui:preview:welcome', { emoji: '👁️' }), linkButton('Open dashboard', dashboardUrl(guild.id, 'welcome')))],
    });
    return;
  }
  if (sub === 'save') {
    const name = interaction.options.getString('name', true);
    const description = interaction.options.getString('description') || '';
    const template = saveWelcomeTemplate(guild.id, { name, description });
    await logConfig(interaction, 'template_save', `Saved welcome template **${template.name}**.`);
    await replySuccess(interaction, 'Template saved', [`**${template.name}** now stores your current welcome content, style and banner.`], {
      rows: [dashboardRow(guild.id, 'templates')],
    });
    return;
  }
  if (sub === 'delete') {
    const name = interaction.options.getString('name', true);
    const template = getTemplate(guild.id, name) || listAllTemplates(guild.id, 'welcome').find(
      (item) => !item.builtin && item.name.toLowerCase() === name.toLowerCase(),
    );
    if (!template || template.builtin) return replyError(interaction, 'That saved template was not found. Built-in templates cannot be deleted.');
    deleteTemplate(guild.id, template.id);
    await logConfig(interaction, 'template_delete', `Deleted welcome template **${template.name}**.`);
    await replySuccess(interaction, 'Template deleted', [`**${template.name}** was removed.`]);
  }
}

async function handleAutoRole(interaction, sub) {
  const guild = interaction.guild;
  if (sub === 'add') {
    const role = interaction.options.getRole('role', true);
    const target = interaction.options.getString('target') || 'human';
    const delay = interaction.options.getInteger('delay') || 0;
    if (role.id === guild.id) return replyError(interaction, 'The @everyone role cannot be assigned automatically.');
    if (role.managed) return replyError(interaction, 'That role is managed by an integration and cannot be assigned.');
    const me = guild.members.me;
    if (me && role.position >= me.roles.highest.position) {
      return replyError(interaction, 'That role is above the bot’s highest role. Move the bot role higher, then try again.');
    }
    const inputRole = validateAutoRole({ roleId: role.id, target, delaySeconds: delay });
    const created = createAutoRole(guild.id, inputRole);
    await logConfig(interaction, 'autorole_add', `Auto role **@${role.name}** added for ${target} members.`);
    await replySuccess(interaction, 'Auto role added', [
      `**Role:** <@&${role.id}>`,
      `**Target:** ${created.target}`,
      `**Delay:** ${created.delaySeconds}s`,
    ]);
    return;
  }
  if (sub === 'remove') {
    const role = interaction.options.getRole('role', true);
    const roles = listAutoRoles(guild.id).filter((entry) => entry.roleId === role.id);
    if (!roles.length) return replyError(interaction, 'No automatic role is configured for that role.');
    for (const entry of roles) deleteAutoRole(guild.id, entry.id);
    await logConfig(interaction, 'autorole_remove', `Auto role **@${role.name}** removed.`);
    await replySuccess(interaction, 'Auto role removed', [`<@&${role.id}> will no longer be assigned automatically.`]);
    return;
  }
  const roles = listAutoRoles(guild.id);
  const lines = roles.length
    ? roles.map((entry) => `> <@&${entry.roleId}> — ${entry.target}${entry.delaySeconds ? ` • ${entry.delaySeconds}s delay` : ''}${entry.enabled ? '' : ' • disabled'}`)
    : ['No automatic roles configured.'];
  await replyPanel(interaction, panel({ title: 'Automatic roles', accent: 0x34d399, lines, rows: [dashboardRow(guild.id, 'autoroles')] }));
}

async function handleDm(interaction, sub) {
  const guild = interaction.guild;
  const config = getWelcomeConfig(guild.id);
  if (sub === 'enable') {
    config.sendMode = config.sendMode === 'dm' ? 'dm' : 'both';
    saveWelcomeConfig(guild.id, config);
    await logConfig(interaction, 'dm_enable', `Welcome DM delivery set to **${config.sendMode}**.`);
    return replySuccess(interaction, 'Welcome DMs enabled', [configSummary(config)]);
  }
  if (sub === 'disable') {
    config.sendMode = 'public';
    saveWelcomeConfig(guild.id, config);
    await logConfig(interaction, 'dm_disable', 'Welcome DM delivery disabled.');
    return replySuccess(interaction, 'Welcome DMs disabled', [configSummary(config)]);
  }
  if (sub === 'mode') {
    config.sendMode = interaction.options.getString('value', true);
    saveWelcomeConfig(guild.id, config);
    await logConfig(interaction, 'dm_mode', `Welcome delivery mode set to **${config.sendMode}**.`);
    return replySuccess(interaction, 'Delivery mode saved', [configSummary(config)]);
  }
  if (sub === 'message') {
    const modal = new ModalBuilder()
      .setCustomId(`wmodal:dm:${guild.id}`)
      .setTitle('Welcome DM editor')
      .addComponents(
        input('title', 'Title', TextInputStyle.Short, { value: config.dmContent.title, maxLength: 256 }),
        input('description', 'Description', TextInputStyle.Paragraph, { value: config.dmContent.description, maxLength: 3500 }),
        input('footer', 'Footer', TextInputStyle.Short, { value: config.dmContent.footer, maxLength: 1024 }),
        input('emoji', 'Emoji', TextInputStyle.Short, { value: config.dmContent.emoji, maxLength: 64 }),
      );
    return interaction.showModal(modal);
  }
}

async function handleButtons(interaction, sub) {
  const guild = interaction.guild;
  if (sub === 'add') {
    const label = interaction.options.getString('label', true);
    const type = interaction.options.getString('type', true);
    const style = interaction.options.getString('style');
    const url = interaction.options.getString('url');
    const emoji = interaction.options.getString('emoji');
    const existing = listButtons(guild.id, 'welcome');
    if (existing.length >= 25) return replyError(interaction, 'A welcome message supports at most 25 buttons.');
    if (type === 'url' && !url) return replyError(interaction, 'Custom URL buttons require a URL.');
    let validated;
    try {
      validated = validateButton(
        { label, type, url, emoji, style: style ? Number(style) : type === 'url' ? 5 : 2, scope: 'welcome' },
        existing.length,
      );
    } catch (error) {
      return replyError(interaction, error.message);
    }
    const created = createButton(guild.id, validated);
    await logConfig(interaction, 'button_add', `Welcome button **${created.label}** added (${created.type}).`);
    await replySuccess(interaction, 'Button added', [`**${created.label}** — ${created.type}${created.url ? ` → ${created.url}` : ''}`], {
      rows: [dashboardRow(guild.id, 'buttons')],
    });
    return;
  }
  if (sub === 'remove') {
    const buttonId = interaction.options.getString('button');
    const buttons = listButtons(guild.id, 'welcome');
    if (buttonId) {
      const target = buttons.find((entry) => entry.id === buttonId || entry.label.toLowerCase() === buttonId.toLowerCase());
      if (!target) return replyError(interaction, 'That button was not found.');
      deleteButton(guild.id, target.id);
      await logConfig(interaction, 'button_remove', `Welcome button **${target.label}** removed.`);
      return replySuccess(interaction, 'Button removed', [`**${target.label}** was removed.`]);
    }
    if (!buttons.length) return replyError(interaction, 'No welcome buttons are configured.');
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`wselect:delbtn:${guild.id}`)
      .setPlaceholder('Select a button to remove')
      .addOptions(
        buttons.slice(0, 25).map((entry) => ({
          label: entry.label.slice(0, 100),
          value: entry.id,
          description: `${entry.type}${entry.enabled ? '' : ' • disabled'}`.slice(0, 100),
          emoji: entry.emoji || undefined,
        })),
      );
    return replyPanel(
      interaction,
      panel({ title: 'Remove a welcome button', accent: 0xf43f5e, lines: ['Pick the button you want to delete.'], rows: [buttonRow(menu)] }),
    );
  }
  const buttons = listButtons(guild.id, 'welcome');
  const lines = buttons.length
    ? buttons.map((entry) => `> ${entry.emoji ? `${entry.emoji} ` : ''}**${entry.label}** — ${entry.type}${entry.url ? ` → ${entry.url}` : ''}${entry.enabled ? '' : ' • disabled'}`)
    : ['No welcome buttons configured.'];
  await replyPanel(interaction, panel({ title: 'Welcome buttons', accent: 0x5865f2, lines, rows: [dashboardRow(guild.id, 'buttons')] }));
}

export async function autocompleteWelcome(interaction) {
  const group = interaction.options.getSubcommandGroup(false);
  const sub = group ? interaction.options.getSubcommand(true) : interaction.options.getSubcommand();
  const guildId = interaction.guildId;
  const focused = interaction.options.getFocused(true);
  const query = String(focused.value || '').toLowerCase();
  if (group === 'template') {
    const templates = listAllTemplates(guildId, 'welcome').filter((template) => {
      if (sub === 'delete' && template.builtin) return false;
      return template.name.toLowerCase().includes(query) || template.id.toLowerCase().includes(query);
    });
    return interaction.respond(
      templates.slice(0, 25).map((template) => ({
        name: `${template.builtin ? 'Built-in' : 'Saved'} · ${template.name}`.slice(0, 100),
        value: template.id,
      })),
    );
  }
  if (group === 'buttons' && sub === 'remove') {
    const buttons = listButtons(guildId, 'welcome').filter((entry) => entry.label.toLowerCase().includes(query));
    return interaction.respond(
      buttons.slice(0, 25).map((entry) => ({
        name: `${entry.label} · ${entry.type}`.slice(0, 100),
        value: entry.id,
      })),
    );
  }
  return interaction.respond([]);
}

export async function resetWelcomeConfig(guildId) {
  const config = getWelcomeConfig(guildId);
  config.content = structuredClone(DEFAULT_WELCOME_CONTENT);
  config.dmContent = structuredClone(DEFAULT_DM_CONTENT);
  config.image = structuredClone(DEFAULT_IMAGE_CONFIG);
  config.style = 'classic';
  config.sendMode = 'public';
  config.botMode = 'enabled';
  config.returningMode = 'returning';
  return saveWelcomeConfig(guildId, config);
}

