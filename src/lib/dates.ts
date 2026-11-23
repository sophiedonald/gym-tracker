const pad = (n: number) => String(n).padStart(2, "0");

export function toIso(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayIso() {
  return toIso(new Date());
}

export function parseIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number) {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

export function mondayOf(iso: string) {
  const dow = (parseIso(iso).getDay() + 6) % 7;
  return addDays(iso, -dow);
}

export function formatShort(iso: string) {
  return parseIso(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDay(iso: string) {
  return parseIso(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
