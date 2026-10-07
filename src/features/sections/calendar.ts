export const validCalendarDate = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number(v.slice(0, 4)) >= 2000 &&
  Number(v.slice(0, 4)) <= 2099 &&
  !Number.isNaN(Date.parse(v + "T12:00:00Z")) &&
  new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v;
