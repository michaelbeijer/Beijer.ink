import api from './client';
import type { Notebook } from '../types/notebook';

export async function getNotebooks(): Promise<Notebook[]> {
  const { data } = await api.get<Notebook[]>('/notebooks');
  return data;
}

export async function createNotebook(body: { name: string; parentId?: string }): Promise<Notebook> {
  const { data } = await api.post<Notebook>('/notebooks', body);
  return data;
}

export async function updateNotebook(id: string, body: Partial<Notebook>): Promise<Notebook> {
  const { data } = await api.patch<Notebook>(`/notebooks/${id}`, body);
  return data;
}

export async function deleteNotebook(id: string): Promise<void> {
  await api.delete(`/notebooks/${id}`);
}

// "Publish now" — pokes the Cloudflare deploy hook so autofingers.com rebuilds.
export async function publishAutofingers(): Promise<{ triggered: boolean; status?: number }> {
  const { data } = await api.post<{ triggered: boolean; status?: number }>('/publish/trigger');
  return data;
}
