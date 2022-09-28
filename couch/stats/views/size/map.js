exports = function (doc) {
  if (doc.kind !== "script") return;
  var size = toJSON(doc).length;
  emit(size, size);
};
