import { activityLabel, isActivityKey, type ActivityKey } from "@/lib/activities";
import { errMessage, getCalendar, NOT_CONFIGURED, shiftIso, TIME_ZONE, londonDate } from "@/lib/google";

type Item = { activity: ActivityKey; time: string; duration: number; location: string };
type Day = { date: string; activities: Item[] };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function parseDays(body: unknown): Day[] | null {
  const raw = (body as { days?: unknown })?.days;
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const days: Day[] = [];
  for (const d of raw) {
    if (typeof d?.date !== "string" || !DATE_RE.test(d.date) || !Array.isArray(d.activities)) {
      return null;
    }
    const activities: Item[] = [];
    for (const a of d.activities) {
      const duration = Number(a?.duration);
      if (
        !isActivityKey(a?.activity) ||
        typeof a.time !== "string" ||
        !TIME_RE.test(a.time) ||
        !Number.isFinite(duration) ||
        duration < 1 ||
        duration > 1440
      ) {
        return null;
      }
      const id = `${d.date}|${a.activity}`;
      if (seen.has(id)) continue;
      seen.add(id);
      activities.push({
        activity: a.activity,
        time: a.time,
        duration: Math.round(duration),
        location: String(a.location ?? "").slice(0, 300),
      });
    }
    days.push({ date: d.date, activities });
  }
  return days;
}

// Local wall-clock end time computed without timezone conversions.
function endLocal(date: string, time: string, minutes: number) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm + minutes)).toISOString().slice(0, 19);
}

export async function POST(request: Request) {
  const cal = getCalendar();
  if (!cal) return Response.json(NOT_CONFIGURED, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const days = parseDays(body);
  if (!days) return Response.json({ error: "Invalid plan payload." }, { status: 400 });

  const items = days.flatMap((d) => d.activities.map((a) => ({ date: d.date, ...a })));
  if (items.length === 0) {
    return Response.json({ error: "No activities selected." }, { status: 400 });
  }
  const today = londonDate(new Date());
  if (items.some((i) => i.date < today)) {
    return Response.json(
      { error: "Events can't be created for days before today." },
      { status: 400 },
    );
  }

  const dates = items.map((i) => i.date).sort();
  const existing = new Set<string>();
  try {
    let pageToken: string | undefined;
    do {
      const res = await cal.calendar.events.list({
        calendarId: cal.calendarId,
        timeMin: `${shiftIso(dates[0], -1)}T00:00:00Z`,
        timeMax: `${shiftIso(dates[dates.length - 1], 2)}T00:00:00Z`,
        singleEvents: true,
        privateExtendedProperty: ["gymTracker=1"],
        maxResults: 250,
        pageToken,
      });
      for (const e of res.data.items ?? []) {
        const k = e.extendedProperties?.private?.gymPlanKey;
        if (k && e.status !== "cancelled") existing.add(k);
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
  } catch (e) {
    return Response.json({ error: `Calendar request failed: ${errMessage(e)}` }, { status: 502 });
  }

  const created: string[] = [];
  const skipped: string[] = [];
  const failed: { event: string; error: string }[] = [];

  for (const it of items) {
    const label = `${activityLabel(it.activity)} — ${it.date} ${it.time}`;
    const planKey = `${it.date}|${it.activity}`;
    if (existing.has(planKey)) {
      skipped.push(label);
      continue;
    }
    try {
      await cal.calendar.events.insert({
        calendarId: cal.calendarId,
        requestBody: {
          summary: activityLabel(it.activity),
          location: it.location || undefined,
          start: { dateTime: `${it.date}T${it.time}:00`, timeZone: TIME_ZONE },
          end: { dateTime: endLocal(it.date, it.time, it.duration), timeZone: TIME_ZONE },
          extendedProperties: { private: { gymTracker: "1", gymPlanKey: planKey } },
        },
      });
      created.push(label);
    } catch (e) {
      failed.push({ event: label, error: errMessage(e) });
    }
  }

  return Response.json({ created, skipped, failed });
}
