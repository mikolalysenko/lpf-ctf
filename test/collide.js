'use strict'

var tape = require('tape')
var createTrajectory = require('../trajectory')
var testHit = require('../test-hit')

tape('collision detection', function(t) {
  
  //TODO: test collision detection

  var a = createTrajectory(0, [0,0], [0,0])
  var b = createTrajectory(0, [-1,0], [1,0])

  t.equals(testHit(a, b, 0, 10, 1), 0)
  t.equals(testHit(a, b, 0, 10, 0.5), 0.5)

  a.setVelocity(0.25, [0,1])
  t.equals(testHit(a, b, 0, 10, 0.25), -1)

  b.setVelocity(0.25, [2,0])
  t.ok(testHit(a, b, 0, 10, 0.5) > 0)

  t.end()
})