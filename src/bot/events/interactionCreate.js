import {
  ActionRowBuilder,
  ChannelType,
  Events,
  MessageFlags,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} from 'discord.js';
import {
  deleteButton,
  getGuildSettings,
  getLeaveConfig,
  getWelcomeConfig,
  listButtons,
  listSelfRoles,
  saveLeaveConfig,
  saveWelcomeConfig,
} from '../../db/repositories.js';
import { normalizeContent } from '../../shared/validation.js';
import { createLogger } from '../../logger.js';
import { buildPreview, deliverTest } from '../../welcome/service.js';
import { logEvent } from '../audit.js';
import { autocompleteWelcome, handleWelcomeCommand, resetWelcomeConfig } from '../commands/welcome.js';
import { handleLeaveCommand } from '../commands/leave.js';
import { handleInvitesCommand } from '../commands/invites.js';
import {
  button,
  buttonRow,
  channelUrl,
  linkButton,
  panel,
  replyError,
  replyPanel,
  replySuccess,
  sendPreviewMessage,
} from '../ui.js';

const log = createLogger('interactions');
const cooldowns = new Map();

function hasManage(interaction) {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
}

function errorContainer(message) {
  return panel({
    title: 'Something went wrong',
    accent: 0xf43f5e,
    lines: [message],
  });
}

async function handleInteractionError(interaction, error) {
  log.error('Interaction failed', {
    type: interaction.type,
    customId: interaction.customId,
    command: interaction.commandName,
    guildId: interaction.guildId,
    error: error.message,
    stack: error.stack,
  });
  const message =
    error.name === 'ValidationError'
      ? error.message
      : 'An unexpected error occurred. The issue was logged; please try again.';
  try {
    if (interaction.deferred) {
      await interaction.editReply({ components: [errorContainer(message)], flags: MessageFlags.IsComponentsV2 });
    } else if (interaction.replied) {
      await interaction.followUp({
        components: [errorContainer(message)],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        components: [errorContainer(message)],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }
  } catch {
    /* interaction may have expired */
  }
}

async function preview(interaction, kind) {
  if (!hasManage(interaction)) return replyError(interaction, 'You need **Manage Server** to preview settings.');
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guild = interaction.guild;
  if (kind === 'leave') {
    const result = await buildPreview({ guild, kind: 'leave', generateImage: true });
    return sendPreviewMessage(interaction, result, { ephemeral: true });
  }
  const result = await buildPreview({ guild, kind: 'welcome', generateImage: true });
  return sendPreviewMessage(interaction, result, { ephemeral: true });
}

function imagePanel(config, guildId) {
  return panel({
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
        linkButton('Image studio', `${interactionDashboard(guildId, 'images')}`, { emoji: '🖼️' }),
      ),
    ],
  });
}

function interactionDashboard(guildId, page) {
  // Imported lazily to avoid a circular import with command modules.
  return `${process.env.DASHBOARD_URL || 'http://localhost:3000'}/servers/${guildId}/${page}`;
}

