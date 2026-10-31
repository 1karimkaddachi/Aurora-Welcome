import {
  Activity,
  Image as ImageIcon,
  Link2,
  Mail,
  ScrollText,
  ShieldCheck,
  Sparkles,
  UserMinus,
  UserPlus,
  Wrench,
} from 'lucide-react';
import { timeAgo } from '../data.js';

export const CATEGORY_META = {
  member: { icon: UserPlus, color: '#22d3ee', label: 'Member' },
  welcome: { icon: Sparkles, color: '#818cf8', label: 'Welcome' },
  leave: { icon: UserMinus, color: '#fb7185', label: 'Leave' },
  dm: { icon: Mail, color: '#a855f7', label: 'Direct message' },
  autorole: { icon: ShieldCheck, color: '#34d399', label: 'Auto role' },
  invite: { icon: Link2, color: '#fbbf24', label: 'Invites' },
  image: { icon: ImageIcon, color: '#f472b6', label: 'Image' },
  config: { icon: Wrench, color: '#94a3b8', label: 'Configuration' },
  system: { icon: Activity, color: '#64748b', label: 'System' },
};

export function LogItem({ log, showCategory = true }) {
  const meta = CATEGORY_META[log.category] || CATEGORY_META.system;
  const Icon = meta.icon;
  return (
    <div className="log-item">
      <span className="log-icon" style={{ color: meta.color, background: `${meta.color}18` }}>
        <Icon size={15} />
      </span>
      <div className="log-body">
        <div className="log-top">
          <strong>{String(log.action || '').replace(/_/g, ' ')}</strong>
          {showCategory ? <span className="log-category">{meta.label}</span> : null}
          <span className="log-time">{timeAgo(log.createdAt)}</span>
        </div>
        <p>{log.message}</p>
        {log.userId ? <span className="log-user">User ID · {log.userId}</span> : null}
      </div>
    </div>
  );
}

export { ScrollText };
