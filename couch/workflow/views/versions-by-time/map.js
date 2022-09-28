exports = function (doc) {
  if (doc.kind !== "script") return;
  (doc.versions || []).map(function (ver) {
    if (ver.meta && ver.meta.state && ver.meta.ts)
      emit([ver.meta.ts, ver.meta.state], { meta: ver.meta });
  });
};
