import { Events } from 'discord.js';
import { removeCachedInvite, updateCachedInvite } from '../../invites/tracker.js';

export function attachInviteEvents(client) {
  client.on(Events.InviteCreate, (invite) => {
    try {
      updateCachedInvite(invite);
    } catch {
      /* cache failures should not crash the client */
    }
  });
  client.on(Events.InviteDelete, (invite) => {
    try {
      removeCachedInvite(invite);
    } catch {
      /* ignore */
    }
  });
}
