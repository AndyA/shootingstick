exports = function (doc) {
  if (doc.kind !== "script") return;
  if (!doc.replaced_by) return;

  emit(doc.replaced_by, null);
};
