import { GoogleTaskItem, GoogleTaskList } from '../types';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string; expires_in?: number }) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
          revoke: (token: string, done: () => void) => void;
        };
      };
    };
  }
}

const TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks';
const BASE_URL = 'https://tasks.googleapis.com/tasks/v1';

const STORAGE_TOKEN_KEY = 'lol_google_tasks_token';
const STORAGE_EXPIRY_KEY = 'lol_google_tasks_expiry';

export function getStoredAccessToken(): string | null {
  const token = sessionStorage.getItem(STORAGE_TOKEN_KEY);
  const expiry = sessionStorage.getItem(STORAGE_EXPIRY_KEY);
  if (!token || !expiry) return null;
  if (Date.now() > Number(expiry)) {
    sessionStorage.removeItem(STORAGE_TOKEN_KEY);
    sessionStorage.removeItem(STORAGE_EXPIRY_KEY);
    return null;
  }
  return token;
}

export function storeAccessToken(token: string, expiresInSeconds = 3500) {
  sessionStorage.setItem(STORAGE_TOKEN_KEY, token);
  sessionStorage.setItem(STORAGE_EXPIRY_KEY, String(Date.now() + expiresInSeconds * 1000));
}

export function clearStoredAccessToken() {
  sessionStorage.removeItem(STORAGE_TOKEN_KEY);
  sessionStorage.removeItem(STORAGE_EXPIRY_KEY);
}

export function requestGoogleTasksToken(promptMode: '' | 'consent' = ''): Promise<string> {
  return new Promise((resolve, reject) => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      reject(new Error('Google Client ID (VITE_GOOGLE_CLIENT_ID) is not configured.'));
      return;
    }
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services script is still loading. Try again in a moment.'));
      return;
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: TASKS_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error || 'Failed to acquire Google Tasks token.'));
          return;
        }
        storeAccessToken(response.access_token, response.expires_in || 3500);
        resolve(response.access_token);
      },
    });

    client.requestAccessToken({ prompt: promptMode });
  });
}

async function fetchTasksApi<T>(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    clearStoredAccessToken();
    throw new Error('SESSION_EXPIRED');
  }

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Google Tasks API Error (${res.status}): ${errBody}`);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

export async function listTaskLists(token: string): Promise<GoogleTaskList[]> {
  const data = await fetchTasksApi<{ items?: GoogleTaskList[] }>('/users/@me/lists', token);
  return data.items || [];
}

export async function createTaskList(token: string, title: string): Promise<GoogleTaskList> {
  return fetchTasksApi<GoogleTaskList>('/users/@me/lists', token, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export async function ensureLolTaskList(token: string): Promise<GoogleTaskList> {
  const lists = await listTaskLists(token);
  const existing = lists.find(
    (l) =>
      l.title.toLowerCase().includes('lehenga on lease') ||
      l.title.toLowerCase().includes('lol rentals')
  );
  if (existing) return existing;
  return createTaskList(token, 'LOL: Lehenga On Lease Rentals 🧡');
}

export async function listTasks(token: string, tasklistId = '@default'): Promise<GoogleTaskItem[]> {
  const data = await fetchTasksApi<{ items?: GoogleTaskItem[] }>(
    `/lists/${encodeURIComponent(tasklistId)}/tasks?showCompleted=true&showHidden=true`,
    token
  );
  return (data.items || []).filter((t) => t.title && t.title.trim().length > 0);
}

export async function createTask(
  token: string,
  tasklistId: string,
  task: { title: string; notes?: string; due?: string }
): Promise<GoogleTaskItem> {
  const payload: Record<string, string> = {
    title: task.title,
  };
  if (task.notes) payload.notes = task.notes;
  if (task.due) {
    // RFC 3339 timestamp required by Google Tasks API
    payload.due = task.due.includes('T') ? task.due : `${task.due}T12:00:00.000Z`;
  }

  return fetchTasksApi<GoogleTaskItem>(`/lists/${encodeURIComponent(tasklistId)}/tasks`, token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function toggleTaskStatus(
  token: string,
  tasklistId: string,
  taskId: string,
  completed: boolean
): Promise<GoogleTaskItem> {
  return fetchTasksApi<GoogleTaskItem>(
    `/lists/${encodeURIComponent(tasklistId)}/tasks/${encodeURIComponent(taskId)}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status: completed ? 'completed' : 'needsAction',
        completed: completed ? new Date().toISOString() : null,
      }),
    }
  );
}

export async function deleteTask(
  token: string,
  tasklistId: string,
  taskId: string
): Promise<void> {
  await fetchTasksApi<void>(
    `/lists/${encodeURIComponent(tasklistId)}/tasks/${encodeURIComponent(taskId)}`,
    token,
    {
      method: 'DELETE',
    }
  );
}
