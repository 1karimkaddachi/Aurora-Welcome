export const WELCOME_STYLES = [
  { id: 'classic', name: 'Classic Welcome', accent: '#5865F2', description: 'Balanced, friendly and timeless. Accent container, avatar, details and buttons.' },
  { id: 'modern', name: 'Modern Welcome', accent: '#22D3EE', description: 'Airy layout with a large headline, clean dividers and a cyan accent.' },
  { id: 'premium', name: 'Premium Welcome', accent: '#F0B429', description: 'Gold accents, member card, statistics and a media banner for a luxury feel.' },
  { id: 'minimal', name: 'Minimal Welcome', accent: '#94A3B8', description: 'Quiet and focused: one headline, one line of context, no clutter.' },
  { id: 'gaming', name: 'Gaming Welcome', accent: '#F43F5E', description: 'Bold uppercase energy, crimson accent and fast-loading stats.' },
  { id: 'community', name: 'Community Welcome', accent: '#34D399', description: 'Warm and social: introductions, rules and community stats up front.' },
  { id: 'professional', name: 'Professional Welcome', accent: '#3B82F6', description: 'Structured corporate card with clear labels and a muted blue accent.' },
  { id: 'custom', name: 'Custom Layout', accent: '#A855F7', description: 'Your layout, your rules — every element is driven by your configuration.' },
];

export const STYLE_IDS = WELCOME_STYLES.map((style) => style.id);

export const ELEMENT_KEYS = [
  'title',
  'description',
  'footer',
  'avatar',
  'serverIcon',
  'memberCount',
  'inviter',
  'stats',
  'image',
  'timestamp',
];

export const DEFAULT_ELEMENTS = {
  title: true,
  description: true,
  footer: true,
  avatar: true,
  serverIcon: true,
  memberCount: true,
  inviter: true,
  stats: true,
  image: true,
  timestamp: false,
};

export const DEFAULT_WELCOME_CONTENT = {
  title: 'Welcome to {server_name}!',
  description:
    'Hey {user}, you are member **#{member_number}** of this community. We are glad you are here.\n\n> **Joined:** {joined_at}\n> **Invited by:** {inviter}\n> **Account created:** {created_at}\n\nPlease read the {rules_channel} and introduce yourself in the {intros_channel}.',
  footer: '{server_name} • {member_count} members',
  color: '#5865F2',
  emoji: '👋',
  mention: false,
  elements: { ...DEFAULT_ELEMENTS },
  variants: {
    bot: {
      title: 'A new bot joined {server_name}',
      description: 'Please welcome **{username}**, a bot that was added by {inviter}.',
      emoji: '🤖',
    },
    returning: {
      title: 'Welcome back, {username}!',
      description: 'You previously visited {server_name} — great to see you again. You are member **#{member_number}**.',
      emoji: '💫',
    },
  },
};

export const DEFAULT_DM_CONTENT = {
  title: 'Welcome to {server_name}!',
  description:
    'Hi {user}, thanks for joining **{server_name}**. You are member **#{member_number}**.\n\nStart with the {rules_channel}, then introduce yourself in the {intros_channel}. If you need help, open a ticket from the welcome message.',
  footer: 'You received this message because you joined {server_name}.',
  color: '#5865F2',
  emoji: '✨',
  mention: false,
  elements: {
    ...DEFAULT_ELEMENTS,
    stats: false,
    image: true,
  },
  variants: {
    bot: { title: 'Bot added to {server_name}', description: 'Hello {username}! You were added by {inviter}.', emoji: '🤖' },
    returning: { title: 'Welcome back to {server_name}!', description: 'Good to see you again, {username}.', emoji: '💫' },
  },
};

export const DEFAULT_LEAVE_CONTENT = {
  title: 'Goodbye, {username}',
  description: '**{username}** just left {server_name}. We are now **{member_count}** members.\n\nThey joined on {joined_at} and stayed with us until now.',
  footer: '{server_name} • We hope to see you again',
  color: '#F43F5E',
  emoji: '🌙',
  mention: false,
  elements: {
    ...DEFAULT_ELEMENTS,
    inviter: false,
    image: false,
  },
  variants: {},
};

export const DEFAULT_IMAGE_CONFIG = {
  enabled: true,
  width: 1024,
  height: 420,
  font: 'Segoe UI',
  background: {
    type: 'gradient',
    colors: ['#070B18', '#14204A', '#4C1D95'],
    angle: 135,
    image: null,
    fit: 'cover',
    overlay: 0.35,
  },
  avatar: {
    show: true,
    shape: 'circle',
    size: 156,
    x: 88,
    y: 132,
    borderColor: '#FFFFFF',
    borderWidth: 6,
    glow: true,
  },
  text: {
    x: 286,
    y: 118,
    align: 'left',
    titleColor: '#C7D2FE',
    userColor: '#FFFFFF',
    subtitleColor: '#A5B4FC',
    titleSize: 26,
    userSize: 56,
    subtitleSize: 22,
  },
  server: {
    show: true,
    logo: true,
    x: 728,
    y: 32,
    size: 56,
    nameColor: '#E2E8F0',
    nameSize: 20,
  },
  memberNumber: {
    show: true,
    x: 286,
    y: 300,
    color: '#C7D2FE',
    size: 24,
  },
  decorations: {
    glow: true,
    particles: true,
    grid: true,
    accentBar: true,
  },
};

