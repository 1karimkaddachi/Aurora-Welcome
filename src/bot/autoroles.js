import { logEvent } from './audit.js';
import { listAutoRoles } from '../db/repositories.js';

/**
 * Applies auto roles with hierarchy validation, per-role delays and audit
 * logging. Never throws into the member-join handler.
 */
export async function applyAutoRoles(client, member) {
  const guild = member.guild;
  const roles = listAutoRoles(guild.id).filter((role) => role.enabled);
  if (roles.length === 0) return [];

  const isBot = Boolean(member.user?.bot);
  let me = guild.members.me;
  if (!me) {
    try {
      me = await guild.members.fetchMe();
    } catch {
      me = null;
    }
  }
  if (!me) {
    await logEvent(client, guild.id, 'autorole', 'failed', 'Auto roles skipped because the bot member is unavailable.', {
      userId: member.id,
    });
    return [];
  }
  const botHighest = me.roles.highest.position;
  const results = [];

  for (const entry of roles) {
    if (entry.target === 'human' && isBot) continue;
    if (entry.target === 'bot' && !isBot) continue;
    if (member.id === guild.ownerId) continue;

    const role = guild.roles.cache.get(entry.roleId) || (await guild.roles.fetch(entry.roleId).catch(() => null));
    if (!role) {
      await logEvent(client, guild.id, 'autorole', 'failed', `Role ${entry.roleId} no longer exists.`, {
        userId: member.id,
        meta: { roleId: entry.roleId },
      });
      results.push({ roleId: entry.roleId, ok: false, reason: 'missing_role' });
      continue;
    }
    if (role.managed) {
      await logEvent(client, guild.id, 'autorole', 'failed', `Role @${role.name} is managed by an integration.`, {
        userId: member.id,
        meta: { roleId: role.id },
      });
      results.push({ roleId: role.id, ok: false, reason: 'managed_role' });
      continue;
    }
    if (role.position >= botHighest) {
      await logEvent(client, guild.id, 'autorole', 'failed', `Role @${role.name} is above the bot's highest role.`, {
        userId: member.id,
        meta: { roleId: role.id },
      });
      results.push({ roleId: role.id, ok: false, reason: 'hierarchy' });
      continue;
    }

    const assign = async () => {
      try {
        const fresh = await guild.members.fetch(member.id).catch(() => null);
        if (!fresh) return;
        await fresh.roles.add(role, 'Aurora auto role');
        await logEvent(client, guild.id, 'autorole', 'assigned', `Assigned @${role.name} to @${member.user.username}.`, {
          userId: member.id,
          meta: { roleId: role.id },
        });
      } catch (error) {
        await logEvent(client, guild.id, 'autorole', 'failed', `Could not assign @${role.name}: ${error.message}`, {
          userId: member.id,
          meta: { roleId: role.id, code: error.code },
        });
      }
    };

    if (entry.delaySeconds > 0) {
      const timer = setTimeout(assign, entry.delaySeconds * 1000);
      timer.unref?.();
      results.push({ roleId: role.id, ok: true, scheduled: true });
    } else {
      await assign();
      await new Promise((resolve) => setTimeout(resolve, 250));
      results.push({ roleId: role.id, ok: true });
    }
  }
  return results;
}