async function handleWelcomeAction(interaction, type, guildId) {
  if (interaction.guildId !== guildId) return replyError(interaction, 'This button belongs to another server.');
  const guild = interaction.guild;
  if (!guild) return;
  const config = getWelcomeConfig(guild.id);
  const settings = getGuildSettings(guild.id);

  if (type === 'rules') {
    const rulesUrl = channelUrl(guild.id, config.channels.rules);
    const lines = [];
    if (settings.rulesText) lines.push(settings.rulesText);
    else if (config.channels.rules) lines.push(`Please read <#${config.channels.rules}> before you start chatting.`);
    else lines.push('No rules channel has been configured yet. Please ask an administrator.');
    return replyPanel(
      interaction,
      panel({
        title: 'Server rules',
        accent: 0x5865f2,
        lines,
        rows: rulesUrl ? [buttonRow(linkButton('Open rules channel', rulesUrl, { emoji: '📜' }))] : [],
      }),
    );
  }

  if (type === 'intro') {
    const introUrl = channelUrl(guild.id, config.channels.introductions);
    const lines = introUrl
      ? [`Say hello in <#${config.channels.introductions}> and tell us a little about yourself.`]
      : ['No introductions channel has been configured yet.'];
    return replyPanel(
      interaction,
      panel({
        title: 'Introduce yourself',
        accent: 0x34d399,
        lines,
        rows: introUrl ? [buttonRow(linkButton('Open introductions', introUrl, { emoji: '👋' }))] : [],
      }),
    );
  }

  if (type === 'roles') {
    const roles = listSelfRoles(guild.id).filter((entry) => entry.enabled);
    if (!roles.length) {
      const rolesUrl = channelUrl(guild.id, settings.rolesChannelId);
      return replyPanel(
        interaction,
        panel({
          title: 'Self-assignable roles',
          accent: 0xa855f7,
          lines: ['No self-assignable roles are configured yet. An administrator can add them in the dashboard.'],
          rows: rolesUrl ? [buttonRow(linkButton('Open roles channel', rolesUrl, { emoji: '🎭' }))] : [],
        }),
      );
    }
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`wselect:selfrole:${guild.id}`)
      .setPlaceholder('Choose a role to add or remove')
      .addOptions(
        roles.slice(0, 25).map((entry) => {
          const role = guild.roles.cache.get(entry.roleId);
          const hasRole = interaction.member?.roles?.cache?.has(entry.roleId);
          return {
            label: entry.label.slice(0, 100),
            value: entry.roleId,
            description: `${hasRole ? 'Remove' : 'Add'} ${role ? `@${role.name}` : 'role'}`.slice(0, 100),
            emoji: entry.emoji || undefined,
          };
        }),
      );
    return replyPanel(
      interaction,
      panel({
        title: 'Choose your roles',
        accent: 0xa855f7,
        lines: ['Select a role to add or remove it from your account.'],
        rows: [buttonRow(menu)],
      }),
    );
  }

  if (type === 'ticket') {
    if (!settings.ticketChannelId) {
      return replyPanel(
        interaction,
        panel({
          title: 'Support tickets are not configured',
          accent: 0xf43f5e,
          lines: ['An administrator needs to choose a ticket channel in **Advanced Settings** on the dashboard.'],
          rows: [buttonRow(linkButton('Open advanced settings', interactionDashboard(guild.id, 'advanced'), { emoji: '⚙️' }))],
        }),
      );
    }
    const channel = guild.channels.cache.get(settings.ticketChannelId);
    if (!channel || !(channel.isTextBased?.() ?? false)) {
      return replyError(interaction, 'The configured ticket channel is missing or not text based.');
    }
    const me = guild.members.me;
    const permissions = me ? channel.permissionsFor(me) : null;
    if (permissions) {
      if (!permissions.has(['ViewChannel', 'SendMessages', 'SendMessagesInThreads'])) {
        return replyError(interaction, 'The bot needs View Channel, Send Messages and Send Messages in Threads in the ticket channel.');
      }
      if (!permissions.has('CreatePrivateThreads') && !permissions.has('CreatePublicThreads')) {
        return replyError(interaction, 'The bot needs Create Private Threads or Create Public Threads in the ticket channel.');
      }
    }
    const canPrivate = permissions ? permissions.has('CreatePrivateThreads') : true;
    const name = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 90);
    try {
      let thread;
      try {
        thread = await channel.threads.create({
          name,
          type: canPrivate ? ChannelType.PrivateThread : ChannelType.PublicThread,
          invitable: false,
          reason: `Support ticket opened by ${interaction.user.tag}`,
        });
      } catch {
        thread = await channel.threads.create({
          name,
          type: ChannelType.PublicThread,
          reason: `Support ticket opened by ${interaction.user.tag}`,
        });
      }
      await thread.members.add(interaction.user.id).catch(() => {});
      const intro = panel({
        title: 'Support ticket opened',
        accent: 0x34d399,
        lines: [
          `Welcome <@${interaction.user.id}>. Support will be with you shortly.`,
          'Describe your question and include any helpful details or screenshots.',
        ],
        footer: 'A staff member can close this thread when the issue is resolved.',
      });
      await thread.send({ components: [intro], flags: MessageFlags.IsComponentsV2, allowedMentions: { users: [interaction.user.id] } });
      await logEvent(interaction.client, guild.id, 'system', 'ticket_opened', `Ticket ${thread.name} opened by @${interaction.user.username}.`, {
        userId: interaction.user.id,
        meta: { threadId: thread.id },
      });
      return replyPanel(
        interaction,
        panel({
          title: 'Ticket created',
          accent: 0x34d399,
          lines: [`Your private ticket is ready: <#${thread.id}>`],
          rows: [buttonRow(linkButton('Open ticket', `https://discord.com/channels/${guild.id}/${thread.id}`, { emoji: '🎫' }))],
        }),
      );
    } catch (error) {
      return replyError(interaction, `Could not create a ticket thread: ${error.message}`);
    }
  }
}

