'use strict'

function minkowskiDistance2(c, x0, t0, x1, t1) {
  return Math.pow(x0[0] - x1[0], 2) + 
         Math.pow(x0[1] - x1[1], 2) +
         Math.pow(c * (t0 - t1), 2)
}
exports.dist2 = minkowskiDistance2