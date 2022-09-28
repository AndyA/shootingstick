function (keys, values, rereduce) {
  var total = 0;
  var count = 0;
  var min = 255;
  var max = 0;

  values.map(function (v) {
    count += v.count;
    total += v.avg * v.count;
    if (min > v.min) min = v.min;
    if (max < v.max) max = v.max;
  });

  return { count: count, avg: total / count, min: min, max: max };
}