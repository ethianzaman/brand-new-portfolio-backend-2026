"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeDoc = serializeDoc;
exports.serializeDocs = serializeDocs;
/**
 * Plain-document serializer for `lean()` queries.
 *
 * The models expose an `id` field through a `toJSON` transform, but `lean()`
 * bypasses that transform — it returns the raw BSON shape (`_id`, `__v`) with
 * no `id`. Every list endpoint uses `lean()` (it skips Mongoose document
 * hydration, which is a large win on a hot list), so the `id` mapping has to
 * happen explicitly or the frontend receives documents without an `id`.
 */
function serializeDoc(doc) {
    const { _id, __v, ...rest } = doc;
    return {
        ...rest,
        id: _id === undefined || _id === null ? "" : String(_id),
    };
}
/** `serializeDoc` mapped over a list. */
function serializeDocs(docs) {
    return docs.map((doc) => serializeDoc(doc));
}
