exports = function (doc) {
  (doc.versions || []).map(function (ver) {
    var reason = (ver.meta && ver.meta.reason) || "unknown";
    emit(reason, null);
  });
};
