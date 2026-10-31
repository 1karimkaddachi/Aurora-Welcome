import { useEffect, useState } from 'react';
import { apiGet } from './api.js';
import { useApi } from './hooks.js';

let metaPromise = null;

export function useMeta() {
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!metaPromise) {
      metaPromise = apiGet('/meta').catch((err) => {
        metaPromise = null;
        throw err;
      });
    }
    let cancelled = false;
    metaPromise
      .then((value) => !cancelled && setMeta(value))
      .catch((err) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, []);
  return { meta, error };
}

export function useChannels(guildId) {
  const { data, loading, error } = useApi(`/guilds/${guildId}/channels`);
  return { channels: data?.channels || [], online: Boolean(data?.online), loading, error };
}

export function useRoles(guildId) {
  const { data, loading, error } = useApi(`/guilds/${guildId}/roles`);
  return { roles: data?.roles || [], online: Boolean(data?.online), loading, error };
}

export function useConfigDraft(path) {
  const api = useApi(path);
  const [draft, setDraft] = useState(null);
  const [original, setOriginal] = useState(null);

  useEffect(() => {
    if (api.data) {
      const clone = structuredClone(api.data);
      setDraft(clone);
      setOriginal(structuredClone(clone));
    }
  }, [api.data]);

  const dirty = Boolean(draft && original && JSON.stringify(draft) !== JSON.stringify(original));

  const commit = (saved) => {
    const next = saved ? structuredClone(saved) : structuredClone(draft);
    setDraft(next);
    setOriginal(structuredClone(next));
    if (saved) api.setData(saved);
  };

  const reset = () => {
    if (original) setDraft(structuredClone(original));
  };

  return { ...api, draft, setDraft, original, dirty, commit, reset };
}

export function patchIn(object, path, value) {
  const next = structuredClone(object);
  let cursor = next;
  for (let index = 0; index < path.length - 1; index += 1) {
    cursor = cursor[path[index]];
  }
  cursor[path[path.length - 1]] = value;
  return next;
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value) || 0);
}

export function formatDate(value, options = {}) {
  if (!value) return '—';
  const dateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(dateOnly ? { timeZone: 'UTC' } : {}),
    ...options,
  }).format(new Date(dateOnly ? `${value}T00:00:00Z` : value));
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function timeAgo(value) {
  if (!value) return '—';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

export function initials(value) {
  return String(value || 'A')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function accentForStyle(styles, styleId, fallback = '#6366F1') {
  return styles?.find((style) => style.id === styleId)?.accent || fallback;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}
