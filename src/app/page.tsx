"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import starterExercises from "@/data/exercises.json";
import {
  GYM_ACTIVITIES,
  PLANNED_EXERCISES,
  activityLabel,
  type ActivityKey,
} from "@/lib/activities";
import { formatShort, todayIso } from "@/lib/dates";
import type { Exercise, LogPayload, Workout, WorkoutExercise, WorkoutSet } from "@/lib/types";

const WORKOUT_KEY = "gym:workout";
const CUSTOM_KEY = "gym:customExercises";
const DEFAULTS_KEY = "gym:defaults";
const LAST_KEY = "gym:lastSessions";

type Defaults = Record<string, { weight: number; reps: number }>;
type LastSessions = Partial<Record<ActivityKey, WorkoutExercise[]>>;
type CalEvent = { id: string; summary: string; activity: ActivityKey | null };

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const defaultTitle = (date: string) => `Morning Workout — ${formatShort(date)}`;

const isAutoTitle = (title: string) => !title || title.startsWith("Morning Workout");

const freshWorkout = (): Workout => {
  const date = todayIso();
  return {
    title: defaultTitle(date),
    notes: "",
    date,
    duration: "",
    distance: "",
    saved: false,
    exercises: [],
  };
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// A set counts if it has reps and either a weight or an explicit completion tick.
const isValidSet = (s: WorkoutSet) => s.reps > 0 && (s.weight > 0 || s.completed);

const validSets = (e: WorkoutExercise) =>
  e.sets.map((s, i) => ({ s, setNumber: i + 1 })).filter(({ s }) => isValidSet(s));

function NumInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
}) {
  const [text, setText] = useState(String(value));
  const [last, setLast] = useState(value);
  if (last !== value) {
    setLast(value);
    if (Number(text) !== value) setText(String(value));
  }
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      value={text}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const t = e.target.value.replace(",", ".");
        if (!/^\d*\.?\d*$/.test(t)) return;
        setText(t);
        onChange(t === "" || t === "." ? 0 : Number(t));
      }}
      className="h-12 w-full min-w-0 rounded-lg bg-zinc-800 text-center text-lg font-semibold text-white outline-none focus:ring-2 focus:ring-lime-400"
    />
  );
}

const stepBtn =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-sm font-semibold text-zinc-200 active:bg-zinc-700";

const textField =
  "h-12 w-full rounded-lg bg-zinc-900 px-3 text-white placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-lime-400";

