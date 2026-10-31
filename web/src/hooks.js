import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet } from './api.js';

export function useDebounced(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useApi(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);
  const mounted = useRef(true);
  const lastPath = useRef(path);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!path) return undefined;
    if (lastPath.current !== path) {
      lastPath.current = path;
      setData(null);
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    apiGet(path, { signal: controller.signal })
      .then((result) => {
        if (mounted.current) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        if (mounted.current) {
          setError(err);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [path, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { data, setData, loading, error, reload };
}

export function useMountedRef() {
  const ref = useRef(true);
  useEffect(() => {
    ref.current = true;
    return () => {
      ref.current = false;
    };
  }, []);
  return ref;
}

export function classNames(...values) {
  return values.filter(Boolean).join(' ');
}
