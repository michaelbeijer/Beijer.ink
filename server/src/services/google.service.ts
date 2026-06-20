import { google } from 'googleapis';
import type { Credentials } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';

// Read-only Google Calendar overlay (issue #2). Google events are an external
// layer — fetched live, normalised, and merged into the calendar UI; they are
// NEVER written into the `cards` table.

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

// Fallback colours if a calendar has none / isn't yet configured.
const PALETTE = [
  '#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ec4899',
  '#0ea5e9', '#84cc16', '#ef4444', '#eab308', '#14b8a6',
];

export interface CalendarSource {
  calendarId: string;
  name: string;
  color: string;
  enabled: boolean;
}

export interface ExternalEvent {
  id: string;
  calendarId: string;
  source: string;        // == calendarId; the source key the UI colours/filters by
  title: string;
  start: string;         // ISO
  end: string | null;    // ISO
  allDay: boolean;
  color: string;
  htmlLink?: string;
}

/** Whether the server has Google OAuth credentials configured at all. */
export function isConfigured(): boolean {
  return Boolean(config.googleClientId && config.googleClientSecret);
}

function oauthClient() {
  return new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri,
  );
}

/** Build the Google consent URL. State carries a short-lived signed userId
 *  (CSRF protection + lets the public callback know who connected). */
export function getAuthUrl(userId: string): string {
  const state = jwt.sign({ userId }, config.jwtSecret, { expiresIn: '10m' });
  return oauthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',       // force a refresh_token every time
    scope: SCOPES,
    state,
  });
}

export function verifyState(state: string): string {
  const decoded = jwt.verify(state, config.jwtSecret) as { userId: string };
  return decoded.userId;
}

/** Exchange the OAuth code for tokens and persist them. */
export async function handleCallback(userId: string, code: string): Promise<void> {
  const { tokens } = await oauthClient().getToken(code);
  await prisma.googleCalendarConnection.upsert({
    where: { userId },
    create: {
      userId,
      accessToken: tokens.access_token ?? null,
      refreshToken: tokens.refresh_token ?? null,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scope: tokens.scope ?? null,
      connectedAt: new Date(),
    },
    update: {
      accessToken: tokens.access_token ?? undefined,
      // keep the existing refresh token if Google didn't return a new one
      refreshToken: tokens.refresh_token ?? undefined,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scope: tokens.scope ?? undefined,
      connectedAt: new Date(),
    },
  });
}

async function getStoredCalendars(userId: string): Promise<CalendarSource[]> {
  const conn = await prisma.googleCalendarConnection.findUnique({ where: { userId } });
  return ((conn?.calendars as unknown) as CalendarSource[]) ?? [];
}

/** An OAuth2 client primed with the stored tokens; auto-refreshes and persists
 *  refreshed tokens. Returns null when not connected. */
async function authorizedClient(userId: string) {
  const conn = await prisma.googleCalendarConnection.findUnique({ where: { userId } });
  if (!conn || (!conn.refreshToken && !conn.accessToken)) return null;
  const client = oauthClient();
  client.setCredentials({
    access_token: conn.accessToken ?? undefined,
    refresh_token: conn.refreshToken ?? undefined,
    expiry_date: conn.tokenExpiry ? conn.tokenExpiry.getTime() : undefined,
  });
  client.on('tokens', (t: Credentials) => {
    prisma.googleCalendarConnection
      .update({
        where: { userId },
        data: {
          accessToken: t.access_token ?? undefined,
          refreshToken: t.refresh_token ?? undefined,
          tokenExpiry: t.expiry_date ? new Date(t.expiry_date) : undefined,
        },
      })
      .catch(() => { /* best-effort token persistence */ });
  });
  return client;
}

export async function getStatus(userId: string) {
  const conn = await prisma.googleCalendarConnection.findUnique({ where: { userId } });
  return {
    configured: isConfigured(),
    connected: Boolean(conn?.refreshToken || conn?.accessToken),
    calendars: ((conn?.calendars as unknown) as CalendarSource[]) ?? [],
  };
}

/** Every calendar on the account, merged with any saved name/colour/enabled. */
export async function listCalendars(userId: string): Promise<CalendarSource[]> {
  const client = await authorizedClient(userId);
  if (!client) return [];
  const cal = google.calendar({ version: 'v3', auth: client });
  const res = await cal.calendarList.list({ maxResults: 250 });
  const stored = new Map((await getStoredCalendars(userId)).map((s) => [s.calendarId, s]));
  return (res.data.items ?? [])
    .filter((c) => c.id)
    .map((c, i) => {
      const existing = stored.get(c.id!);
      return {
        calendarId: c.id!,
        name: existing?.name ?? c.summaryOverride ?? c.summary ?? c.id!,
        color: existing?.color ?? c.backgroundColor ?? PALETTE[i % PALETTE.length],
        enabled: existing?.enabled ?? false,
      };
    });
}

export async function saveCalendars(userId: string, calendars: CalendarSource[]): Promise<void> {
  await prisma.googleCalendarConnection.update({
    where: { userId },
    data: { calendars: calendars as unknown as object },
  });
}

/** Read-only events from the enabled calendars within [from, to]. */
export async function getEvents(userId: string, from?: string, to?: string): Promise<ExternalEvent[]> {
  const client = await authorizedClient(userId);
  if (!client) return [];
  const enabled = (await getStoredCalendars(userId)).filter((c) => c.enabled);
  if (enabled.length === 0) return [];

  const cal = google.calendar({ version: 'v3', auth: client });
  const timeMin = (from ? new Date(from) : new Date(Date.now() - 30 * 864e5)).toISOString();
  const timeMax = (to ? new Date(to) : new Date(Date.now() + 120 * 864e5)).toISOString();

  const out: ExternalEvent[] = [];
  for (const c of enabled) {
    try {
      const res = await cal.events.list({
        calendarId: c.calendarId,
        timeMin,
        timeMax,
        singleEvents: true,      // expand recurrences into individual events
        orderBy: 'startTime',
        maxResults: 2500,
      });
      for (const ev of res.data.items ?? []) {
        const startRaw = ev.start?.dateTime ?? ev.start?.date;
        if (!startRaw) continue;
        const endRaw = ev.end?.dateTime ?? ev.end?.date ?? null;
        out.push({
          id: ev.id ?? `${c.calendarId}:${startRaw}`,
          calendarId: c.calendarId,
          source: c.calendarId,
          title: ev.summary ?? '(no title)',
          start: new Date(startRaw).toISOString(),
          end: endRaw ? new Date(endRaw).toISOString() : null,
          allDay: Boolean(ev.start?.date && !ev.start?.dateTime),
          color: c.color,
          htmlLink: ev.htmlLink ?? undefined,
        });
      }
    } catch {
      // A single calendar failing (revoked share, etc.) must not break the rest.
    }
  }
  return out;
}

export async function disconnect(userId: string): Promise<void> {
  await prisma.googleCalendarConnection.deleteMany({ where: { userId } });
}
