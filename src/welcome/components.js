import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from 'discord.js';

function buildSection(block) {
  const section = new SectionBuilder();
  if (block.texts?.length) {
    section.addTextDisplayComponents(block.texts.map((content) => new TextDisplayBuilder().setContent(content)));
  }
  if (block.accessory?.type === 'thumbnail' && block.accessory.url) {
    const thumbnail = new ThumbnailBuilder().setURL(block.accessory.url);
    if (block.accessory.description) thumbnail.setDescription(block.accessory.description);
    section.setThumbnailAccessory(thumbnail);
  }
  return section;
}

function buildGallery(block) {
  const gallery = new MediaGalleryBuilder();
  gallery.addItems(
    block.items.slice(0, 10).map((item) => {
      const galleryItem = new MediaGalleryItemBuilder().setURL(item.url);
      if (item.description) galleryItem.setDescription(item.description);
      return galleryItem;
    }),
  );
  return gallery;
}

export function buildButton(button) {
  const builder = new ButtonBuilder().setLabel(button.label);
  if (button.emoji) builder.setEmoji(button.emoji);
  if (button.url) {
    builder.setStyle(ButtonStyle.Link).setURL(button.url);
  } else {
    const style = [1, 2, 3, 4].includes(Number(button.style)) ? Number(button.style) : ButtonStyle.Secondary;
    builder.setStyle(style).setCustomId(button.customId);
  }
  if (button.disabled) builder.setDisabled(true);
  return builder;
}

export function buildContainer(model) {
  const container = new ContainerBuilder();
  if (Number.isFinite(model.accentInt)) container.setAccentColor(model.accentInt);

  for (const block of model.blocks) {
    switch (block.type) {
      case 'text':
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(block.content));
        break;
      case 'separator':
        container.addSeparatorComponents(
          new SeparatorBuilder()
            .setDivider(Boolean(block.divider))
            .setSpacing(block.spacing === 2 ? 2 : 1),
        );
        break;
      case 'section':
        if (block.accessory?.url) {
          container.addSectionComponents(buildSection(block));
        } else {
          for (const content of block.texts || []) {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
          }
        }
        break;
      case 'gallery':
        container.addMediaGalleryComponents(buildGallery(block));
        break;
      default:
        break;
    }
  }

  const buttons = (model.buttons || []).slice(0, 25);
  for (let index = 0; index < buttons.length; index += 5) {
    const chunk = buttons.slice(index, index + 5).map(buildButton);
    if (chunk.length) container.addActionRowComponents(new ActionRowBuilder().addComponents(...chunk));
  }
  return container;
}

export function buildMessagePayload(model, { files = [], ephemeral = false } = {}) {
  const flags = MessageFlags.IsComponentsV2 | (ephemeral ? MessageFlags.Ephemeral : 0);
  return {
    components: [buildContainer(model)],
    flags,
    files,
    allowedMentions: model.mentionUserId
      ? { parse: [], users: [String(model.mentionUserId)] }
      : { parse: [] },
  };
}

export function buildInfoPayload(container, { ephemeral = true } = {}) {
  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 | (ephemeral ? MessageFlags.Ephemeral : 0),
  };
}

export function buildTextContainer({ accent, lines, rows = [] }) {
  const container = new ContainerBuilder();
  if (accent) container.setAccentColor(accent);
  for (const line of lines.filter(Boolean)) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(line));
  }
  for (const row of rows) container.addActionRowComponents(row);
  return container;
}
