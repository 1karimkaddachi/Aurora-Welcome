import {
  BUILTIN_LEAVE_TEMPLATES,
  BUILTIN_WELCOME_TEMPLATES,
} from '../shared/defaults.js';
import {
  createTemplate,
  deleteTemplate,
  getLeaveConfig,
  getTemplate,
  getWelcomeConfig,
  listTemplates,
  saveLeaveConfig,
  saveWelcomeConfig,
} from '../db/repositories.js';

export function listAllTemplates(guildId, type = 'welcome') {
  const builtins = type === 'leave' ? BUILTIN_LEAVE_TEMPLATES : BUILTIN_WELCOME_TEMPLATES;
  const custom = listTemplates(guildId, type);
  return [
    ...builtins.map((template) => ({ ...template, builtin: true, description: template.description })),
    ...custom.map((template) => ({ ...template, builtin: false })),
  ];
}

export function findTemplate(guildId, type, idOrName) {
  const query = String(idOrName || '').trim().toLowerCase();
  return listAllTemplates(guildId, type).find(
    (template) => template.id.toLowerCase() === query || template.name.toLowerCase() === query,
  ) || null;
}

export function applyTemplateToContent(template) {
  return {
    style: template.style,
    content: structuredClone(template.content),
    image: template.image ? structuredClone(template.image) : null,
  };
}

export function applyWelcomeTemplate(guildId, template) {
  const config = getWelcomeConfig(guildId);
  const applied = applyTemplateToContent(template);
  config.style = applied.style;
  config.content = applied.content;
  if (applied.image) config.image = applied.image;
  return saveWelcomeConfig(guildId, config);
}

export function applyLeaveTemplate(guildId, template) {
  const config = getLeaveConfig(guildId);
  const applied = applyTemplateToContent(template);
  config.style = applied.style;
  config.content = applied.content;
  if (applied.image) config.image = applied.image;
  return saveLeaveConfig(guildId, config);
}

export function saveWelcomeTemplate(guildId, { name, description = '' }) {
  const config = getWelcomeConfig(guildId);
  return createTemplate(guildId, {
    type: 'welcome',
    name,
    description,
    style: config.style,
    content: config.content,
    image: config.image,
  });
}

export function saveLeaveTemplate(guildId, { name, description = '' }) {
  const config = getLeaveConfig(guildId);
  return createTemplate(guildId, {
    type: 'leave',
    name,
    description,
    style: config.style,
    content: config.content,
    image: config.image,
  });
}

export { getTemplate, deleteTemplate };
