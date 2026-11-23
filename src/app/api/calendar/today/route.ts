import { getCalendar, londonDate, NOT_CONFIGURED, errMessage, shiftIso } from "@/lib/google";
import { detectActivity } from "@/lib/activities";

export async function GET(request: Request) {
  const param = new URL(request.url).searchParams.get("date");
  const date = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : londonDate(new Date());

  const cal = getCalendar();
  if (!cal) return Response.json(NOT_CONFIGURED, { status: 503 });

  try {
    const res = await cal.calendar.events.list({
      calendarId: cal.calendarId,
      timeMin: `${shiftIso(date, -1)}T00:00:00Z`,
      timeMax: `${shiftIso(date, 2)}T00:00:00Z`,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 50,
    });

    const events = (res.data.items ?? [])
      .filter((e) => {
        if (!e.summary || e.status === "cancelled") return false;
        if (e.start?.dateTime) return londonDate(e.start.dateTime) === date;
        if (e.start?.date && e.end?.date) return e.start.date <= date && date < e.end.date;
        return false;
      })
      .map((e) => ({
        id: e.id ?? "",
        summary: e.summary as string,
        start: e.start?.dateTime ?? e.start?.date ?? null,
        activity: detectActivity(e.summary as string),
      }));

    return Response.json({ date, events });
  } catch (e) {
    return Response.json({ error: `Calendar request failed: ${errMessage(e)}` }, { status: 502 });
  }
}
