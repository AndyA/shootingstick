exports = function (doc) {
  if (doc.kind !== "script") return;
  var size = toJSON(doc).length;
  emit(doc.pages.length, doc.pages.length);
};
