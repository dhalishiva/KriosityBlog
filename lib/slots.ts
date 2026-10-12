// Publishing slots, India Standard Time (UTC+05:30, no daylight saving).
export const SLOTS_IST = ["09:00", "18:00"];

const IST_OFFSET_MIN = 330;

/** Next publishing slot strictly after `from` (default now), as a Date. */
export function nextSlot(from: Date = new Date(), minLeadMinutes = 15): Date {
  const earliest = from.getTime() + minLeadMinutes * 60_000;
  // Work in "IST wall clock" by shifting the epoch.
  const istNow = new Date(earliest + IST_OFFSET_MIN * 60_000);
  for (let day = 0; day < 3; day++) {
    for (const s of SLOTS_IST) {
      const [h, m] = s.split(":").map(Number);
      const cand = Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate() + day, h, m) - IST_OFFSET_MIN * 60_000;
      if (cand >= earliest) return new Date(cand);
    }
  }
  return new Date(earliest);
}

export function formatIST(iso: string | Date | null, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    ...opts,
  }).format(new Date(iso));
}

/** Value for <input type="datetime-local"> in IST. */
export function toLocalInput(d: Date | string): string {
  const t = new Date(new Date(d).getTime() + IST_OFFSET_MIN * 60_000);
  return t.toISOString().slice(0, 16);
}

/** Parse an IST datetime-local value back to an ISO string. */
export function fromLocalInput(v: string): string {
  return new Date(Date.parse(v + ":00Z") - IST_OFFSET_MIN * 60_000).toISOString();
}
