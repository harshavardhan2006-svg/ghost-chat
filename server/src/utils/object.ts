export const removeUndefined = <TRecord extends Record<string, unknown>>(record: TRecord): Partial<TRecord> => {
  const entries = Object.entries(record).filter((entry): entry is [keyof TRecord & string, unknown] => {
    const [, value] = entry;
    return value !== undefined;
  });

  return Object.fromEntries(entries) as Partial<TRecord>;
};
