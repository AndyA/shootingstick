exports = function (doc) {
  if (doc.kind !== "script") return;

  doc.pages.map(function (page, pageNum) {
    if (page.paras)
      page.paras.map(function (para, paraNum) {
        emit(
          [
            doc.year || 0,
            doc.month || 0,
            doc.day || 0,
            doc.hour || 0,
            doc.min || 0,
            pageNum,
            paraNum
          ],
          para.confidence
        );
      });
  });
};
