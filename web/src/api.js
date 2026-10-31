export async function apiFetch(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });
  const type = response.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    const error = new Error(data?.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.field = data?.field;
    throw error;
  }
  return data;
}

export const apiGet = (path, options) => apiFetch(path, options);
export const apiPost = (path, body, options = {}) => apiFetch(path, { ...options, method: 'POST', body });
export const apiPut = (path, body, options = {}) => apiFetch(path, { ...options, method: 'PUT', body });
export const apiDelete = (path, options = {}) => apiFetch(path, { ...options, method: 'DELETE' });

export async function uploadImage(guildId, file) {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(`/api/guilds/${guildId}/uploads`, {
    method: 'POST',
    credentials: 'same-origin',
    body: form,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'Upload failed.');
  return data;
}

export async function devLogin() {
  const response = await fetch('/auth/dev', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || 'Developer sign-in failed.');
  }
}

export async function logout() {
  await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' });
}

export async function fetchImagePreview(guildId, body, signal) {
  const response = await fetch(`/api/guilds/${guildId}/preview/image`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || 'Could not generate the banner.');
  }
  return response.blob();
}

export function errorMessage(error) {
  if (!error) return 'Something went wrong.';
  if (error.status === 401) return 'Your session expired. Please sign in again.';
  return error.message || 'Something went wrong.';
}