async function handleModal(interaction) {
  if (!hasManage(interaction)) return replyError(interaction, 'You need **Manage Server** to edit messages.');
  const [, scope, guildId] = interaction.customId.split(':');
  if (guildId !== interaction.guildId) return replyError(interaction, 'This editor belongs to another server.');
  const title = interaction.fields.getTextInputValue('title');
  const description = interaction.fields.getTextInputValue('description');
  const footer = interaction.fields.getTextInputValue('footer');
  const emoji = interaction.fields.getTextInputValue('emoji');
  const guild = interaction.guild;

  if (scope === 'message') {
    const config = getWelcomeConfig(guild.id);
    config.content = normalizeContent({ ...config.content, title, description, footer, emoji });
    saveWelcomeConfig(guild.id, config);
    await logEvent(interaction.client, guild.id, 'config', 'message_updated', 'Welcome message updated via modal.', {
      userId: interaction.user.id,
      notify: false,
    });
    return replySuccess(interaction, 'Welcome message saved', [`**Title:** ${title || '(empty)'}`, 'Preview it now or open the dashboard for full layout control.'], {
      rows: [buttonRow(button('Preview', 'wui:preview:welcome', { emoji: '👁️' }))],
    });
  }
  if (scope === 'dm') {
    const config = getWelcomeConfig(guild.id);
    config.dmContent = normalizeContent({ ...config.dmContent, title, description, footer, emoji });
    saveWelcomeConfig(guild.id, config);
    await logEvent(interaction.client, guild.id, 'config', 'dm_message_updated', 'Welcome DM content updated via modal.', {
      userId: interaction.user.id,
      notify: false,
    });
    return replySuccess(interaction, 'Welcome DM saved', [`**Title:** ${title || '(empty)'}`]);
  }
  if (scope === 'leave') {
    const config = getLeaveConfig(guild.id);
    config.content = normalizeContent({ ...config.content, title, description, footer, emoji });
    saveLeaveConfig(guild.id, config);
    await logEvent(interaction.client, guild.id, 'config', 'leave_message_updated', 'Leave message updated via modal.', {
      userId: interaction.user.id,
      notify: false,
    });
    return replySuccess(interaction, 'Leave message saved', [`**Title:** ${title || '(empty)'}`], {
      rows: [buttonRow(button('Preview', 'wui:preview:leave', { emoji: '👁️' }))],
    });
  }
  return replyError(interaction, 'Unknown editor.');
}

