import { errMessage, getCalendar, londonDate, NOT_CONFIGURED, shiftIso } from "@/lib/google";

export async function GET(request: Request) {
  const start = new URL(request.url).searchParams.get("start");
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    return Response.json({ error: "Missing or invalid start (YYYY-MM-DD)." }, { status: 400 });
  }

  const cal = getCalendar();
  if (!cal) return Response.json(NOT_CONFIGURED, { status: 503 });

  const days = Array.from({ length: 7 }, (_, i) => shiftIso(start, i));
  const byDate: Record<string, { id: string; summary: string; time: string | null; location: string | null }[]> =
    Object.fromEntries(days.map((d) => [d, []]));

  try {
    const res = await cal.calendar.events.list({
      calendarId: cal.calendarId,
      timeMin: `${shiftIso(start, -1)}T00:00:00Z`,
      timeMax: `${shiftIso(start, 8)}T00:00:00Z`,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
    });

    for (const e of res.data.items ?? []) {
      if (!e.summary || e.status === "cancelled") continue;
      const entry = {
        id: e.id ?? "",
        summary: e.summary,
        time: null as string | null,
        location: e.location ?? null,
      };
      if (e.start?.dateTime) {
        const date = londonDate(e.start.dateTime);
        entry.time = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/London",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(e.start.dateTime));
        byDate[date]?.push(entry);
      } else if (e.start?.date && e.end?.date) {
        for (const d of days) {
          if (e.start.date <= d && d < e.end.date) byDate[d].push(entry);
        }
      }
    }
    return Response.json({ start, events: byDate });
  } catch (e) {
    return Response.json({ error: `Calendar request failed: ${errMessage(e)}` }, { status: 502 });
  }
}
