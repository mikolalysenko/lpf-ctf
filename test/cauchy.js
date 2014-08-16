'use strict'

var tape = require('tape')
var createTrajectory = require('../trajectory')
var intersectCauchy = require('../intersect-cauchy')

tape('cauchy surface', function(t) {

  var q = createTrajectory(0, [0,0], [0,0])
  q.destroy(10)

  var phi = function(x,y) {
    return Math.abs(x-5)
  }
  t.equals(intersectCauchy(phi, q, 0, 100), 5)
  
  t.end()
})