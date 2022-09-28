exports = function (doc) {
  if (doc.kind !== "script") return;
  if (!doc.edits) return;
  Object.keys(doc.edits).map(function (state) {
    doc.edits[state].map(function (edit) {
      emit(edit.id, { edit: edit, state: state });
    });
  });
};
