type WarshSpan = [start: number, end: number, className: string];
export type WarshTajweedData = Record<string, [text: string, spans: WarshSpan[]]>;

const allowedClasses = new Set([
  "madda_normal", "madda_permissible", "madda_necessary", "qlq",
  "ghn", "ikhf", "iqlb", "idgh_ghn", "warsh_taqlil", "warsh_naql",
]);

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character] || character);

/** Never display positional annotations unless the live Warsh verse matches. */
export function renderWarshTajweed(text: string, entry?: [string, WarshSpan[]]): string | undefined {
  if (!entry || entry[0] !== text || !Array.isArray(entry[1])) return undefined;
  let position = 0;
  let html = "";
  for (const [start, end, className] of entry[1]) {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < position || end <= start || end > text.length || !allowedClasses.has(className)) return undefined;
    html += escapeHtml(text.slice(position, start));
    html += `<tajweed class="${className}">${escapeHtml(text.slice(start, end))}</tajweed>`;
    position = end;
  }
  return html + escapeHtml(text.slice(position));
}
