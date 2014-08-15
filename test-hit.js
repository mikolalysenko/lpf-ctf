'use strict'

module.exports = testCollision

var bsearch = require('binary-search-bounds')

function solveT(ax, av, at,
                bx, bv, bt,
                t0, t1, r) {

  var x0 = ax[0] - bx[0] - av[0]*at + bv[0] * bt
  var x1 = ax[1] - bx[1] - av[1]*at + bv[1] * bt

  var v0 = av[0] - bv[0]
  var v1 = av[1] - bv[1]

  var xx = x0*x0 + x1*x1 - r*r
  var xv = x0*v0 + x1*v1
  var vv = v0*v0 + v1*v1

  //Check collision at time t0
  if(xx + 2.0*xv*t + vv*t*t <= 0) {
    return t0
  }

  //Solve roots
  var discr = 4.0*(xv*xv - xx*vv)
  if(discr < 0) {
    return -1
  }

  var d   = Math.sqrt(discr)
  var s0  = 0.5 * (-2.0*xv - d) / a
  if(t0 <= s0 && s0 <= t1) {
    return s0
  }

  var s1 = 0.5 * (-2.0*xv + d) / a
  if(t0 <= s1 && s1 <= t1) {
    return s1
  }

  return -1
}

//Find first collision between trajectories
function testCollision(a, b, t0, t1, radius) {
  t0 = Math.max(a.createTime,  b.createTime,  +t0)
  t1 = Math.min(a.destroyTime, b.destroyTime, +t1)

  var a0 = bsearch.ge(a.states, compareT, t0)
  var a1 = bsearch.lt(a.states, compareT, t1)
  var b0 = bsearch.ge(b.states, compareT, t0)
  var b1 = bsearch.lt(b.states, compareT, t1)
  var t  = t0
  while(t < t1) {
    var nt = t1
    if(a0 + 1 < a.states.length) {
      nt = Math.min(nt, a.states[a0+1].t)
    }
    if(b0 + 1 < b.states.length) {
      nt = Math.min(nt, b.states[b0+1].t)
    }
    var as = a.states[a0]
    var bs = b.states[b0]
    var r = solveT(as.x, as.v, as.t,
                   bs.x, bs.v, bs.t,
                   t, nt, radius)
    if(r >= 0) {
      return r
    }
    t = nt
    if(a0 + 1 < a.states.length && a.states[a0+1].t <= t) {
      a0 += 1
    }
    if(b0 + 1 < b.states.length && b.states[b0+1].t <= t) {
      b0 += 1
    }
  }
  return -1
}