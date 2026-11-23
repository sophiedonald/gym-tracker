"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Settings } from "lucide-react";
import {
  ACTIVITIES,
  DEFAULT_PLAN_SETTING,
  activityLabel,
  type ActivityKey,
  type PlanSetting,
} from "@/lib/activities";
import { addDays, formatDay, formatShort, mondayOf, todayIso } from "@/lib/dates";

type PlanItem = { activity: ActivityKey; time: string; duration: number; location: string };
type WeekPlan = Record<string, PlanItem[]>;
type Plans = Record<string, WeekPlan>;
type Settings = Record<ActivityKey, PlanSetting>;
type Result = { created: string[]; skipped: string[]; failed: { event: string; error: string }[] };
type CalEvent = { id: string; summary: string; time: string | null; location: string | null };

const PLANS_KEY = "gym:plans";
const SETTINGS_KEY = "gym:planSettings";

const field =
  "h-11 min-w-0 rounded-lg bg-zinc-800 px-2 text-white placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-lime-400";

const defaultSettings = (): Settings =>
  Object.fromEntries(ACTIVITIES.map((a) => [a.key, { ...DEFAULT_PLAN_SETTING }])) as Settings;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function PlanPage() {
  const [ready, setReady] = useState(false);
  const [weekStart, setWeekStart] = useState("");
  const [plans, setPlans] = useState<Plans>({});
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [today, setToday] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [weekData, setWeekData] = useState<{
    week: string;
    events: Record<string, CalEvent[]> | null;
  } | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setToday(todayIso());
    setWeekStart(addDays(mondayOf(todayIso()), 7));
    setPlans(read<Plans>(PLANS_KEY, {}));
    setSettings({ ...defaultSettings(), ...read<Partial<Settings>>(SETTINGS_KEY, {}) });
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [ready, plans, settings]);

  useEffect(() => {
    if (!weekStart) return;
    let cancelled = false;
    fetch(`/api/calendar/week?start=${weekStart}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { events: Record<string, CalEvent[]> }) => {
        if (!cancelled) setWeekData({ week: weekStart, events: data.events });
      })
      .catch(() => {
        if (!cancelled) setWeekData({ week: weekStart, events: null });
      });
    return () => {
      cancelled = true;
    };
  }, [weekStart, refreshKey]);

  if (!ready || !weekStart) return <main className="flex-1" />;

  const week = plans[weekStart] ?? {};
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isPast = (d: string) => d < today;
  const plannable = days.filter((d) => !isPast(d));
  const totalItems = plannable.reduce((n, d) => n + (week[d]?.length ?? 0), 0);
  const eventsLoaded = weekData?.week === weekStart;
  const calendarEvents = eventsLoaded ? weekData.events : null;

  const setDay = (date: string, items: PlanItem[]) =>
    setPlans((p) => ({ ...p, [weekStart]: { ...p[weekStart], [date]: items } }));

  const toggle = (date: string, key: ActivityKey) => {
    const items = week[date] ?? [];
    if (items.some((i) => i.activity === key)) {
      setDay(date, items.filter((i) => i.activity !== key));
    } else {
      setDay(date, [...items, { activity: key, ...settings[key] }]);
    }
  };

  const patchItem = (date: string, key: ActivityKey, patch: Partial<PlanItem>) =>
    setDay(
      date,
      (week[date] ?? []).map((i) => (i.activity === key ? { ...i, ...patch } : i)),
    );

  const changeWeek = (delta: number) => {
    setWeekStart(addDays(weekStart, delta * 7));
    setResult(null);
    setError(null);
    setInfo(null);
  };

  const copyLastWeek = () => {
    const prev = plans[addDays(weekStart, -7)];
    const hasItems = prev && Object.values(prev).some((items) => items.length > 0);
    if (!prev || !hasItems) {
      setInfo("No saved plan for the previous week.");
      return;
    }
    const next: WeekPlan = {};
    for (let i = 0; i < 7; i++) {
      const target = addDays(weekStart, i);
      if (isPast(target)) continue;
      const items = prev[addDays(weekStart, i - 7)];
      if (items?.length) next[target] = items.map((it) => ({ ...it }));
    }
    setPlans((p) => ({ ...p, [weekStart]: { ...p[weekStart], ...next } }));
    setInfo("Copied last week's plan.");
    setResult(null);
    setError(null);
  };

  const create = async () => {
    setError(null);
    setResult(null);
    setInfo(null);
    setCreating(true);
    try {
      const res = await fetch("/api/calendar/plan-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days: plannable
            .filter((d) => week[d]?.length)
            .map((d) => ({ date: d, activities: week[d] })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<Result> & { error?: string };
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setRefreshKey((k) => k + 1);
      setResult({
        created: data.created ?? [],
        skipped: data.skipped ?? [],
        failed: data.failed ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-4 px-4 pb-32 pt-4">
      <div className="flex items-center gap-2">
        <button
          aria-label="Previous week"
          onClick={() => changeWeek(-1)}
          className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-900"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="flex-1 text-center">
          <div className="text-xs uppercase text-zinc-500">Week of</div>
          <div className="text-lg font-bold">{formatShort(weekStart)}</div>
        </div>
        <button
          aria-label="Next week"
          onClick={() => changeWeek(1)}
          className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-900"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={copyLastWeek}
          className="h-12 flex-1 rounded-lg border border-zinc-700 font-semibold text-zinc-200 active:bg-zinc-800"
        >
          Copy Last Week&apos;s Plan
        </button>
        <button
          aria-label="Default time and place settings"
          aria-pressed={showSettings}
          onClick={() => setShowSettings((s) => !s)}
          className={`flex h-12 w-12 items-center justify-center rounded-lg ${
            showSettings ? "bg-lime-400 text-black" : "bg-zinc-900 text-zinc-300"
          }`}
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>

      {info && <div role="status" className="rounded-lg bg-zinc-900 p-3 text-zinc-300">{info}</div>}

      {showSettings && (
        <section className="space-y-3 rounded-xl bg-zinc-900 p-3">
          <h2 className="font-semibold">Defaults per activity</h2>
          {ACTIVITIES.map((a) => (
            <div key={a.key} className="space-y-1.5">
              <div className="text-sm font-semibold text-zinc-300">{a.label}</div>
              <div className="flex gap-1.5">
                <input
                  type="time"
                  aria-label={`${a.label} default start time`}
                  value={settings[a.key].time}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, [a.key]: { ...s[a.key], time: e.target.value } }))
                  }
                  className={`${field} w-28`}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  aria-label={`${a.label} default duration in minutes`}
                  value={settings[a.key].duration || ""}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      [a.key]: { ...s[a.key], duration: Number(e.target.value) || 0 },
                    }))
                  }
                  className={`${field} w-20`}
                />
                <span className="self-center text-sm text-zinc-500">min</span>
              </div>
              <input
                aria-label={`${a.label} default location`}
                placeholder="Location"
                value={settings[a.key].location}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, [a.key]: { ...s[a.key], location: e.target.value } }))
                }
                className={`${field} w-full`}
              />
            </div>
          ))}
          <p className="text-xs text-zinc-500">Defaults apply when you add an activity to a day.</p>
        </section>
      )}

      {days.map((date) => {
        const items = week[date] ?? [];
        const past = isPast(date);
        const dayEvents = calendarEvents?.[date] ?? [];
        return (
          <section
            key={date}
            className={`space-y-2 rounded-xl bg-zinc-900 p-3 ${past ? "opacity-80" : ""}`}
          >
            <h2 className="font-semibold">
              {formatDay(date)}
              {past && <span className="ml-2 text-xs font-normal text-zinc-500">Past · read-only</span>}
            </h2>
            <div className="space-y-1 text-sm">
              {!eventsLoaded ? (
                <div className="text-zinc-500">Loading calendar…</div>
              ) : !calendarEvents ? (
                past && <div className="text-zinc-500">Calendar unavailable.</div>
              ) : dayEvents.length > 0 ? (
                dayEvents.map((e) => (
                  <div key={e.id + e.summary} className="rounded-lg bg-zinc-800 px-3 py-2 text-zinc-200">
                    <span className="font-semibold">{e.summary}</span>
                    {e.time && <span className="text-zinc-400"> · {e.time}</span>}
                    {e.location && <span className="text-zinc-500"> · {e.location}</span>}
                  </div>
                ))
              ) : past ? (
                <div className="text-zinc-500">No calendar event was entered.</div>
              ) : null}
            </div>
            {!past && (
            <>
            <div className="flex flex-wrap gap-2">
              {ACTIVITIES.map((a) => {
                const on = items.some((i) => i.activity === a.key);
                return (
                  <button
                    key={a.key}
                    aria-pressed={on}
                    onClick={() => toggle(date, a.key)}
                    className={`h-11 rounded-lg px-3 text-sm font-semibold ${
                      on ? "bg-lime-400 text-black" : "bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    {a.label}
                  </button>
                );
              })}
              <button
                aria-pressed={items.length === 0}
                onClick={() => setDay(date, [])}
                className={`h-11 rounded-lg px-3 text-sm font-semibold ${
                  items.length === 0 ? "bg-zinc-600 text-white" : "bg-zinc-800 text-zinc-400"
                }`}
              >
                Rest
              </button>
            </div>
            {items.map((it) => (
              <div key={it.activity} className="space-y-1.5 rounded-lg bg-zinc-950/60 p-2">
                <div className="text-sm font-semibold text-zinc-300">{activityLabel(it.activity)}</div>
                <div className="flex gap-1.5">
                  <input
                    type="time"
                    aria-label="Start time"
                    value={it.time}
                    onChange={(e) => patchItem(date, it.activity, { time: e.target.value })}
                    className={`${field} w-28`}
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    aria-label="Duration in minutes"
                    value={it.duration || ""}
                    onChange={(e) =>
                      patchItem(date, it.activity, { duration: Number(e.target.value) || 0 })
                    }
                    className={`${field} w-20`}
                  />
                  <span className="self-center text-sm text-zinc-500">min</span>
                </div>
                <input
                  aria-label="Location"
                  placeholder="Location"
                  value={it.location}
                  onChange={(e) => patchItem(date, it.activity, { location: e.target.value })}
                  className={`${field} w-full`}
                />
              </div>
            ))}
            </>
            )}
          </section>
        );
      })}

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-500/15 p-3 text-red-300">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div
          role="status"
          className="space-y-2 rounded-lg bg-lime-400/15 p-3 text-sm text-lime-200"
        >
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-5 w-5" />
            {result.created.length} created, {result.skipped.length} already existed,{" "}
            {result.failed.length} failed
          </div>
          {result.created.map((e) => (
            <div key={e}>✓ {e}</div>
          ))}
          {result.skipped.map((e) => (
            <div key={e} className="text-zinc-400">
              ↷ {e} (already in calendar, skipped)
            </div>
          ))}
          {result.failed.map((f) => (
            <div key={f.event} className="text-red-300">
              ✗ {f.event}: {f.error}
            </div>
          ))}
          {result.failed.length > 0 && (
            <div className="text-zinc-300">Tap the button again to retry; created events won&apos;t duplicate.</div>
          )}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-950/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        <button
          onClick={create}
          disabled={creating || totalItems === 0}
          className="mx-auto flex h-14 w-full max-w-lg items-center justify-center gap-2 rounded-xl bg-lime-400 text-lg font-bold text-black disabled:opacity-40"
        >
          {creating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Creating {totalItems} events…
            </>
          ) : (
            `Create Week in Google Calendar${totalItems ? ` (${totalItems})` : ""}`
          )}
        </button>
      </div>
    </main>
  );
}
