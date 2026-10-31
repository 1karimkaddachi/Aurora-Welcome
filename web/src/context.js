import { createContext, useContext } from 'react';
import { useParams } from 'react-router-dom';

export const AppContext = createContext(null);

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppContext');
  return context;
}

export function useActiveGuild() {
  const { me } = useApp();
  const { guildId } = useParams();
  return me?.guilds?.find((guild) => guild.id === guildId) || null;
}
