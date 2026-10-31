# Aurora Welcome

**A production-grade Discord welcome system with a premium dashboard.**

Aurora Welcome handles the entire member journey: Components V2 welcome messages, generated canvas banners, direct messages, self-assignable roles, support tickets, invite attribution, leave messages, audit logs and membership analytics — all managed from a dark, responsive SaaS dashboard that writes directly to the same database the bot reads.

No embeds. No fake buttons. No disconnected settings. Every switch, button, modal and command performs a real operation.

---

## 1. Introduction

Most welcome bots stop at “send a message when someone joins.” Aurora is built as a complete onboarding system:

- **Eight distinct Components V2 layouts** plus a fully custom layout driven by element toggles.
- **A live preview rendered by the same server model** that produces the real Discord payload, so the dashboard and Discord never drift apart.
- **Dynamic banners** generated per join in a worker pool with `@napi-rs/canvas`.
- **Real invite attribution** using counter diffs, vanity URLs, ambiguity tracking and abuse heuristics.
- **A complete dashboard** with 13 pages, OAuth2 authorization, role/channel validation and audit logging.

Aurora can run for many servers at once. Every guild has independent settings, templates, buttons, roles, logs, invite history and statistics.

---

## 2. System overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         Node process                             │
│                                                                  │
│  Express dashboard  ──── reads/writes ────┐                      │
│   • OAuth2 + sessions                     │                      │
│   • REST API                              ▼                      │
│   • static React build              SQLite (WAL)                 │
│                                     data/aurora.db               │
│                                           ▲                      │
│  discord.js client ─── reads/writes ──────┘                      │
│   • guild/member/invite events                                   │
│   • Components V2 delivery                                       │
│   • slash commands & interactions                                │
│                                                          │       │
│  Canvas worker pool ── generates PNG banners ─────────────┘       │
└──────────────────────────────────────────────────────────────────┘
```

The bot and dashboard run in **one process** by default. A dashboard change is committed to SQLite immediately and the next join, leave or command reads the new value — **no restart required**. If you run the dashboard separately, point it at the same database file; SQLite WAL handles concurrent access.

---

## 3. Features

### Welcome system
- Main and secondary welcome destinations.
- Rules, introductions and announcements channel links used by placeholders and buttons.
- Custom title, description, footer, emoji and accent colour.
- Bot variant and returning-member variant with independent copy.
- Public, DM-only or public + DM delivery.
- Mention control with strict `allowedMentions`.
- Delete-after timer and join delay.
- Dry-run mode for safe staging.
- Welcome logs, DM failure logs and image failure logs.

### Components V2 only
- Containers, text displays, separators, sections, thumbnail accessories, media galleries and action rows.
- `MessageFlags.IsComponentsV2` is always set.
- **Zero embeds.** `content` and `embeds` are never used for user-facing messages.
- Up to 25 buttons per message, chunked into five-per-row action rows.

### Eight styles
Classic, Modern, Premium, Minimal, Gaming, Community, Professional and Custom. Each style has a different block order, emphasis, separator usage and decoration treatment.

### Images
- Gradient, solid or uploaded background.
- Up to five gradient colour stops, angle and overlay.
- Avatar shape (circle/rounded/square), size, ring, glow and position.
- Headline, username, subtitle and member-number layers.
- Font family selection (system fonts + custom fonts in `data/fonts`).
- Server brand/logo, member badge, particles, grid, accent bar and glow.
- Live preview and image templates.
- Worker-thread pool so generation never blocks the gateway.

### Buttons
- Read Rules, Get Roles, Introduce Yourself, Open Support Ticket, Dashboard and validated custom URLs.
- Configurable label, emoji, style, enabled state and order.
- Self-assignable roles with hierarchy checks and toggle feedback.
- Support tickets create private threads (public-thread fallback).
- DM buttons are restricted to link/dashboard actions because DMs have no guild interaction context.

### Auto roles
- Multiple roles, human/bot/everyone targets, optional delays.
- Managed-role rejection, bot-hierarchy validation and per-assignment audit logs.

### Invite tracking
- Cached invite counters, per-join attribution, vanity fallback and unknown tracking.
- Leaderboards, recent attribution feed, per-inviter statistics.
- Configurable abuse threshold/window with audit alerts.
- Stores invite history in SQLite.

### Dashboard
Overview, Welcome Settings, Message Editor, Message Templates, Welcome Images, Button Manager, Auto Roles, DM Settings, Leave Settings, Invite Tracking, Statistics, Logs and Advanced Settings.
- OAuth2 login with Manage Server verification.
- Live Components V2 preview and live banner preview.
- Template create/apply/duplicate/delete/restore.
- CSV export, configuration export and guarded maintenance actions.
- Responsive layout for desktop and mobile.

---

## 4. Requirements

- **Node.js 22.5+** (Node 24 recommended; Aurora uses the built-in `node:sqlite` module and runs with `--disable-warning=ExperimentalWarning`).
- A Discord application with a bot token.
- A server where you have **Manage Server**, plus permissions to add a bot.
- No external database server is required. SQLite is embedded.
- `@napi-rs/canvas` ships prebuilt binaries, so no native build tools are required on Windows/macOS/Linux.
- Disk space for uploads (`data/uploads`) and logs.

---

## 5. Installation

```bash
git clone <your-repository-url> aurora-welcome
cd aurora-welcome
npm install
cp .env.example .env
```

Edit `.env`, then build the dashboard and start:

```bash
npm run build
npm start
```

The dashboard is served by the same Express process on `http://localhost:3000` (configurable).

