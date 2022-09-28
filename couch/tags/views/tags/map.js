exports = function (doc) {
  if (doc.kind !== "script") return;
  (doc.tags || []).map(function (tag) {
    emit(tag.split("/"), null);
  });
};
