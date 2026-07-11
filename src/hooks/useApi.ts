import useSWR from 'swr';

const fetcher = (url: string, token: string) => fetch(url, {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => {
  if (!r.ok) return r.json().then(e => Promise.reject(e.error || e));
  return r.json();
});

export function useApi<T>(action: string | null, token: string = '') {
  const { data, error, isLoading, mutate } = useSWR<T>(
    action ? [`/api/admin?action=${action}`, token] : null,
    ([url, tok]) => fetcher(url, tok || ''),
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  );
  return { data, error, isLoading, mutate };
}

export function useApiWithParams<T>(action: string, params: Record<string, string>, token: string = '') {
  const query = new URLSearchParams({ action, ...params }).toString();
  const { data, error, isLoading, mutate } = useSWR<T>(
    [`/api/admin?${query}`, token],
    ([url, tok]) => fetcher(url, tok || ''),
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  );
  return { data, error, isLoading, mutate };
}

export function useDirectApiFetch() {
  return async (url: string, token: string = '', options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || error.message || 'Request failed');
    }
    return res.json();
  };
}
