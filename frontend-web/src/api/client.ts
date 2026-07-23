const API = import.meta.env.VITE_API_URL || '';

export async function apiCall<T = unknown>(
  path: string,
  token: string | null,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const res = await fetch(`${API}${path}`, { ...options, headers });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return res.json();
  }
  
  return res.text() as unknown as T;
}

export function wsUrl(token: string) {
  const base = (import.meta.env.VITE_API_URL || '').replace(/^http/, 'ws');
  return `${base}/api/ws?token=${encodeURIComponent(token)}`;
}
