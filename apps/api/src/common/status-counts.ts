/** `{ [status]: 0 }` for every enum value, so summaries always list every status. */
export function zeroCounts<S extends string>(statuses: readonly S[]): Record<S, number> {
  return Object.fromEntries(statuses.map((s) => [s, 0])) as Record<S, number>;
}
