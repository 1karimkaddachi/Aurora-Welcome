import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RefreshCw, ScrollText, Trash2 } from 'lucide-react';
import { apiDelete } from '../api.js';
import { useApi } from '../hooks.js';
import { formatDateTime, timeAgo } from '../data.js';
import { CATEGORY_META } from '../components/Activity.jsx';
import {
  Badge,
  Button,
  Card,
  ConfirmModal,
  EmptyState,
  PageHeader,
  Skeleton,
} from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';

const CATEGORIES = ['all', 'member', 'welcome', 'dm', 'autorole', 'invite', 'image', 'config', 'system', 'leave'];

export default function Logs() {
  const { guildId } = useParams();
  const toast = useToast();
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const api = useApi(`/guilds/${guildId}/logs?category=${category}&page=${page}&limit=40`);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [category]);

  const data = api.data;
  const logs = data?.logs || [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const clear = async () => {
    setClearing(true);
    try {
      await apiDelete(`/guilds/${guildId}/logs`);
      toast.success('Logs cleared.');
      setClearOpen(false);
      api.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Audit trail"
        title="Logs"
        description="Every join, welcome, DM, role assignment, invite attribution and configuration change."
        actions={
          <>
            <Button icon={RefreshCw} onClick={api.reload}>Refresh</Button>
            <Button variant="danger" icon={Trash2} onClick={() => setClearOpen(true)}>Clear logs</Button>
          </>
        }
      />

      <div className="filter-row">
        {CATEGORIES.map((value) => {
          const meta = CATEGORY_META[value];
          return (
            <button
              key={value}
              type="button"
              className={category === value ? 'filter-chip active' : 'filter-chip'}
              onClick={() => setCategory(value)}
            >
              {meta ? <meta.icon size={13} /> : <ScrollText size={13} />}
              {value === 'all' ? 'All activity' : meta?.label || value}
            </button>
          );
        })}
        <span className="filter-meta">{data ? `${data.total} entries` : 'Loading…'}</span>
      </div>

      <Card
        title={category === 'all' ? 'All activity' : CATEGORY_META[category]?.label || category}
        subtitle={data ? `Page ${data.page} of ${totalPages}` : 'Fetching audit entries'}
        actions={<Badge tone="info">{logs.length} shown</Badge>}
        flush
      >
        {api.loading && !data ? (
          <div className="loading-block" style={{ padding: 22 }}>
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} height={52} />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No log entries"
            description={category === 'all' ? 'Activity will be recorded as members join and the bot operates.' : 'No entries in this category yet.'}
          />
        ) : (
          <div className="log-table">
            {logs.map((log) => {
              const meta = CATEGORY_META[log.category] || CATEGORY_META.system;
              const Icon = meta.icon;
              return (
                <article key={log.id} className="log-entry">
                  <span className="log-entry-icon" style={{ color: meta.color, background: `${meta.color}18` }}>
                    <Icon size={17} />
                  </span>
                  <div className="log-entry-body">
                    <div className="log-entry-head">
                      <strong>{String(log.action || '').replace(/_/g, ' ')}</strong>
                      <Badge tone="neutral">{meta.label}</Badge>
                      {log.userId ? <code className="code-pill">{log.userId}</code> : null}
                      <span className="log-entry-time" title={formatDateTime(log.createdAt)}>
                        {timeAgo(log.createdAt)}
                      </span>
                    </div>
                    <p>{log.message}</p>
                    {log.meta ? (
                      <details className="log-meta">
                        <summary>Metadata</summary>
                        <pre>{JSON.stringify(log.meta, null, 2)}</pre>
                      </details>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <div className="pagination">
          <Button size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            Previous
          </Button>
          <span className="pagination-label">Page {page} / {totalPages}</span>
          <Button size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
            Next <ChevronRight size={14} />
          </Button>
        </div>
      </Card>

      <ConfirmModal
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={clear}
        loading={clearing}
        title="Clear all logs?"
        message="Every audit entry for this community will be permanently deleted. A single “logs cleared” entry is written afterwards."
        confirmLabel="Clear logs"
      />
    </div>
  );
}
