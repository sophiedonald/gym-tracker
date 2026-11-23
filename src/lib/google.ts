import { google } from "googleapis";

export const TIME_ZONE = "Europe/London";

export function getCalendar() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const key = process.env.GOOGLE_PRIVATE_KEY?.trim()
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n");
  if (!email || !key || !calendarId) return null;

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  });
  return { calendar: google.calendar({ version: "v3", auth }), calendarId };
}

export const NOT_CONFIGURED = {
  error:
    "Google Calendar is not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY and GOOGLE_CALENDAR_ID.",
};

// Pure UTC date arithmetic on YYYY-MM-DD strings.
export function shiftIso(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function londonDate(instant: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
}

export function errMessage(e: unknown) {
  return e instanceof Error ? e.message : "unknown error";
}
