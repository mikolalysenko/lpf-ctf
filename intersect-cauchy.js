'use strict'

module.exports = intersectCauchySurface

//Intersect a world line with a Cauchy surface
function intersectCauchySurface(phi, q, t0, t1, n) {
  n  = n  || 32
  t0 = t0 || 0
  t1 = t1 || 1e10

  if(t1 < q.createTime) {
    return -1
  }
  if(t0 > q.destroyTime) {
    return -1
  }

  t0 = Math.max(t0, q.createTime)
  t1 = Math.min(t1, q.destroyTime)
  if(t1 < t0) {
    return -1
  }

  var x = [0,0]

  //Test end points
  q.x(t1, x)
  var thi = phi(x[0], x[1])
  if(t1 < thi) {
    return -1
  }
  q.x(t0, x)
  var tlo = phi(x[0], x[1])
  if(tlo < t0) {
    return -1
  }

  //Curve crosses surface, so binary search
  for(var i=0; i<n; ++i) {
    var t = 0.5 * (t0 + t1)
    q.x(t, x)
    var tq = phi(x[0], x[1])
    if(tq < t) {
      t1 = t
    } else {
      t0 = t
    }
  }


  var xx = q.x(0.5*(t0+t1))
  var dd = phi(xx[0], xx[1]) - 0.5*(t0+t1)
  if(Math.abs(dd) > 1e-6) {
    console.log(dd, tlo, thi)
  }

  return 0.5 * (t0 + t1)
}