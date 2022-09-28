exports = function (doc) {
  if (doc.kind !== "script") return;
  if (!doc.versions) return;
  var seen = {};

  // Index edits by ID
  var idx = {};
  var byState = doc.edits || {};
  Object.keys(byState).map(function (state) {
    var edits = byState[state];
    edits.map(function (edit) {
      idx[edit.id] = edit;
    });
  });

  for (var i = doc.versions.length; i-- > 0; ) {
    var ver = doc.versions[i];
    if (!ver.meta || !ver.meta.state || !ver.meta.ts) continue;
    if (seen[ver.meta.id]) continue;
    seen[ver.meta.id] = true;
    emit([ver.meta.ts, ver.meta.state], {
      meta: ver.meta,
      edit: idx[ver.meta.id],
      service: doc.service,
      year: doc.year,
      month: doc.month,
      day: doc.day,
      hour: doc.hour,
      minute: doc.minute
    });
  }
};
