// Names the records that block a change, for an error message:
// "1 building (Science Hub)" or "5 rooms (Amphi A, Lab 304, Lab 305 and others)".
export function describeItems(
  names: string[],
  one: string,
  many: string,
): string {
  const count = names.length === 1 ? `1 ${one}` : `${names.length} ${many}`;
  const shown =
    names.length > 3
      ? `${names.slice(0, 3).join(', ')} and others`
      : names.join(', ');
  return `${count} (${shown})`;
}
