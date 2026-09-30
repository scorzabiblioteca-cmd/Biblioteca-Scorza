function check13(s: string) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}
function valid10(s: string) {
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += (s[i] === "X" ? 10 : Number(s[i])) * (10 - i);
  return sum % 11 === 0;
}
/** Devuelve ISBN-13 sin guiones, o null si no es válido. Convierte ISBN-10 a ISBN-13. */
export function normalizarIsbn(raw: string): string | null {
  const s = raw.replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{13}$/.test(s)) return check13(s) === Number(s[12]) ? s : null;
  if (/^\d{9}[\dX]$/.test(s) && valid10(s)) {
    const base = "978" + s.slice(0, 9);
    return base + check13(base + "0");
  }
  return null;
}