export default function Home() {
  const [ready, setReady] = useState(false);
  const [workout, setWorkout] = useState<Workout>({
    title: "",
    notes: "",
    date: "",
    duration: "",
    distance: "",
    saved: false,
    exercises: [],
  });
  const [custom, setCustom] = useState<Exercise[]>([]);
  const [defaults, setDefaults] = useState<Defaults>({});
  const [lastSessions, setLastSessions] = useState<LastSessions>({});
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [calStatus, setCalStatus] = useState<"loading" | "ok" | "error">("loading");
  const [refreshKey, setRefreshKey] = useState(0);
  const [pick, setPick] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [cName, setCName] = useState("");
  const [cGroup, setCGroup] = useState("");
  const [cEquip, setCEquip] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoTitle = useRef("");

  useEffect(() => {
    const saved = read<Partial<Workout> | null>(WORKOUT_KEY, null);
    /* eslint-disable react-hooks/set-state-in-effect */
    setWorkout({ ...freshWorkout(), ...saved });
    setCustom(read<Exercise[]>(CUSTOM_KEY, []));
    setDefaults(read<Defaults>(DEFAULTS_KEY, {}));
    setLastSessions(read<LastSessions>(LAST_KEY, {}));
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(WORKOUT_KEY, JSON.stringify(workout));
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
    localStorage.setItem(DEFAULTS_KEY, JSON.stringify(defaults));
    localStorage.setItem(LAST_KEY, JSON.stringify(lastSessions));
  }, [ready, workout, custom, defaults, lastSessions]);

  const date = workout.date;
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetch(`/api/calendar/today?date=${date}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { events: CalEvent[] }) => {
        if (cancelled) return;
        setEvents(data.events);
        setCalStatus("ok");
        const names = data.events.map((e) => e.summary);
        const title = names.length ? `${names.join(" + ")} — ${formatShort(date)}` : defaultTitle(date);
        setWorkout((w) => {
          if (w.saved || !(isAutoTitle(w.title) || w.title === autoTitle.current)) return w;
          autoTitle.current = title;
          return { ...w, title };
        });
      })
      .catch(() => {
        if (cancelled) return;
        setEvents([]);
        setCalStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [ready, date, refreshKey]);

  const allExercises: Exercise[] = [...(starterExercises as Exercise[]), ...custom];

  const gymKeys = [...new Set(events.map((e) => e.activity))].filter(
    (k): k is "uppers" | "legs" => !!k && GYM_ACTIVITIES.includes(k),
  );
  const quickKeys = [...new Set(events.map((e) => e.activity))].filter(
    (k): k is ActivityKey => !!k && !GYM_ACTIVITIES.includes(k),
  );

  const makeExercise = (ex: Exercise): WorkoutExercise => {
    const d = defaults[ex.id] ?? { weight: 0, reps: 10 };
    return {
      id: uid(),
      exerciseId: ex.id,
      name: ex.name,
      sets: [{ id: uid(), weight: d.weight, reps: d.reps, completed: false }],
    };
  };

  const updateExercise = (id: string, fn: (e: WorkoutExercise) => WorkoutExercise) =>
    setWorkout((w) => ({ ...w, exercises: w.exercises.map((e) => (e.id === id ? fn(e) : e)) }));

  const updateSet = (exId: string, setId: string, patch: Partial<WorkoutSet>) =>
    updateExercise(exId, (e) => ({
      ...e,
      sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
    }));

  const addExercise = (ex: Exercise) =>
    setWorkout((w) => ({ ...w, exercises: [...w.exercises, makeExercise(ex)] }));

  const addSet = (exId: string) =>
    updateExercise(exId, (e) => {
      const prev = e.sets[e.sets.length - 1];
      return {
        ...e,
        sets: [
          ...e.sets,
          { id: uid(), weight: prev?.weight ?? 0, reps: prev?.reps ?? 10, completed: false },
        ],
      };
    });

  const loadPlanned = () => {
    const have = new Set(workout.exercises.map((e) => e.exerciseId));
    const toAdd = gymKeys
      .flatMap((k) => PLANNED_EXERCISES[k])
      .filter((id, i, arr) => arr.indexOf(id) === i && !have.has(id))
      .map((id) => allExercises.find((e) => e.id === id))
      .filter((e): e is Exercise => !!e)
      .map(makeExercise);
    setWorkout((w) => ({ ...w, exercises: [...w.exercises, ...toAdd] }));
  };

  const repeatLast = (key: ActivityKey) => {
    const last = lastSessions[key];
    if (!last) return;
    if (workout.exercises.length && !window.confirm("Replace the current exercises?")) return;
    setWorkout((w) => ({
      ...w,
      exercises: last.map((e) => ({
        ...e,
        id: uid(),
        sets: e.sets.map((s) => ({ ...s, id: uid(), completed: false })),
      })),
    }));
  };

  const changeDate = (next: string) => {
    if (!next) return;
    setWorkout((w) => ({
      ...w,
      date: next,
      title: isAutoTitle(w.title) || w.title === autoTitle.current ? defaultTitle(next) : w.title,
    }));
  };

  const submitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const name = cName.trim();
    if (!name) return;
    const ex: Exercise = {
      id: `custom-${uid()}`,
      name,
      muscleGroup: cGroup.trim() || "Other",
      equipment: cEquip.trim() || "Other",
    };
    setCustom((c) => [...c, ex]);
    addExercise(ex);
    setCName("");
    setCGroup("");
    setCEquip("");
    setShowCustom(false);
  };

  const setCount = workout.exercises.reduce((n, e) => n + validSets(e).length, 0);
  const hasQuick = !!(workout.duration.trim() || workout.distance.trim() || workout.notes.trim());
  const canSave = !saving && !workout.saved && (setCount > 0 || hasQuick);

  const startFresh = () => {
    const hasData = workout.exercises.length > 0 || hasQuick;
    if (!workout.saved && hasData && !window.confirm("Discard this unsaved workout?")) return;
    autoTitle.current = "";
    setWorkout(freshWorkout());
    setSuccess(null);
    setError(null);
    setRefreshKey((k) => k + 1);
  };

  const save = async () => {
    if (!canSave) return;
    setError(null);
    setSuccess(null);
    const duration = Number(workout.duration);
    const distance = Number(workout.distance);
    const payload: LogPayload = {
      title: workout.title.trim() || defaultTitle(workout.date),
      notes: workout.notes.trim(),
      date: workout.date,
      durationMinutes: duration > 0 ? duration : undefined,
      distanceKm: distance > 0 ? distance : undefined,
      exercises: workout.exercises
        .map((e) => ({
          name: e.name,
          sets: validSets(e).map(({ s, setNumber }) => ({
            setNumber,
            weight: s.weight,
            reps: s.reps,
          })),
        }))
        .filter((e) => e.sets.length > 0),
    };
    setSaving(true);
    try {
      const res = await fetch("/api/notion/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        setsCreated?: number;
        totalVolume?: number;
      };
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);

      const sanitized = workout.exercises
        .map((e) => ({ ...e, sets: e.sets.filter(isValidSet) }))
        .filter((e) => e.sets.length > 0);
      setDefaults((d) => {
        const next = { ...d };
        for (const e of sanitized) {
          const last = e.sets[e.sets.length - 1];
          next[e.exerciseId] = { weight: last.weight, reps: last.reps };
        }
        return next;
      });
      if (sanitized.length > 0 && gymKeys.length > 0) {
        setLastSessions((l) => {
          const next = { ...l };
          for (const k of gymKeys) next[k] = sanitized;
          return next;
        });
      }
      setWorkout((w) => ({ ...w, saved: true }));
      setSuccess(
        `Saved to Notion: ${data.setsCreated ?? 0} sets, ${Math.round(data.totalVolume ?? 0)} total volume.`,
      );
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : "Network error"} Your workout is still saved on this device — tap Save to Notion to retry.`,
      );
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return <main className="flex-1" />;

  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-4 px-4 pb-32 pt-4">
      <section className="space-y-2">
        <input
          aria-label="Session title"
          value={workout.title}
          onChange={(e) => setWorkout((w) => ({ ...w, title: e.target.value }))}
          className="h-12 w-full rounded-lg bg-transparent text-2xl font-bold text-white outline-none focus:ring-2 focus:ring-lime-400"
        />
        <input
          type="date"
          aria-label="Workout date"
          value={workout.date}
          onChange={(e) => changeDate(e.target.value)}
          className={textField}
        />
        <input
          aria-label="Session notes"
          placeholder="Session notes (optional)"
          value={workout.notes}
          onChange={(e) => setWorkout((w) => ({ ...w, notes: e.target.value }))}
          className={textField}
        />
        {calStatus === "error" && (
          <p className="text-xs text-zinc-500">Calendar unavailable — logging works without it.</p>
        )}
      </section>

      {success && (
        <div role="status" className="space-y-2 rounded-lg bg-lime-400/15 p-3 text-lime-300">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{success}</span>
          </div>
          <button
            onClick={startFresh}
            className="h-11 w-full rounded-lg bg-lime-400 font-semibold text-black"
          >
            Clear / Start Fresh
          </button>
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-500/15 p-3 text-red-300">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {(gymKeys.length > 0 || quickKeys.length > 0) && (
        <section className="space-y-2 rounded-xl bg-zinc-900 p-3">
          <div className="text-sm text-zinc-400">
            Today in your calendar: {events.map((e) => e.summary).join(", ")}
          </div>
          {gymKeys.length > 0 && (
            <button
              onClick={loadPlanned}
              className="h-12 w-full rounded-lg bg-lime-400 font-semibold text-black"
            >
              Load Planned Exercises
            </button>
          )}
          {gymKeys.map((k) =>
            lastSessions[k] ? (
              <button
                key={k}
                onClick={() => repeatLast(k)}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 font-semibold text-zinc-200 active:bg-zinc-800"
              >
                <RotateCcw className="h-4 w-4" /> Repeat Last {activityLabel(k)} Session
              </button>
            ) : null,
          )}
          {quickKeys.length > 0 && (
            <div className="space-y-2">
              <div className="font-semibold">Quick log · {quickKeys.map(activityLabel).join(", ")}</div>
              <div className="flex gap-2">
                <input
                  inputMode="decimal"
                  aria-label="Duration in minutes"
                  placeholder="Duration (min)"
                  value={workout.duration}
                  onChange={(e) =>
                    /^\d*\.?\d*$/.test(e.target.value) &&
                    setWorkout((w) => ({ ...w, duration: e.target.value }))
                  }
                  className="h-12 min-w-0 flex-1 rounded-lg bg-zinc-800 px-3 text-white placeholder:text-zinc-500"
                />
                <input
                  inputMode="decimal"
                  aria-label="Distance in km"
                  placeholder="Distance (km)"
                  value={workout.distance}
                  onChange={(e) =>
                    /^\d*\.?\d*$/.test(e.target.value) &&
                    setWorkout((w) => ({ ...w, distance: e.target.value }))
                  }
                  className="h-12 min-w-0 flex-1 rounded-lg bg-zinc-800 px-3 text-white placeholder:text-zinc-500"
                />
              </div>
              <p className="text-xs text-zinc-500">Notes go in the session notes above. Exercises below are optional.</p>
            </div>
          )}
        </section>
      )}

      {workout.exercises.map((ex) => (
        <section key={ex.id} className="space-y-2 rounded-xl bg-zinc-900 p-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{ex.name}</h2>
            <button
              aria-label={`Remove ${ex.name}`}
              onClick={() =>
                setWorkout((w) => ({ ...w, exercises: w.exercises.filter((e) => e.id !== ex.id) }))
              }
              className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 active:bg-zinc-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {ex.sets.map((s, i) => (
            <div key={s.id} className="space-y-1.5 rounded-lg bg-zinc-950/60 p-2">
              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span className="font-semibold">Set {i + 1}</span>
                <div className="flex items-center gap-2">
                  <button
                    aria-label={s.completed ? "Mark set incomplete" : "Mark set completed"}
                    aria-pressed={s.completed}
                    onClick={() => updateSet(ex.id, s.id, { completed: !s.completed })}
                    className={`flex h-11 w-11 items-center justify-center rounded-lg ${
                      s.completed ? "bg-lime-400 text-black" : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    <Check className="h-6 w-6" />
                  </button>
                  <button
                    aria-label="Remove set"
                    onClick={() =>
                      updateExercise(ex.id, (e) => ({
                        ...e,
                        sets: e.sets.filter((x) => x.id !== s.id),
                      }))
                    }
                    className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-800 text-red-400 active:bg-zinc-700"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  className={stepBtn}
                  onClick={() => updateSet(ex.id, s.id, { weight: Math.max(0, s.weight - 2.5) })}
                >
                  -2.5
                </button>
                <NumInput
                  label="Weight"
                  value={s.weight}
                  onChange={(n) => updateSet(ex.id, s.id, { weight: n })}
                />
                <button
                  className={stepBtn}
                  onClick={() => updateSet(ex.id, s.id, { weight: s.weight + 2.5 })}
                >
                  +2.5
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  className={stepBtn}
                  onClick={() => updateSet(ex.id, s.id, { reps: Math.max(0, s.reps - 1) })}
                >
                  -1
                </button>
                <NumInput
                  label="Reps"
                  value={s.reps}
                  onChange={(n) => updateSet(ex.id, s.id, { reps: Math.round(n) })}
                />
                <button
                  className={stepBtn}
                  onClick={() => updateSet(ex.id, s.id, { reps: s.reps + 1 })}
                >
                  +1
                </button>
              </div>
              <p className="text-center text-xs text-zinc-500">weight (kg/lb) × reps</p>
            </div>
          ))}

          <button
            onClick={() => addSet(ex.id)}
            className="flex h-12 w-full items-center justify-center gap-1 rounded-lg border border-zinc-700 font-semibold text-zinc-200 active:bg-zinc-800"
          >
            <Plus className="h-5 w-5" /> Add Set
          </button>
        </section>
      ))}

      <section className="space-y-2 rounded-xl border border-dashed border-zinc-700 p-3">
        <div className="flex gap-2">
          <select
            aria-label="Exercise"
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="h-12 min-w-0 flex-1 rounded-lg bg-zinc-800 px-2 text-white"
          >
            <option value="">Choose exercise…</option>
            {allExercises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.muscleGroup}
              </option>
            ))}
          </select>
          <button
            disabled={!pick}
            onClick={() => {
              const ex = allExercises.find((e) => e.id === pick);
              if (ex) addExercise(ex);
              setPick("");
            }}
            className="flex h-12 items-center gap-1 rounded-lg bg-lime-400 px-4 font-semibold text-black disabled:opacity-40"
          >
            <Plus className="h-5 w-5" /> Add
          </button>
        </div>

        {showCustom ? (
          <form onSubmit={submitCustom} className="space-y-2">
            <input
              required
              placeholder="Exercise name"
              value={cName}
              onChange={(e) => setCName(e.target.value)}
              className="h-12 w-full rounded-lg bg-zinc-800 px-3 text-white placeholder:text-zinc-500"
            />
            <div className="flex gap-2">
              <input
                placeholder="Muscle group"
                value={cGroup}
                onChange={(e) => setCGroup(e.target.value)}
                className="h-12 min-w-0 flex-1 rounded-lg bg-zinc-800 px-3 text-white placeholder:text-zinc-500"
              />
              <input
                placeholder="Equipment"
                value={cEquip}
                onChange={(e) => setCEquip(e.target.value)}
                className="h-12 min-w-0 flex-1 rounded-lg bg-zinc-800 px-3 text-white placeholder:text-zinc-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="h-12 flex-1 rounded-lg bg-lime-400 font-semibold text-black"
              >
                Save & Add
              </button>
              <button
                type="button"
                onClick={() => setShowCustom(false)}
                className="h-12 rounded-lg bg-zinc-800 px-4 text-zinc-300"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowCustom(true)}
            className="flex h-12 w-full items-center justify-center gap-1 rounded-lg text-zinc-300 active:bg-zinc-800"
          >
            + Add Custom Exercise
          </button>
        )}
      </section>

      <button
        onClick={startFresh}
        className="h-12 w-full rounded-lg text-sm text-zinc-500 active:bg-zinc-900"
      >
        Clear / Start Fresh
      </button>

      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-950/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        <button
          onClick={save}
          disabled={!canSave}
          className="mx-auto flex h-14 w-full max-w-lg items-center justify-center gap-2 rounded-xl bg-lime-400 text-lg font-bold text-black disabled:opacity-40"
        >
          {saving ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Saving…
            </>
          ) : workout.saved ? (
            "Saved ✓"
          ) : (
            `Save to Notion${setCount ? ` (${setCount} sets)` : ""}`
          )}
        </button>
      </div>
    </main>
  );
}