### Scripts

| Script | Purpose |
| --- | --- |
| `npm start` | Start bot + dashboard |
| `npm run dev` | Start with Node `--watch` (backend) |
| `npm run build` | Build the React dashboard into `public/` |
| `npm run deploy-commands` | Register slash commands via REST |
| `npm run seed:dev` | Create development-only demo data (no Discord resources) |
| `npm test` | Run the 60-test suite |

---

## 6. Discord Developer Portal setup

1. Open [discord.com/developers/applications](https://discord.com/developers/applications) and create an application.
2. **Bot** tab → Add Bot → copy the token into `DISCORD_TOKEN`.
3. **General Information** → copy Application ID into `DISCORD_CLIENT_ID`.
4. **OAuth2** → copy Client Secret into `DISCORD_CLIENT_SECRET`.
5. **OAuth2 → Redirects** → add:
   ```
   http://localhost:3000/auth/callback
   ```
   (or your production `DASHBOARD_URL` + `/auth/callback`).
6. **Bot → Privileged Gateway Intents**:
   - **Server Members Intent** — required for join/leave events and member counts.
   - **Presence Intent** — not used.
   - **Message Content Intent** — **not required**.
7. **Installation** → Guild Install with scopes:
   - `bot`
   - `applications.commands`
8. Add the bot to your server with the permissions below.

OAuth2 scopes used by the dashboard: `identify` and `guilds` (read-only guild list and permissions). Aurora never requests message content.

---

## 7. Bot permissions and intents

Required permissions:

| Permission | Why |
| --- | --- |
| View Channels | See configured destinations |
| Send Messages | Deliver Components V2 messages |
| Attach Files | Attach generated banners |
| Manage Roles | Auto roles and self roles |
| Manage Server | Fetch invites/vanity data and create threads |
| Create Private Threads | Support tickets |
| Create Public Threads | Ticket fallback |
| Send Messages in Threads | Ticket welcome message |
| Read Message History | Delete-after cleanup and audit context |

Gateway intents used: `Guilds`, `GuildMembers`, `GuildInvites`.

Role hierarchy rules:
- The bot’s highest role must be **above** every auto role and self-assignable role.
- Managed/integration roles are rejected.
- The server owner is never modified automatically.
- All assignment results (success/failure) are logged.

---

## 8. Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | Yes for bot | Bot token. Omit to run dashboard-only. |
| `DISCORD_CLIENT_ID` | Yes for OAuth | Application ID (also used for bot invite links). |
| `DISCORD_CLIENT_SECRET` | Yes for OAuth | OAuth2 client secret. |
| `DASHBOARD_URL` | Yes | Public base URL, e.g. `https://welcome.example.com`. Must match the OAuth redirect. |
| `PORT` | No | Express port, default `3000`. |
| `SESSION_SECRET` | Production | Long random string used to sign OAuth state. Required in production. |
| `DATA_DIR` | No | SQLite/uploads/log directory, default `./data`. |
| `LOG_LEVEL` | No | `debug`, `info`, `warn`, `error`. |
| `DISCORD_GUILD_ID` | No | Register commands to one guild instantly (development). |
| `ALLOW_DEV_AUTH` | No | Local-only developer sign-in without OAuth. **Never enable in production.** |
| `DEV_GUILD_ID` | No | Restrict developer access to one seeded guild. |
| `DEV_USER_ID` | No | Fake developer user ID used in development sessions. |
| `IMAGE_WORKERS` | No | Canvas worker count (default 2, max 4). |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 9. Database configuration

Aurora uses SQLite through Node’s built-in `node:sqlite`:

- File: `data/aurora.db` (override with `DATA_DIR`).
- WAL mode, foreign keys and a busy timeout are enabled.
- Migrations are applied automatically on startup (`schema_migrations`).
- Sessions, guild configuration, templates, buttons, roles, invite history, member history, daily statistics and logs are all stored here.
- Uploaded backgrounds live in `data/uploads/<guildId>/`; generated files are never cached on disk (banners are generated on demand).
- Back up by copying `data/aurora.db` (and `-wal`/`-shm` while running) or using SQLite’s backup API.

Schema highlights:

| Table | Purpose |
| --- | --- |
| `guilds` | Known communities, member count, bot presence |
| `welcome_configs` / `leave_configs` | Full onboarding configuration |
| `guild_settings` | Logging, invite tracking, delays, dry-run |
| `welcome_buttons` | Per-scope button definitions |
| `auto_roles` / `self_roles` | Assignment and self-service roles |
| `templates` / `image_templates` | Saved message and banner presets |
| `invites` / `invite_uses` | Invite cache and attribution |
| `member_history` | Joins, leaves, member numbers, inviter |
| `join_stats` | Daily joins/leaves/member totals |
| `logs` | Audit stream |
| `sessions` | Dashboard sessions |
| `dashboard_preferences` | Per-user dashboard preferences |

Every guild row is independent. Foreign keys cascade welcome/leave/settings/buttons/roles/templates; audit/history tables are keyed by `guild_id` for retention control.

---

## 10. Bot startup

```bash
npm run build     # once, and after UI changes
npm start
```

What happens:

1. SQLite migrations run.
2. The dashboard starts listening on `PORT`.
3. The bot logs in, syncs guild rows/member counts, caches invites and registers slash commands.
4. If `DISCORD_TOKEN` is missing, the dashboard still starts in **bot-offline mode** and clearly shows it; configuration can be edited but delivery waits for a connection.

For production, use a process manager (PM2, systemd, Windows Service) and keep one bot process per token.

Slash commands are registered on ready. If commands do not appear, restart once or run:

```bash
npm run deploy-commands
```

Global commands can take up to an hour to propagate; set `DISCORD_GUILD_ID` during development for instant guild commands.

---

## 11. Dashboard installation

The dashboard is a Vite + React application:

```bash
npm run build
```

This emits `public/index.html` and hashed assets. Express serves it and falls back to `index.html` for SPA routes.

For frontend development with hot reload:

```bash
npx vite --config web/vite.config.js
```

Vite proxies `/api` and `/auth` to `http://localhost:3000`. Run `npm start` in another terminal for the backend.

If the dashboard shows “Dashboard assets are not built yet”, run `npm run build` and restart.

---

## 12. Dashboard configuration

1. Set `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DASHBOARD_URL` and `SESSION_SECRET`.
2. Add `<DASHBOARD_URL>/auth/callback` as an OAuth redirect.
3. Open the dashboard and click **Continue with Discord**.
4. Aurora verifies that you own or have **Manage Server**/**Administrator** on the selected guild, and that the bot is present.
5. Choose a community from the sidebar.

Security model:
- Session cookies are opaque, `HttpOnly`, `SameSite=Lax`, and `Secure` when the dashboard URL is HTTPS.
- OAuth state is HMAC-signed and expires after 10 minutes.
- Mutating requests are blocked when `Origin` does not match `DASHBOARD_URL`.
- API requests are rate-limited per IP.
- Every guild route re-checks Discord permissions (cached for 60 seconds).
- The bot token and OAuth secret never reach the browser.

### Pages

| Page | What it controls |
| --- | --- |
| Overview | Stats, delivery status, live preview, recent members/activity, invite leaders |
| Welcome Settings | Channels, style, send mode, bot/returning behaviour, mention |
| Message Editor | Content, placeholders, variants, elements, colour, live message + banner preview |
| Message Templates | Built-in and saved layouts; apply, save, duplicate, delete, restore |
| Welcome Images | Full canvas studio, uploads, image templates |
| Button Manager | Button CRUD/reorder/toggle, DM-safe actions, self-assignable roles |
| Auto Roles | Assignment rules, targets, delays, hierarchy checks |
| DM Settings | DM content, delivery mode, test DM to the signed-in user |
| Leave Settings | Leave channel, content, style, elements, banner, test |
| Invite Tracking | Leaderboard, recent attribution, tracking toggles, clear history |
| Statistics | 7/30/90-day charts, daily table, CSV export |
| Logs | Category filters, pagination, metadata, retention |
| Advanced Settings | Log/ticket/roles channels, abuse settings, delays, dry-run, danger zone, export |

### Developer-only dashboard mode

For local UI work without Discord credentials:

```bash
cp .env.example .env
# ALLOW_DEV_AUTH=true
# DEV_GUILD_ID=<seeded guild id>
npm run seed:dev
npm run build
npm start
```

`npm run seed:dev` creates a **fake guild and sample history in SQLite**. It does not create Discord resources and is not a production feature. Developer sign-in is disabled when `NODE_ENV=production`.

---

## 13. Slash commands

All configuration commands require **Manage Server** (they also set Discord’s default permissions).

### `/welcome`

| Subcommand | Behaviour |
| --- | --- |
| `setup [channel]` | Creates/repairs config, optionally sets the main channel |
| `enable` / `disable` | Toggle delivery |
| `channel <type> <channel>` | Set main, secondary, rules, introductions or announcements |
| `message` | Modal editor for title/description/footer/emoji |
| `preview [style]` | Ephemeral Components V2 preview with banner |
| `test` | Sends a real welcome using you as the sample member |
| `image [enabled] [preview]` | Toggle or render the banner |
| `template list/apply/save/delete` | Manage built-in and saved templates (autocomplete) |
| `autorole add/remove/list` | Manage automatic roles |
| `dm enable/disable/mode/message` | DM delivery and content |
| `buttons list/add/remove` | Manage welcome buttons |
| `reset` | Confirmation then reset content/style/banner (channels kept) |
| `stats` | Membership + invite + welcome summary |

### `/leave`

`setup`, `enable`, `disable`, `channel`, `message`, `preview`, `test`, `image`.

### `/invites`

| Subcommand | Behaviour |
| --- | --- |
| `user <member>` | Total, last 7 days, recent invitees |
| `leaderboard` | Top inviters and latest attributions |

Every command response uses Components V2 containers — no embeds.

---

## 14. Components V2 explanation

Discord Components V2 replaces embeds with composable components. Aurora uses:

- **Container** (`type 17`) with an accent colour.
- **Text Display** (`type 10`) for headings, body, small text and quotes (Discord markdown).
- **Separator** (`type 14`) with divider/spacing.
- **Section** (`type 9`) combining text with a thumbnail accessory or button accessory.
- **Thumbnail** (`type 11`) for avatars/server icons.
- **Media Gallery** (`type 12`) for the generated banner (`attachment://welcome.png`).
- **Action Row** + **Button** (`type 1/2`) inside the container.

Delivery always sets:

```js
flags: MessageFlags.IsComponentsV2   // 32768
```

Rules and limitations:
- `content` and `embeds` are not used in Components V2 messages.
- Files are still attached normally; the gallery references `attachment://…`.
- Ephemeral responses combine `IsComponentsV2 | Ephemeral`.
- DM buttons can only be link buttons; internal custom-ID actions require a guild interaction context.
- Sections require an accessory — Aurora falls back to plain text displays when no thumbnail is available.
- A message supports at most 25 buttons; Aurora chunks them into rows of five.
- If every element is disabled, Aurora inserts a readable fallback text block.

The dashboard’s preview consumes the **same serialized model** used by the bot (`buildMessageModel` → preview API), then React renders Discord-like chrome around it.

---

## 15. Placeholder documentation

Placeholders resolve at delivery time for the real member and guild. Missing values degrade to readable fallbacks.

| Placeholder | Example |
| --- | --- |
| `{user}` | `<@111111111111111111>` |
| `{username}` | `Nova` |
| `{user_id}` | `111111111111111111` |
| `{server}` / `{server_name}` | `Aurora Community` |
| `{server_id}` | `987654321098765432` |
| `{member_count}` | `12,480` |
| `{created_at}` | `14 Mar 2024` |
| `{joined_at}` | `31 Oct 2026` |
| `{avatar}` | Avatar CDN URL |
| `{server_icon}` | Server icon CDN URL |
| `{inviter}` | `Kai` or “an unknown invite” |
| `{invite_code}` | `aurora` or `Unknown` |
| `{rules_channel}` | `<#…>` or “the rules channel” |
| `{welcome_channel}` | `<#…>` or “the welcome channel” |
| `{intros_channel}` | `<#…>` or “the introductions channel” |
| `{announcements_channel}` | `<#…>` or “the announcements channel” |
| `{member_number}` | `1,024` |

Unknown tokens are preserved (so typos are visible in previews). Placeholders are supported in titles, descriptions, footers and variants.

---

## 16. Welcome image configuration

Banners are generated per join and attached to the message:

1. Background: gradient, solid colour or uploaded image.
2. Decorative layers (glow, particles, grid, accent bar; style-specific extras).
3. Avatar layer with shape, ring, glow and position.
4. Server brand/logo.
5. Typography: style label, display name, join date/inviter, member number badge.

Configuration lives in `welcome_configs.image_json` / `leave_configs.image_json`. Uploads are stored under `data/uploads/<guildId>/` and validated by MIME type and size (8 MB default). Background paths must match `uploads/<guildId>/<file>` — path traversal is rejected.

Performance:
- `@napi-rs/canvas` renders in a worker-thread pool (`IMAGE_WORKERS`, default 2).
- Requests time out after 20 seconds and fall back to in-process rendering if the pool fails.
- The queue is bounded; the dashboard preview endpoint is separately rate-limited.
- Banner failures are logged and the message is still delivered without the gallery.

Custom fonts: put `.ttf`, `.otf`, `.woff` or `.woff2` files in `data/fonts`. The font family is derived from the file name and appears in the font selector. Built-in fallbacks are Segoe UI (Windows) and DejaVu Sans (Linux).

Image templates snapshot the full image config plus a background reference. Applying a template does not copy the file; keep the referenced upload.

---

## 17. Invite tracking limitations

Discord does not expose “which invite was used” directly. Aurora:

1. Caches every invite’s `uses` counter on startup and on invite create/delete.
2. On a join, fetches invites again and compares counters.
3. Attributes the join to the invite whose counter increased.
4. If multiple counters increased (simultaneous joins or race), records all candidates, logs an ambiguity warning and credits the largest delta.
5. If no counter changed and a vanity URL exists, attributes to the vanity URL.
6. Otherwise records an **unknown** attribution so totals stay honest.

Known limits:
- Simultaneous joins can be ambiguous; attribution is best-effort.
- Bots/integration joins may not increment invite counters.
- The bot needs **Manage Server** to fetch invites.
- Vanity tracking requires the vanity code to exist at join time.
- Invite fetch failures never block a join; they are logged.
- Clearing history deletes leaderboards and cached invites; the next join re-caches.
- Abuse alerts are heuristic (threshold within a time window), not proof of abuse.

---

## 18. Troubleshooting

**Dashboard returns 503 “assets not built”**
Run `npm run build` in the project root and restart.

**Port already in use**
Change `PORT` or stop the process using it:
```bash
netstat -ano | findstr :3000
```

**Slash commands missing**
- Wait for global propagation, or set `DISCORD_GUILD_ID` and restart.
- Run `npm run deploy-commands`.
- Confirm the bot was invited with `applications.commands`.

**Welcome not sending**
- Check `welcome.enabled`.
- Check a main/secondary channel is configured.
- Check bot permissions in that channel (View/Send/Attach).
- Check `dryRun`.
- Open **Logs** and look for `channel_missing`, `failed`, `skipped` or `dry_run`.
- Verify Server Members Intent is enabled.

**DM failed**
The member may have DMs closed (`50007`). This is logged as a DM failure. Enable “Post DM failures to the log channel” if you want it mirrored to Discord.

**Images broken or blank**
- Ensure `Attach Files` is granted.
- Check the uploaded file still exists.
- Use PNG/JPEG/WebP/GIF under the size limit.
- Check logs for `image failed`.
- Custom font files must be readable and valid.

**OAuth login fails**
- The redirect URI must match exactly, including scheme and port.
- `DASHBOARD_URL` must be the public URL.
- State cookies expire after 10 minutes; retry.
- If using HTTPS, `Secure` cookies are expected; ensure the proxy forwards HTTPS.

**Dashboard login loops**
Check that `/auth/callback` exists in the Developer Portal and that the session cookie is not blocked. In local development, use `http://localhost:3000`, not an IP mismatch.

**Invite attribution unknown**
Grant Manage Server, restart so invites cache, then test another join. Vanity tracking must be enabled for vanity joins.

**Node warning about SQLite**
Aurora starts Node with `--disable-warning=ExperimentalWarning`. If you launch `src/index.js` manually, add that flag or ignore the warning.

---

## 19. Common errors

| Error | Meaning / fix |
| --- | --- |
| `50007 Cannot send messages to this user` | DMs closed; logged as DM failure |
| `Missing Access` on invites | Bot lacks Manage Server |
| `Missing Permissions` on roles | Role above bot / missing Manage Roles |
| `Unknown Channel` | Configured channel was deleted; choose another |
| `Invalid Form Body` | Configuration validation caught it; check the dashboard field |
| `EADDRINUSE` | Port conflict; change `PORT` |
| `Invalid OAuth2 redirect_uri` | Redirect mismatch in Developer Portal |
| `Failed to register commands` | Bot token/application ID wrong, or no access to `DISCORD_GUILD_ID` |
| Upload `LIMIT_FILE_SIZE` | Image exceeds 8 MB |
| `Image generation timed out` | Worker pool saturated; retry or lower preview rate |

---

## 20. Security recommendations

- Run behind HTTPS and set `DASHBOARD_URL` accordingly.
- Generate a strong `SESSION_SECRET`; never commit `.env`.
- Keep `ALLOW_DEV_AUTH=false` in production.
- Do not expose the SQLite file or `data/` through your web server.
- Restrict dashboard access at the network layer if possible (VPN/SSO proxy).
- Grant the bot only the permissions listed above; keep its role below trusted admin roles.
- Review the audit log channel and rotate the bot token if leaked.
- Back up `data/aurora.db` and `data/uploads` regularly.
- Uploads are validated by MIME type and stored with randomized names; backgrounds are never fetched from arbitrary URLs.
- API mutations are same-origin checked, rate-limited and permission-verified per guild.
- Content is rendered as Discord markdown, never as HTML in the dashboard; React escapes output.

---

## 21. Project structure

```
bot/
├─ src/
│  ├─ index.js                 # starts dashboard + bot in one process
│  ├─ config.js                # env, directories, limits
│  ├─ logger.js                # console + file logging
│  ├─ db/
│  │  ├─ index.js              # SQLite connection + migrations
│  │  └─ repositories.js       # all data access
│  ├─ shared/
│  │  ├─ defaults.js           # styles, defaults, built-in templates
│  │  ├─ placeholders.js       # resolver + documentation
│  │  └─ validation.js         # config/button/role/image validation
│  ├─ welcome/
│  │  ├─ model.js              # shared message render model (8 styles)
│  │  ├─ components.js         # model → Components V2 builders
│  │  ├─ service.js            # delivery, DMs, leave, tests, previews
│  │  ├─ render-canvas.js      # banner renderer
│  │  ├─ image.js              # worker pool + fallback
│  │  ├─ image-worker.js       # worker entry
│  │  └─ templates.js          # template listing/application
│  ├─ invites/tracker.js       # invite cache + attribution
│  ├─ bot/
│  │  ├─ client.js             # discord.js client
│  │  ├─ deploy.js             # command registration
│  │  ├─ audit.js              # DB + Discord log mirror
│  │  ├─ autoroles.js          # hierarchy-safe assignment
│  │  ├─ commands/             # slash data + welcome/leave/invites handlers
│  │  └─ events/               # ready, members, invites, interactions
│  └─ dashboard/
│     ├─ server.js             # Express app + static SPA
│     ├─ auth.js               # OAuth2, sessions, guild access
│     ├─ api.js                # REST API
│     └─ http.js               # headers, cookies, rate limits, errors
├─ web/                        # React + Vite dashboard
│  ├─ src/
│  │  ├─ App.jsx / pages/      # 13 pages + login
│  │  ├─ components/           # preview, charts, primitives
│  │  ├─ styles.css            # dark design system
│  │  └─ api.js / data.js / hooks.js
│  └─ vite.config.js
├─ scripts/
│  ├─ deploy-commands.js
│  └─ seed-dev.js
├─ tests/                      # node:test suite
├─ data/                       # SQLite, uploads, fonts, logs (gitignored)
├─ public/                     # built dashboard (gitignored)
├─ .env.example
└─ README.md
```

---

## 22. Testing and verification

```bash
npm test
```

The suite (60 tests) covers:

- Placeholder resolution and safe fallbacks.
- Validation (channels, colours, URLs, DM button restrictions, limits, path traversal).
- Every Components V2 style serializing to a valid container.
- Mention scoping, button chunking, internal vs link actions.
- Database CRUD, guild isolation, member numbering, returning members, statistics.
- Invite counter diffing, ambiguity, largest-delta choice, vanity fallback, fetch failures.
- PNG generation, custom dimensions, uploaded backgrounds, all eight styles.
- Slash command definitions and option validity.
- End-to-end delivery to a fake Discord channel, DM delivery, dry-run, bot/returning skips and leave messages.

Manual verification checklist for a real Discord server:

1. `npm run build`, `npm start`, invite the bot, set `DISCORD_GUILD_ID` for instant commands.
2. Run `/welcome setup #welcome` and `/welcome preview`.
3. Join with an alternate account and verify the message, banner, buttons, auto role, log entry and invite attribution.
4. Open the dashboard, edit the title and watch the live preview, then save and run `/welcome preview`.
5. Test each button: rules panel, self-role picker, introductions link, ticket thread.
6. Enable a DM and join again; verify delivery, then close DMs and verify the logged failure.
7. Leave the server and verify the leave message and logs.
8. Use **Advanced → Danger zone** on a staging guild only.

Real Discord API calls (actual sends, OAuth, role assignment, invite fetch) require a bot token and a live guild; they cannot be exercised in an offline test environment. The automated suite validates everything up to the Discord boundary and the exact Components V2 payloads.

---

## Credits

**Aurora Welcome** — designed and developed by **Karim Kaddachi**.

Built with discord.js, Express, React, Vite, SQLite (`node:sqlite`) and `@napi-rs/canvas`.

Components V2 only. No embeds.
