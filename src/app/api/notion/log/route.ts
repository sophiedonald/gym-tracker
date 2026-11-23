import { Client } from "@notionhq/client";
import type { LogPayload } from "@/lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export async function POST(request: Request) {
  const apiKey = process.env.NOTION_API_KEY;
  const workoutsDb = process.env.NOTION_WORKOUTS_DB_ID;
  const setsDb = process.env.NOTION_SETS_DB_ID;
  if (!apiKey || !workoutsDb || !setsDb) {
    return Response.json(
      { error: "Missing NOTION_API_KEY, NOTION_WORKOUTS_DB_ID or NOTION_SETS_DB_ID." },
      { status: 500 },
    );
  }

  let body: LogPayload;
  try {
    body = (await request.json()) as LogPayload;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const exercises = Array.isArray(body.exercises) ? body.exercises : [];
  const sets = exercises.flatMap((ex) =>
    (Array.isArray(ex.sets) ? ex.sets : []).map((s) => ({
      exercise: String(ex.name),
      setNumber: num(s.setNumber),
      weight: num(s.weight),
      reps: num(s.reps),
    })),
  );
  const duration = num(body.durationMinutes);
  const distance = num(body.distanceKm);
  const noteParts = [
    (body.notes || "").trim(),
    duration > 0 ? `Duration: ${duration} min` : "",
    distance > 0 ? `Distance: ${distance} km` : "",
  ].filter(Boolean);
  if (sets.length === 0 && noteParts.length === 0) {
    return Response.json({ error: "Nothing to save: add a set, duration, distance or notes." }, { status: 400 });
  }

  const date = body.date && !Number.isNaN(Date.parse(body.date)) ? body.date : new Date().toISOString();
  const title = (body.title || "Workout").slice(0, 2000);
  const notes = noteParts.join("\n").slice(0, 2000);
  const totalVolume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0);

  // Pinned to the classic API version so `database_id` parents work.
  const notion = new Client({ auth: apiKey, notionVersion: "2022-06-28" });

  let workoutId: string;
  try {
    const workout = await notion.pages.create({
      parent: { database_id: workoutsDb },
      properties: {
        Name: { title: [{ text: { content: title } }] },
        Date: { date: { start: date } },
        "Total Volume": { number: totalVolume },
        Notes: { rich_text: notes ? [{ text: { content: notes } }] : [] },
      },
    });
    workoutId = workout.id;
  } catch (e) {
    return Response.json(
      { error: `Failed to create workout: ${e instanceof Error ? e.message : "unknown error"}` },
      { status: 502 },
    );
  }

  let created = 0;
  try {
    for (const s of sets) {
      await notion.pages.create({
        parent: { database_id: setsDb },
        properties: {
          Exercise: { title: [{ text: { content: s.exercise } }] },
          Set: { number: s.setNumber },
          Weight: { number: s.weight },
          Reps: { number: s.reps },
          "Est 1RM": { number: Math.round(s.weight * (1 + s.reps / 30)) },
          Date: { date: { start: date } },
          Workout: { relation: [{ id: workoutId }] },
        },
      });
      created++;
      await sleep(350);
    }
  } catch (e) {
    // Remove the partial workout so a retry does not create duplicates.
    await notion.pages.update({ page_id: workoutId, archived: true }).catch(() => {});
    return Response.json(
      {
        error: `Failed after ${created}/${sets.length} sets: ${e instanceof Error ? e.message : "unknown error"}. Nothing was kept; safe to retry.`,
      },
      { status: 502 },
    );
  }

  return Response.json({ ok: true, workoutId, setsCreated: created, totalVolume });
}
