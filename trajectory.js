'use strict'

module.exports = createTrajectory
module.exports.fromJSON = fromJSON

var bsearch = require('binary-search-bounds')

function State(t, x, v, s) {
  this.t = t
  this.x = x
  this.v = v
  this.s = s
}

function Trajectory(states, createTime, destroyTime) {
  this.states       = states
  this.createTime   = createTime
  this.destroyTime  = destroyTime
}

var proto = Trajectory.prototype

proto.exists = function(t) {
  return (t >= this.createTime) && (t <= this.destroyTime)
}

function compareT(state, t) {
  return state.t - t
}

proto.x = function(t, result) {
  if(t > this.destroyTime || t < this.createTime) {
    return null
  }
  var idx = bsearch.le(this.states, t, compareT)
  if(idx < 0) {
    return null
  }
  var a = this.states[idx]
  var dt = t - a.t
  if(!result) {
    result = a.x.slice()
  } else {
    result[0] = a.x[0]
    result[1] = a.x[1]
  }
  for(var i=0; i<2; ++i) {
    result[i] += dt * a.v[i]
  }
  return result
}

proto.v = function(t, result) {
  if(t > this.destroyTime || t < this.createTime) {
    return null
  }
  var idx = bsearch.le(this.states, t, compareT)
  if(idx < 0) {
    return null
  }
  var a = this.states[idx]
  if(!result) {
    result = a.v.slice()
  } else {
    result[0] = a.v[0]
    result[1] = a.v[1]
  }
  return result
}

proto.setVelocity = function(t, v) {
  var states = this.states
  states.push(new State(t, this.x(t), v.slice(), states[states.length-1].s))
}

proto.setState = function(t, value) {
  states.push(new State(t, this.x(t), this.v(t), value))
}

proto.destroy = function(t) {
  var x   = this.x(t)
  var idx = bsearch.le(this.states, t, compareT)
  this.states = this.states.slice(0, idx)
  this.states.push(new State(t, x, [0,0], states[states.length-1].s))
  this.destroyTime = t
}

proto.toJSON = function() {
  return this
}

function createTrajectory(t, x, v) {
  var initState = new State(t, x.slice(), v.slice())
  return new Trajectory([initState], t, Infinity)
}

function fromJSON(object) {
  var createTime  = +object.createTime
  var destroyTime = +object.destroyTime
  return new Trajectory(object.states.map(function(s) {
    return new State(s.t, s.x.slice(), s.v.slice(), s.state)
  }), createTime, destroyTime)
}