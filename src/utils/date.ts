export function isValidIsoDate(str: string): boolean {
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, y, mm, dd] = m;
  const D = new Date(`${y}-${mm}-${dd}`);
  return (
    D.getFullYear() === Number(y) &&
    D.getMonth() + 1 === Number(mm) &&
    D.getDate() === Number(dd)
  );
}
