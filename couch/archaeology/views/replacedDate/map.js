exports = function (doc) {
  if (doc.kind !== "script") return;
  if (!doc.replaced_by) return;

  emit(
    [doc.year || 0, doc.month || 0, doc.day || 0, doc.hour || 0, doc.min || 0],
    null
  );
};
