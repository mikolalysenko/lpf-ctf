'use strict'

module.exports = intersectCauchySurface

//Intersect a world line with a Cauchy surface
function intersectCauchySurface(phi, q, t0, t1, n) {
  n  = n  || 16
  t0 = t0 || 0
  t1 = t1 || Infinity

  t0 = Math.max(t0, q.createTime)
  t1 = Math.min(t1, q.destroyTime)
  if(t1 < t0) {
    return -1
  }

  var x = [0,0]
  for(var i=0; i<n; ++i) {
    var t = 0.5 * (t0 + t1)
    q.x(t, x)
    var tq = phi(x[0], x[1])
    if(tq < t) {
      t1 = t
    } else if(tq > t) {
      t0 = t
    } else {
      return tq
    }
  }

  return 0.5 * (t0 + t1)
}