async function handleButton(interaction) {
  const parts = interaction.customId.split(':');
  const [scope, type] = parts;
  const rest = parts.slice(2);
  if (scope === 'wb') return handleWelcomeAction(interaction, type, rest[0]);
  if (scope !== 'wui') return;
  if (type === 'preview') {
    return preview(interaction, rest[0]);
  }
  if (type === 'image') {
    if (!hasManage(interaction)) return replyError(interaction, 'You need **Manage Server** to change this setting.');
    if (!interaction.guild) return;
    const config = getWelcomeConfig(interaction.guild.id);
    config.image.enabled = !config.image.enabled;
    saveWelcomeConfig(interaction.guild.id, config);
    await logEvent(interaction.client, interaction.guild.id, 'config', 'image', `Welcome banner ${config.image.enabled ? 'enabled' : 'disabled'}.`, {
      userId: interaction.user.id,
    });
    return interaction.update({ components: [imagePanel(config, interaction.guild.id)], flags: MessageFlags.IsComponentsV2 });
  }
  if (type === 'reset') {
    if (!hasManage(interaction)) return replyError(interaction, 'You need **Manage Server** to reset settings.');
    if (!rest.includes('confirm')) {
      return interaction.update({
        components: [panel({ title: 'Reset cancelled', accent: 0x94a3b8, lines: ['No changes were made.'] })],
        flags: MessageFlags.IsComponentsV2,
      });
    }
    const config = resetWelcomeConfig(interaction.guildId);
    await logEvent(interaction.client, interaction.guildId, 'config', 'reset', 'Welcome configuration reset to defaults.', {
      userId: interaction.user.id,
    });
    return interaction.update({
      components: [
        panel({
          title: 'Configuration reset',
          accent: 0x34d399,
          lines: [`Welcome has been reset to the **${config.style}** defaults. Channels were preserved.`],
        }),
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  }
}

async function handleSelect(interaction) {
  const [scope, action, guildId] = interaction.customId.split(':');
  if (scope === 'wselect' && action === 'delbtn') {
    if (!hasManage(interaction)) return replyError(interaction, 'You need **Manage Server** to delete buttons.');
    if (guildId !== interaction.guildId) return replyError(interaction, 'This menu belongs to another server.');
    const buttonId = interaction.values[0];
    const target = listButtons(interaction.guildId, 'welcome').find((entry) => entry.id === buttonId);
    if (!target) return replyError(interaction, 'That button no longer exists.');
    deleteButton(interaction.guildId, buttonId);
    await logEvent(interaction.client, interaction.guildId, 'config', 'button_remove', `Welcome button **${target.label}** removed.`, {
      userId: interaction.user.id,
    });
    return interaction.update({
      components: [panel({ title: 'Button removed', accent: 0x34d399, lines: [`**${target.label}** was deleted.`] })],
      flags: MessageFlags.IsComponentsV2,
    });
  }
  if (scope === 'wselect' && action === 'selfrole') {
    if (guildId !== interaction.guildId) return replyError(interaction, 'This menu belongs to another server.');
    const guild = interaction.guild;
    const entry = listSelfRoles(guild.id).find((item) => item.roleId === interaction.values[0] && item.enabled);
    if (!entry) return replyError(interaction, 'That role is no longer available.');
    const role = guild.roles.cache.get(entry.roleId) || (await guild.roles.fetch(entry.roleId).catch(() => null));
    if (!role) return replyError(interaction, 'That role was deleted. Ask an administrator to update self roles.');
    const me = guild.members.me;
    if (role.managed) return replyError(interaction, 'This role is managed by an integration and cannot be self-assigned.');
    if (me && role.position >= me.roles.highest.position) {
      return replyError(interaction, 'This role is above the bot’s highest role, so it cannot be assigned.');
    }
    const member = interaction.member;
    const has = member.roles.cache.has(role.id);
    try {
      if (has) await member.roles.remove(role, 'Self-assignable role removed from welcome panel');
      else await member.roles.add(role, 'Self-assignable role added from welcome panel');
      await logEvent(
        interaction.client,
        guild.id,
        'autorole',
        has ? 'self_role_removed' : 'self_role_added',
        `@${interaction.user.username} ${has ? 'removed' : 'added'} self role @${role.name}.`,
        { userId: interaction.user.id, meta: { roleId: role.id } },
      );
      const resultLine = `${has ? 'Removed' : 'Added'} <@&${role.id}>.`;
      const roles = listSelfRoles(guild.id).filter((item) => item.enabled);
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`wselect:selfrole:${guild.id}`)
        .setPlaceholder('Choose another role')
        .addOptions(
          roles.slice(0, 25).map((item) => ({
            label: item.label.slice(0, 100),
            value: item.roleId,
            description: `${member.roles.cache.has(item.roleId) ? 'Remove' : 'Add'} @${guild.roles.cache.get(item.roleId)?.name || 'role'}`.slice(0, 100),
            emoji: item.emoji || undefined,
          })),
        );
      return interaction.update({
        components: [
          panel({
            title: 'Role updated',
            accent: 0x34d399,
            lines: [resultLine],
            rows: [buttonRow(menu)],
          }),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      return replyError(interaction, `Could not update the role: ${error.message}`);
    }
  }
}

export function attachInteractionCreate(client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'welcome') return autocompleteWelcome(interaction);
        return interaction.respond([]);
      }

      if (interaction.isChatInputCommand()) {
        const key = `${interaction.user.id}:${interaction.guildId}:${interaction.commandName}`;
        const now = Date.now();
        if ((cooldowns.get(key) || 0) > now) {
          return replyError(interaction, 'Slow down — you just ran this command. Try again in a moment.');
        }
        cooldowns.set(key, now + 1500);
        if (cooldowns.size > 5000) {
          for (const [entry, expiry] of cooldowns) if (expiry < now) cooldowns.delete(entry);
        }
        if (interaction.commandName === 'welcome') return handleWelcomeCommand(interaction);
        if (interaction.commandName === 'leave') return handleLeaveCommand(interaction);
        if (interaction.commandName === 'invites') return handleInvitesCommand(interaction);
        return;
      }

      if (interaction.isModalSubmit()) return handleModal(interaction);
      if (interaction.isButton()) return handleButton(interaction);
      if (interaction.isStringSelectMenu()) return handleSelect(interaction);
    } catch (error) {
      await handleInteractionError(interaction, error);
    }
  });
}
