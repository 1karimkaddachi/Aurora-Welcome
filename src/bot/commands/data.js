import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { BUTTON_TYPES, WELCOME_STYLES } from '../../shared/defaults.js';

const styleChoices = WELCOME_STYLES.map((style) => ({ name: style.name, value: style.id }));
const buttonTypeChoices = BUTTON_TYPES.map((type) => ({ name: type.label, value: type.id }));
const buttonStyleChoices = [
  { name: 'Primary (blurple)', value: '1' },
  { name: 'Secondary (grey)', value: '2' },
  { name: 'Success (green)', value: '3' },
  { name: 'Danger (red)', value: '4' },
];

function textChannelOption(option, { required = true } = {}) {
  return option
    .setName('channel')
    .setDescription('Target text channel')
    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    .setRequired(required);
}

const welcome = new SlashCommandBuilder()
  .setName('welcome')
  .setDescription('Configure the welcome system')
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName('setup')
      .setDescription('Create the welcome configuration and optionally set the main channel')
      .addChannelOption((option) => textChannelOption(option, { required: false })),
  )
  .addSubcommand((sub) => sub.setName('enable').setDescription('Enable welcome messages'))
  .addSubcommand((sub) => sub.setName('disable').setDescription('Disable welcome messages'))
  .addSubcommand((sub) =>
    sub
      .setName('channel')
      .setDescription('Set a welcome destination or linked channel')
      .addStringOption((option) =>
        option
          .setName('type')
          .setDescription('Which channel to configure')
          .setRequired(true)
          .addChoices(
            { name: 'Main welcome channel', value: 'main' },
            { name: 'Secondary welcome channel', value: 'secondary' },
            { name: 'Rules channel', value: 'rules' },
            { name: 'Introductions channel', value: 'introductions' },
            { name: 'Announcements channel', value: 'announcements' },
          ),
      )
      .addChannelOption((option) => textChannelOption(option)),
  )
  .addSubcommand((sub) => sub.setName('message').setDescription('Edit the welcome title, description, footer and emoji'))
  .addSubcommand((sub) =>
    sub
      .setName('preview')
      .setDescription('Preview the welcome message with a sample member')
      .addStringOption((option) =>
        option.setName('style').setDescription('Preview a different style without saving').addChoices(...styleChoices),
      ),
  )
  .addSubcommand((sub) => sub.setName('test').setDescription('Send a real welcome message using your account as the sample member'))
  .addSubcommand((sub) =>
    sub
      .setName('image')
      .setDescription('Inspect or toggle the generated welcome banner')
      .addBooleanOption((option) => option.setName('enabled').setDescription('Enable or disable the generated banner'))
      .addBooleanOption((option) => option.setName('preview').setDescription('Generate and show the banner')),
  )
  .addSubcommandGroup((group) =>
    group
      .setName('template')
      .setDescription('Manage welcome templates')
      .addSubcommand((sub) => sub.setName('list').setDescription('List built-in and saved templates'))
      .addSubcommand((sub) =>
        sub
          .setName('apply')
          .setDescription('Apply a template')
          .addStringOption((option) =>
            option.setName('name').setDescription('Template name or ID').setRequired(true).setAutocomplete(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('save')
          .setDescription('Save the current welcome configuration as a template')
          .addStringOption((option) => option.setName('name').setDescription('Template name').setRequired(true).setMaxLength(100))
          .addStringOption((option) => option.setName('description').setDescription('Short description').setMaxLength(300)),
      )
      .addSubcommand((sub) =>
        sub
          .setName('delete')
          .setDescription('Delete a saved template')
          .addStringOption((option) =>
            option.setName('name').setDescription('Saved template').setRequired(true).setAutocomplete(true),
          ),
      ),
  )
  .addSubcommandGroup((group) =>
    group
      .setName('autorole')
      .setDescription('Manage automatic roles')
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription('Add an automatic role')
          .addRoleOption((option) => option.setName('role').setDescription('Role to assign').setRequired(true))
          .addStringOption((option) =>
            option
              .setName('target')
              .setDescription('Who receives the role')
              .addChoices(
                { name: 'Humans', value: 'human' },
                { name: 'Bots', value: 'bot' },
                { name: 'Everyone', value: 'all' },
              ),
          )
          .addIntegerOption((option) =>
            option.setName('delay').setDescription('Delay in seconds').setMinValue(0).setMaxValue(3600),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('Remove an automatic role')
          .addRoleOption((option) => option.setName('role').setDescription('Role to remove').setRequired(true)),
      )
      .addSubcommand((sub) => sub.setName('list').setDescription('List automatic roles')),
  )
  .addSubcommandGroup((group) =>
    group
      .setName('dm')
      .setDescription('Configure welcome direct messages')
      .addSubcommand((sub) => sub.setName('enable').setDescription('Send welcome DMs in addition to the public message'))
      .addSubcommand((sub) => sub.setName('disable').setDescription('Stop sending welcome DMs'))
      .addSubcommand((sub) =>
        sub
          .setName('mode')
          .setDescription('Choose where welcome messages are delivered')
          .addStringOption((option) =>
            option
              .setName('value')
              .setDescription('Delivery mode')
              .setRequired(true)
              .addChoices(
                { name: 'Public channel only', value: 'public' },
                { name: 'DM only', value: 'dm' },
                { name: 'Public and DM', value: 'both' },
              ),
          ),
      )
      .addSubcommand((sub) => sub.setName('message').setDescription('Edit the welcome DM content')),
  )
  .addSubcommandGroup((group) =>
    group
      .setName('buttons')
      .setDescription('Manage welcome buttons')
      .addSubcommand((sub) => sub.setName('list').setDescription('List configured buttons'))
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription('Add a button')
          .addStringOption((option) => option.setName('label').setDescription('Button label').setRequired(true).setMaxLength(80))
          .addStringOption((option) =>
            option.setName('type').setDescription('Button action').setRequired(true).addChoices(...buttonTypeChoices),
          )
          .addStringOption((option) =>
            option.setName('style').setDescription('Button colour (internal actions only)').addChoices(...buttonStyleChoices),
          )
          .addStringOption((option) => option.setName('url').setDescription('URL (required for custom URL buttons)'))
          .addStringOption((option) => option.setName('emoji').setDescription('Button emoji').setMaxLength(64)),
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('Remove a button')
          .addStringOption((option) =>
            option.setName('button').setDescription('Button to remove').setAutocomplete(true),
          ),
      ),
  )
  .addSubcommand((sub) => sub.setName('reset').setDescription('Reset the welcome message to defaults (channels are kept)'))
  .addSubcommand((sub) => sub.setName('stats').setDescription('Show welcome and membership statistics'));

const leave = new SlashCommandBuilder()
  .setName('leave')
  .setDescription('Configure the leave message system')
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName('setup')
      .setDescription('Create the leave configuration and optionally set the channel')
      .addChannelOption((option) => textChannelOption(option, { required: false })),
  )
  .addSubcommand((sub) => sub.setName('enable').setDescription('Enable leave messages'))
  .addSubcommand((sub) => sub.setName('disable').setDescription('Disable leave messages'))
  .addSubcommand((sub) =>
    sub
      .setName('channel')
      .setDescription('Set the leave message channel')
      .addChannelOption((option) => textChannelOption(option)),
  )
  .addSubcommand((sub) => sub.setName('message').setDescription('Edit the leave message'))
  .addSubcommand((sub) =>
    sub
      .setName('preview')
      .setDescription('Preview the leave message')
      .addStringOption((option) =>
        option.setName('style').setDescription('Preview a different style without saving').addChoices(...styleChoices),
      ),
  )
  .addSubcommand((sub) => sub.setName('test').setDescription('Send a real leave message using your account as the sample member'))
  .addSubcommand((sub) =>
    sub
      .setName('image')
      .setDescription('Toggle the generated leave banner')
      .addBooleanOption((option) => option.setName('enabled').setDescription('Enable or disable the leave banner').setRequired(true)),
  );

const invites = new SlashCommandBuilder()
  .setName('invites')
  .setDescription('View invite tracking statistics')
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName('user')
      .setDescription('Show invite statistics for a member')
      .addUserOption((option) => option.setName('member').setDescription('Member to inspect').setRequired(true)),
  )
  .addSubcommand((sub) => sub.setName('leaderboard').setDescription('Show the server invite leaderboard'));

export const commandData = [welcome.toJSON(), leave.toJSON(), invites.toJSON()];
