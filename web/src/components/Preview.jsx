import { useEffect, useRef, useState } from 'react';
import { ImageIcon, RefreshCw } from 'lucide-react';
import { apiPost, fetchImagePreview } from '../api.js';
import { useDebounced } from '../hooks.js';

export function useMessagePreview(guildId, { config, kind = 'welcome', sample = null, active = true, delay = 450, refreshKey = 0 }) {
  const configKey = config ? JSON.stringify(config) : '';
  const sampleKey = sample ? JSON.stringify(sample) : '';
  const debouncedKey = useDebounced(configKey, delay);
  const configRef = useRef(config);
  const sampleRef = useRef(sample);
  configRef.current = config;
  sampleRef.current = sample;
  const [state, setState] = useState({ model: null, loading: false, error: null });

  useEffect(() => {
    if (!active || !debouncedKey) return undefined;
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: null }));
    apiPost(
      `/guilds/${guildId}/preview/message`,
      { kind, config: configRef.current, sample: sampleRef.current || undefined },
      { signal: controller.signal },
    )
      .then((result) => setState({ model: result.model, loading: false, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError' || error.status === 401) return;
        setState({ model: null, loading: false, error });
      });
    return () => controller.abort();
  }, [guildId, kind, debouncedKey, sampleKey, active, refreshKey]);

  return state;
}

export function ImagePreview({ guildId, config, kind = 'welcome', active = true, label = 'Generated banner', refreshKey = 0 }) {
  const configKey = config ? JSON.stringify(config) : '';
  const debounced = useDebounced(configKey, 900);
  const configRef = useRef(config);
  configRef.current = config;
  const [state, setState] = useState({ url: null, loading: false, error: null, dims: null });
  const urlRef = useRef(null);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!active) {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      setState({ url: null, loading: false, error: null, dims: null });
      return undefined;
    }
    if (!debounced) return undefined;
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: null }));
    fetchImagePreview(guildId, { kind, config: configRef.current }, controller.signal)
      .then((blob) => {
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        const image = new Image();
        image.onload = () => setState({ url, loading: false, error: null, dims: { width: image.width, height: image.height } });
        image.onerror = () => setState({ url, loading: false, error: null, dims: null });
        image.src = url;
      })
      .catch((error) => {
        if (error.name === 'AbortError' || error.status === 401) return;
        setState({ url: null, loading: false, error, dims: null });
      });
    return () => controller.abort();
  }, [guildId, kind, debounced, active, refreshKey]);

  return (
    <div className="image-preview">
      <div className="image-preview-head">
        <span className="image-preview-title">
          <ImageIcon size={14} /> {label}
        </span>
        {state.loading ? <span className="image-status">Rendering…</span> : null}
        {!state.loading && state.dims ? (
          <span className="image-status">
            {state.dims.width} × {state.dims.height}
          </span>
        ) : null}
      </div>
      <div className="image-stage">
        {state.url ? <img src={state.url} alt={label} /> : null}
        {!state.url && !state.loading ? (
          <div className="image-empty">
            <ImageIcon size={22} />
            <span>{active ? state.error?.message || 'Banner preview will appear here.' : 'Banner preview is disabled.'}</span>
            {state.error ? <RefreshCw size={14} /> : null}
          </div>
        ) : null}
        {state.loading ? <div className="image-loading" /> : null}
      </div>
    </div>
  );
}
