exports = function (doc) {
  if (doc.kind !== "script") return;

  if (doc.pages) {
    doc.pages.map(function (page, pageNum) {
      var count = 0;
      var total = 0;
      if (page.sections) {
        page.sections.map(function (section) {
          if (section.zones) {
            section.zones.map(function (zone) {
              if (zone.confidence) {
                count += zone.confidence.count;
                total += zone.confidence.avg * zone.confidence.count;
              }
            });
          }
        });
      }
      if (count)
        emit(
          [
            doc.year || 0,
            doc.month || 0,
            doc.day || 0,
            doc.hour || 0,
            doc.min || 0,
            pageNum
          ],
          total / count
        );
    });
  }
};
