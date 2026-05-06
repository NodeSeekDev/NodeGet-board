export function groupBy<T, K extends keyof T>(
  arr: T[],
  key: K,
): Record<string, T[]> {
  return arr.reduce(
    (acc, item) => {
      const groupKey = String(item[key]);
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(item);
      return acc;
    },
    {} as Record<string, T[]>,
  );
}
