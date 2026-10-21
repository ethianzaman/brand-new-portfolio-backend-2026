/**
 * Plain-document serializer for `lean()` queries.
 *
 * The models expose an `id` field through a `toJSON` transform, but `lean()`
 * bypasses that transform — it returns the raw BSON shape (`_id`, `__v`) with
 * no `id`. Every list endpoint uses `lean()` (it skips Mongoose document
 * hydration, which is a large win on a hot list), so the `id` mapping has to
 * happen explicitly or the frontend receives documents without an `id`.
 */
export function serializeDoc<T extends Record<string, unknown>>(
  doc: T,
): T & { id: string } {
  const { _id, __v, ...rest } = doc as T & {
    _id?: unknown;
    __v?: unknown;
  };

  return {
    ...rest,
    id: _id === undefined || _id === null ? "" : String(_id),
  } as T & { id: string };
}

/** `serializeDoc` mapped over a list. */
export function serializeDocs<
  T extends Record<string, unknown>,
  R = T & { id: string },
>(docs: T[]): R[] {
  return docs.map((doc) => serializeDoc(doc) as R);
}
