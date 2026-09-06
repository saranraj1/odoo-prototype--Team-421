import { API_BASE_URL } from '@/lib/constants';
import type { ApiErrorEnvelope } from './types';

export class ApiClientError extends Error {
  code: string;
  status: number;
  details?: any;

  constructor(status: number, envelope: ApiErrorEnvelope) {
    super(envelope.error.message || 'API request failed');
    this.name = 'ApiClientError';
    this.status = status;
    this.code = envelope.error.code || 'UNKNOWN_ERROR';
    this.details = envelope.error.details;
  }
}

export async function apiClient<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const isPortal = path.startsWith('/portal');
  const tokenKey = isPortal ? 'dealflow_portal_token' : 'dealflow_auth_token';
  const token = sessionStorage.getItem(tokenKey);

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorEnvelope: ApiErrorEnvelope;
    try {
      const errJson = await response.json();
      errorEnvelope = {
        error: {
          code: errJson?.error?.code || errJson?.code || `HTTP_${response.status}`,
          message:
            errJson?.error?.message ||
            errJson?.detail ||
            errJson?.message ||
            response.statusText ||
            'Unexpected server error',
          details: errJson?.error?.details || errJson?.details,
        },
      };
    } catch {
      errorEnvelope = {
        error: {
          code: `HTTP_${response.status}`,
          message: response.statusText || 'Unexpected server error',
        },
      };
    }

    // Only redirect to login if this was not an explicit login attempt
    if (response.status === 401 && !path.includes('/auth/login') && !path.includes('/portal/auth/login')) {
      sessionStorage.removeItem(tokenKey);
      window.location.href = '/login';
    }

    throw new ApiClientError(response.status, errorEnvelope);
  }

  if (response.status === 204) {
    return {} as T;
  }

  // Handle blob responses (e.g. for PDF/Excel report downloads)
  const contentType = response.headers.get('Content-Type');
  if (
    contentType &&
    (contentType.includes('application/pdf') ||
      contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
      contentType.includes('application/octet-stream'))
  ) {
    return (await response.blob()) as unknown as T;
  }

  const resJson = await response.json();
  // DealFlow360 API wraps standard responses in { data: ... }
  if (resJson && typeof resJson === 'object' && 'data' in resJson) {
    return resJson.data as T;
  }
  return resJson as T;
}
