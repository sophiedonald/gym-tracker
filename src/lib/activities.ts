export const ACTIVITIES = [
  { key: "uppers", label: "💪 Uppers" },
  { key: "legs", label: "🦵 Legs" },
  { key: "swim", label: "🏊‍♀️ Swim" },
  { key: "run", label: "🏃‍♀️ Run" },
  { key: "stretch", label: "🧘‍♀️ Stretch" },
  { key: "wattbike", label: "🚴‍♀️ Wattbike" },
] as const;

export type ActivityKey = (typeof ACTIVITIES)[number]["key"];

export const GYM_ACTIVITIES: ActivityKey[] = ["uppers", "legs"];

export const activityLabel = (key: ActivityKey) =>
  ACTIVITIES.find((a) => a.key === key)?.label ?? key;

export const isActivityKey = (v: unknown): v is ActivityKey =>
  ACTIVITIES.some((a) => a.key === v);

export const PLANNED_EXERCISES: Record<"uppers" | "legs", string[]> = {
  uppers: [
    "db-bench-press",
    "low-row",
    "cable-lateral-raises",
    "cable-bicep-21s",
    "cable-tricep-pushdowns",
  ],
  legs: ["squat", "box-squat", "bb-rdl", "db-reverse-lunges", "calf-raises"],
};

export const DEFAULT_PLAN_SETTING = {
  time: "06:00",
  duration: 90,
  location: "David Lloyd Manchester Trafford",
};

export type PlanSetting = typeof DEFAULT_PLAN_SETTING;

export function detectActivity(summary: string): ActivityKey | null {
  const s = summary.toLowerCase();
  return ACTIVITIES.find((a) => s.includes(a.key))?.key ?? null;
}
