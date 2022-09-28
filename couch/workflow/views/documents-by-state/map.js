exports = function (doc) {
  if (doc.kind !== "script") return;
  if (!doc.edits || !doc.versions) return;

  var last = {};
  for (var i = doc.versions.length; i-- > 0; ) {
    var meta = doc.versions[i].meta;
    if (!meta || !meta.state || !meta.ts) continue;
    if (!last[meta.state]) last[meta.state] = meta.ts;
  }

  Object.keys(doc.edits).map(function (state) {
    var edits = doc.edits[state].map(function (edit) {
      return { edit: edit, state: state };
    });
    if (edits.length) emit([state, last[state]], edits);
  });
};