export const DEFAULT_LEAVE_IMAGE_CONFIG = {
  ...DEFAULT_IMAGE_CONFIG,
  background: {
    ...DEFAULT_IMAGE_CONFIG.background,
    colors: ['#12060B', '#3B0D1F', '#1E1B4B'],
  },
  avatar: { ...DEFAULT_IMAGE_CONFIG.avatar, borderColor: '#FDA4AF' },
  text: {
    ...DEFAULT_IMAGE_CONFIG.text,
    titleColor: '#FECDD3',
    subtitleColor: '#FDA4AF',
  },
  server: { ...DEFAULT_IMAGE_CONFIG.server },
};

export const DEFAULT_WELCOME_SETTINGS = {
  enabled: true,
  mainChannelId: null,
  secondaryChannelId: null,
  rulesChannelId: null,
  introsChannelId: null,
  announcementsChannelId: null,
  style: 'classic',
  sendMode: 'public',
  botMode: 'enabled',
  returningMode: 'returning',
  dmFailureNotice: true,
};

export const DEFAULT_LEAVE_SETTINGS = {
  enabled: true,
  channelId: null,
  style: 'classic',
  sendMode: 'public',
};

export const DEFAULT_GUILD_SETTINGS = {
  logChannelId: null,
  inviteTracking: true,
  vanityTracking: true,
  abuseThreshold: 6,
  abuseWindowMinutes: 30,
  welcomeDelayMs: 0,
  deleteWelcomeAfter: 0,
  dmFailureNotice: true,
  dryRun: false,
  ticketChannelId: null,
  rolesChannelId: null,
  rulesText: '',
};

export const BUTTON_TYPES = [
  { id: 'rules', label: 'Read Rules', description: 'Opens the rules channel (or a rules panel).' },
  { id: 'roles', label: 'Get Roles', description: 'Opens a self-assignable role picker.' },
  { id: 'intro', label: 'Introduce Yourself', description: 'Links to the introductions channel.' },
  { id: 'ticket', label: 'Open Support Ticket', description: 'Creates a private support thread.' },
  { id: 'dashboard', label: 'Visit Dashboard', description: 'Links to this dashboard.' },
  { id: 'url', label: 'Custom URL', description: 'Any validated https:// link.' },
];

export const DEFAULT_BUTTON_TYPES = ['rules', 'roles', 'intro', 'ticket'];

export function defaultWelcomeButton(type) {
  switch (type) {
    case 'rules':
      return { label: 'Read Rules', emoji: '📜', style: 2, type: 'rules', url: null };
    case 'roles':
      return { label: 'Get Roles', emoji: '🎭', style: 2, type: 'roles', url: null };
    case 'intro':
      return { label: 'Introduce Yourself', emoji: '👋', style: 2, type: 'intro', url: null };
    case 'ticket':
      return { label: 'Open Ticket', emoji: '🎫', style: 3, type: 'ticket', url: null };
    default:
      return { label: 'Visit Website', emoji: '🌐', style: 5, type: 'url', url: 'https://example.com' };
  }
}

