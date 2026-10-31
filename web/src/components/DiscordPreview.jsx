import { ExternalLink, ImageIcon, Sparkles } from 'lucide-react';

const INLINE_PATTERN =
  /(\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|~~[^~]+~~|`[^`]+`|<@!?\d+>|<#\d+>|<@&\d+>|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s]+)/g;

function renderInline(text, keyPrefix = 'i') {
  const parts = String(text).split(INLINE_PATTERN);
  return parts.filter(Boolean).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(part)) return <em key={key}>{part.slice(1, -1)}</em>;
    if (/^__[^_]+__$/.test(part)) return <u key={key}>{part.slice(2, -2)}</u>;
    if (/^~~[^~]+~~$/.test(part)) return <s key={key}>{part.slice(2, -2)}</s>;
    if (/^`[^`]+`$/.test(part)) return <code key={key}>{part.slice(1, -1)}</code>;
    if (/^<@!?\d+>$/.test(part)) {
      return (
        <span key={key} className="dc-mention">
          @user
        </span>
      );
    }
    if (/^<#\d+>$/.test(part)) {
      return (
        <span key={key} className="dc-mention dc-channel">
          #channel
        </span>
      );
    }
    if (/^<@&\d+>$/.test(part)) {
      return (
        <span key={key} className="dc-mention dc-role">
          @role
        </span>
      );
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      return (
        <a key={key} href={link[2]} target="_blank" rel="noreferrer">
          {link[1]}
        </a>
      );
    }
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={key} href={part} target="_blank" rel="noreferrer">
          {part}
        </a>
      );
    }
    return <span key={key}>{part}</span>;
  });
}

function renderText(content) {
  const lines = String(content || '').split('\n');
  const nodes = [];
  let quote = [];

  const flushQuote = (key) => {
    if (!quote.length) return;
    nodes.push(
      <div key={`quote-${key}`} className="dc-quote">
        {quote.map((line, index) => (
          <div key={index}>{renderInline(line, `q-${key}-${index}`)}</div>
        ))}
      </div>,
    );
    quote = [];
  };

  lines.forEach((line, index) => {
    if (line.startsWith('> ')) {
      quote.push(line.slice(2));
      return;
    }
    if (line === '>') {
      quote.push('');
      return;
    }
    flushQuote(index);
    if (!line.trim()) {
      nodes.push(<div key={`space-${index}`} className="dc-space" />);
      return;
    }
    if (line.startsWith('### ')) {
      nodes.push(
        <div key={`h3-${index}`} className="dc-h3">
          {renderInline(line.slice(4), `h3-${index}`)}
        </div>,
      );
      return;
    }
    if (line.startsWith('## ')) {
      nodes.push(
        <div key={`h2-${index}`} className="dc-h2">
          {renderInline(line.slice(3), `h2-${index}`)}
        </div>,
      );
      return;
    }
    if (line.startsWith('# ')) {
      nodes.push(
        <div key={`h1-${index}`} className="dc-h1">
          {renderInline(line.slice(2), `h1-${index}`)}
        </div>,
      );
      return;
    }
    if (line === '-#' || line.startsWith('-# ')) {
      nodes.push(
        <div key={`small-${index}`} className="dc-small">
          {renderInline(line.replace(/^-# ?/, ''), `small-${index}`)}
        </div>,
      );
      return;
    }
    nodes.push(
      <div key={`line-${index}`} className="dc-line">
        {renderInline(line, `l-${index}`)}
      </div>,
    );
  });
  flushQuote('end');
  return nodes;
}

function ButtonPreview({ button }) {
  const tone = button.url ? 5 : Number(button.style) || 2;
  return (
    <div className={`dc-button dc-button-${tone}`}>
      {button.emoji ? <span className="dc-button-emoji">{button.emoji}</span> : null}
      <span>{button.label}</span>
      {tone === 5 ? <ExternalLink size={13} /> : null}
    </div>
  );
}

export default function DiscordPreview({ model, loading = false, error = null, compact = false }) {
  return (
    <div className="preview-shell">
      <div className="preview-topline">
        <span className="preview-live">
          <span className="live-dot" /> Live preview
        </span>
        <span className="preview-caption">Components V2</span>
      </div>
      <div className={compact ? 'discord-frame compact' : 'discord-frame'}>
        <div className="discord-channel-bar">
          <span className="hash">#</span> welcome
          <span className="discord-bar-meta">Aurora · just now</span>
        </div>
        <div className="discord-message">
          <div className="discord-avatar">
            <Sparkles size={18} />
          </div>
          <div className="discord-body">
            <div className="discord-meta">
              <span className="discord-bot-name">Aurora</span>
              <span className="discord-app-badge">
                <Sparkles size={9} /> APP
              </span>
              <span className="discord-time">Today at 12:00</span>
            </div>
            {error ? (
              <div className="discord-error">
                <strong>Preview unavailable</strong>
                <span>{error.message || 'Could not render this message.'}</span>
              </div>
            ) : !model ? (
              <div className="discord-skeleton">
                <span />
                <span />
                <span className="short" />
              </div>
            ) : (
              <div className="discord-container" style={{ borderLeftColor: model.accentColor || '#5865F2' }}>
                {loading ? (
                  <div className="dc-loading">
                    <span className="live-dot" /> Updating preview…
                  </div>
                ) : null}
                {model.blocks.map((block, index) => {
                  if (block.type === 'text') {
                    return (
                      <div key={index} className="dc-text">
                        {renderText(block.content)}
                      </div>
                    );
                  }
                  if (block.type === 'separator') {
                    return <div key={index} className={`dc-separator ${block.spacing === 2 ? 'large' : ''}`} />;
                  }
                  if (block.type === 'section') {
                    return (
                      <div key={index} className="dc-section">
                        <div className="dc-section-text">
                          {block.texts.map((text, textIndex) => (
                            <div key={textIndex} className="dc-text">
                              {renderText(text)}
                            </div>
                          ))}
                        </div>
                        {block.accessory?.type === 'thumbnail' && block.accessory.url ? (
                          <img className="dc-thumb" src={block.accessory.url} alt={block.accessory.description || ''} />
                        ) : null}
                      </div>
                    );
                  }
                  if (block.type === 'gallery') {
                    return (
                      <div key={index} className="dc-gallery">
                        {block.items.map((item, itemIndex) =>
                          item.url.startsWith('attachment://') ? (
                            <div key={itemIndex} className="dc-gallery-placeholder">
                              <ImageIcon size={20} />
                              <span>Generated banner</span>
                            </div>
                          ) : (
                            <img key={itemIndex} src={item.url} alt={item.description || ''} />
                          ),
                        )}
                      </div>
                    );
                  }
                  return null;
                })}
                {model.buttons.length ? (
                  <div className="dc-actions">
                    {model.buttons.slice(0, 25).map((button, index) => (
                      <ButtonPreview key={index} button={button} />
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
