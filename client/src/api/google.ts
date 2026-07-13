import api from './client';

export interface GoogleCalendarSource {
  calendarId: string;
  name: string;
  color: string;
  enabled: boolean;
}

export interface GoogleEvent {
  id: string;
  calendarId: string;
  source: string;
  title: string;
  start: string;        // ISO
  end: string | null;   // ISO
  allDay: boolean;
  color: string;
  htmlLink?: string;
}

export interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  tasksScope: boolean; // granted scopes include Google Tasks (needed for to-do sync)
  calendars: GoogleCalendarSource[];
}

export interface GoogleTaskList {
  id: string;
  title: string;
}

export async function getGoogleTaskLists(): Promise<GoogleTaskList[]> {
  const { data } = await api.get<GoogleTaskList[]>('/google/task-lists');
  return data;
}

export async function getGoogleStatus(): Promise<GoogleStatus> {
  const { data } = await api.get<GoogleStatus>('/google/status');
  return data;
}

export async function getGoogleConnectUrl(): Promise<string> {
  const { data } = await api.get<{ url: string }>('/google/connect');
  return data.url;
}

export async function listGoogleCalendars(): Promise<GoogleCalendarSource[]> {
  const { data } = await api.get<GoogleCalendarSource[]>('/google/calendars');
  return data;
}

export async function saveGoogleCalendars(calendars: GoogleCalendarSource[]): Promise<void> {
  await api.put('/google/calendars', { calendars });
}

export async function getGoogleEvents(from?: string, to?: string): Promise<GoogleEvent[]> {
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  const { data } = await api.get<GoogleEvent[]>(`/google/events${qs.toString() ? `?${qs}` : ''}`);
  return data;
}

export async function disconnectGoogle(): Promise<void> {
  await api.post('/google/disconnect');
}