export const BUILTIN_WELCOME_TEMPLATES = [
  {
    id: 'builtin-classic',
    name: 'Classic Welcome',
    style: 'classic',
    description: 'The balanced default: friendly headline, member details and action buttons.',
    content: DEFAULT_WELCOME_CONTENT,
  },
  {
    id: 'builtin-modern',
    name: 'Modern Welcome',
    style: 'modern',
    description: 'A calm, airy card with a large welcome headline and fewer details.',
    content: {
      ...DEFAULT_WELCOME_CONTENT,
      color: '#22D3EE',
      emoji: '✦',
      title: 'A new chapter starts here, {username}',
      description: 'You just joined **{server_name}** as member **#{member_number}**. Make yourself at home.\n\n> {rules_channel} → start here\n> {intros_channel} → say hello',
      footer: 'Welcome aboard • {member_count} members',
      elements: { ...DEFAULT_ELEMENTS, image: true, stats: false },
    },
  },
  {
    id: 'builtin-premium',
    name: 'Premium Welcome',
    style: 'premium',
    description: 'Gold-accented luxury card with stats and the generated banner.',
    content: {
      ...DEFAULT_WELCOME_CONTENT,
      color: '#F0B429',
      emoji: '♛',
      title: 'Excellence begins with you, {username}',
      description: '**{server_name}** just gained member **#{member_number}**.\n\n> **Invited by** {inviter}\n> **Joined** {joined_at}\n> **Members** {member_count}',
      footer: 'A premium community experience',
      elements: { ...DEFAULT_ELEMENTS, stats: true, timestamp: true },
    },
  },
  {
    id: 'builtin-minimal',
    name: 'Minimal Welcome',
    style: 'minimal',
    description: 'One headline, one line, no noise.',
    content: {
      ...DEFAULT_WELCOME_CONTENT,
      color: '#94A3B8',
      emoji: '',
      title: '{username} joined {server_name}',
      description: 'Member **#{member_number}** • {member_count} members',
      footer: '',
      elements: { ...DEFAULT_ELEMENTS, image: false, stats: false, inviter: false, timestamp: false },
    },
  },
  {
    id: 'builtin-gaming',
    name: 'Gaming Welcome',
    style: 'gaming',
    description: 'High-energy crimson welcome with bold labels.',
    content: {
      ...DEFAULT_WELCOME_CONTENT,
      color: '#F43F5E',
      emoji: '🎮',
      title: 'PLAYER {username} HAS ENTERED',
      description: '**READY UP.** You are player **#{member_number}** in {server_name}.\n\n> Loadout: {rules_channel}\n> Squad up: {intros_channel}\n> Recruited by: {inviter}',
      footer: 'GLHF • {member_count} players online',
      elements: { ...DEFAULT_ELEMENTS, image: true, stats: true },
    },
  },
  {
    id: 'builtin-community',
    name: 'Community Welcome',
    style: 'community',
    description: 'Social-first welcome that highlights people and places.',
    content: {
      ...DEFAULT_WELCOME_CONTENT,
      color: '#34D399',
      emoji: '🌱',
      title: 'Say hello to {username}!',
      description: 'Our community just grew to **{member_count}** members — welcome, {user}!\n\n> Start with {rules_channel}\n> Introduce yourself in {intros_channel}\n> You were invited by {inviter}',
      footer: 'Built by the community, for the community',
      elements: { ...DEFAULT_ELEMENTS, stats: true, image: true },
    },
  },
  {
    id: 'builtin-professional',
    name: 'Professional Welcome',
    style: 'professional',
    description: 'Corporate clarity with structured labels.',
    content: {
      ...DEFAULT_WELCOME_CONTENT,
      color: '#3B82F6',
      emoji: '🏛',
      title: 'Welcome to {server_name}, {username}',
      description: '**MEMBER PROFILE**\n> ID: {user_id}\n> Number: #{member_number}\n> Arrived: {joined_at}\n> Referrer: {inviter}\n\nReview {rules_channel}, then introduce yourself in {intros_channel}.',
      footer: '{server_name} • Member services',
      elements: { ...DEFAULT_ELEMENTS, stats: false, image: true },
    },
  },
  {
    id: 'builtin-custom',
    name: 'Custom Layout',
    style: 'custom',
    description: 'A starting point for a fully custom Components V2 layout.',
    content: {
      ...DEFAULT_WELCOME_CONTENT,
      color: '#A855F7',
      emoji: '✧',
      title: '{username}, welcome to {server_name}',
      description: 'Every block in this card is controlled by your dashboard. Build something only your community would recognize.\n\n> Invited by: {inviter}\n> Member: #{member_number}',
      footer: 'Crafted with Aurora',
      elements: { ...DEFAULT_ELEMENTS, image: true, stats: true },
    },
  },
];

export const BUILTIN_LEAVE_TEMPLATES = [
  {
    id: 'builtin-leave-classic',
    name: 'Classic Goodbye',
    style: 'classic',
    description: 'A respectful goodbye with member totals.',
    content: DEFAULT_LEAVE_CONTENT,
  },
  {
    id: 'builtin-leave-minimal',
    name: 'Minimal Farewell',
    style: 'minimal',
    description: 'A single quiet line.',
    content: {
      ...DEFAULT_LEAVE_CONTENT,
      emoji: '',
      title: '{username} left the server',
      description: '{member_count} members remain.',
      footer: '',
      elements: { ...DEFAULT_ELEMENTS, image: false, stats: false, inviter: false },
    },
  },
  {
    id: 'builtin-leave-warm',
    name: 'Warm Farewell',
    style: 'community',
    description: 'Warm, community-toned goodbye.',
    content: {
      ...DEFAULT_LEAVE_CONTENT,
      color: '#34D399',
      emoji: '🍂',
      title: 'Until next time, {username}',
      description: '**{username}** has left {server_name}. Thank you for being part of our story.\n\nWe are now **{member_count}** members.',
      footer: 'The door is always open',
      elements: { ...DEFAULT_ELEMENTS, stats: true },
    },
  },
];
