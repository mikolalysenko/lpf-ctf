'use strict'

module.exports          = createWorld
module.exports.fromJSON = worldFromJSON

var createClock     = require('./clock')
var createEntity    = require('./entity')
var minkowski       = require('./minkowski')
var intersectCauchy = require('./intersect-cauchy')

function World(speedOfLight, maxRTT, entities, clock) {
  this.entities     = []
  this.speedOfLight = speedOfLight
  this.maxRTT       = maxRTT
  this.clock        = clock

  this._horizonEvents = []
  this._entityIndex   = {}
}

var proto = World.prototype

proto.createEntity = function(params) {
  var t       = params.t      || this.clock.now()
  var id      = params.id     || '' + this.entities.length
  var x       = params.x      || [0,0]
  var v       = params.v      || [0,0]
  var type    = params.type   || ''
  var team    = params.team   || ''
  var radius  = params.radius || 0.0
  var data    = params.data   || null
  var active  = params.active || false

  var entity  = createEntity(t, id, x, v, type, team, radius, data, active)
  this.entities.push(entity)
  this._entityIndex[id] = entity
  return entity
}

proto.destroyEntity = function(t, id) {
  var entity = this._entityIndex[id]
  if(!entity || 
      entity.trajectory.destroyed(t)) {
    return false
  }
  entity.active     = false
  entity.lastUpdate = t
  entity.trajectory.destroy(t)
}

proto.createPlayer = function() {
  return createEntity({
    t:      this.clock.now() + this.maxRTT,
    type:   'player',
    team:   (Math.random() < 0.5 ? 'red' : 'blue'),
    active: true
  })
}

proto.validateEvent = function(event) {
  switch(event.type) {
    case 'move':
    case 'shoot':
      //Check entity is valid
      var entity = this._entityIndex[event.id]
      if(!entity || 
          entity.type !== 'player' ||
          entity.destroyed(event.t)) {
        return false
      }
      //Check that event is in future light cone
      var t0 = entity.lastUpdate
      var x0 = entity.trajectory.x(t0)
      if(t0 < event.t &&
         minkowski.dist2(x0, t0, event.x, event.t, c) > 0) {
        return false
      }
      return true
    break
  }
  return false
}

function simulate(world, oldHorizon, newHorizon) {
}

proto.handleEvent = function(event) {
  var oldHorizon = this.horizon()
  switch(event.type) {
    case 'join':
      this.createEntity({
        id:   event.id,
        t:    event.t,
        x:    event.x,
        team: event.team,
        type: 'player'
      })
    break

    case 'move':
    break

    case 'shoot':
    break

    case 'leave':
      this.destroyEntity(event.t, event.id)
    break
  }
  var newHorizon = this.horizon()

  //Simulate all events in oldHorizon \ newHorizon
  simulate(this, oldHorizon, newHorizon)
}

function createHorizon(events, now, cr) {
  var n = events.length
  return function(x,y) {
    for(var i=0; i<n; ++i) {
      var e  = events[i]
      var dx = e[0] - x
      var dy = e[1] - y
      var d  = Math.sqrt(Math.pow(dx,2) + Math.pow(dy,2))
      result = Math.min(e[2] + d * cr, result)
    }
    return result
  }
}

proto.horizon = function() {
  var entities  = this.entities
  var n         = entities.length
  var events    = []
  for(var i=0; i<n; ++i) {
    var e = entities[i]
    if(!e.active || 
        e.destroyTime <= e.lastUpdate) {
      continue
    }
    var he = [0,0,e.lastUpdate]
    if(e.x(e.lastUpdate, he)) {
      events.push(he)
    }
  }
  return createHorizon(
      events, 
      this.clock.now(),
      1.0/this.speedOfLight)
}

function createWorld(options) {
  options       = options || {}
  var c         = options.speedOfLight || 1.0
  var maxRTT    = options.maxRTT       || 3.0
  return new World(c, maxRTT, [], createClock(0))
}

proto.toJSON = function() {
  return {
    speedOfLight: this.speedOfLight,
    maxRTT:       this.maxRTT,
    now:          this.clock.now(),
    entities: this.entities.map(function(e) {
      return e.toJSON()
    })
  }
}

function worldFromJSON(object) {
  var c = +object.speedOfLight
  var entities = object.entities.map(createEntity.fromJSON)
  var result = new World(c, entities, createClock(+object.now))
  for(var i=0; i<entities.length; ++i) {
    result._entityIndex[entities[i].id] = entities[i]
  }
  return result
}