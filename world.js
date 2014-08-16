'use strict'

module.exports          = createWorld
module.exports.fromJSON = worldFromJSON

var createClock     = require('./clock')
var createEntity    = require('./entity')
var minkowski       = require('./minkowski')
var intersectCauchy = require('./intersect-cauchy')

function World(
    speedOfLight, 
    maxRTT, 
    debugTrace, 
    playerSpeed, 
    bulletSpeed,
    shootRate,
    bulletLife,
    entities, 
    clock) {
  //Constants
  this.speedOfLight = speedOfLight
  this.maxRTT       = maxRTT
  this.playerSpeed  = playerSpeed
  this.bulletSpeed  = bulletSpeed
  this.shootRate    = shootRate
  this.bulletLife   = bulletLife

  this.entities     = entities

  this.clock        = clock
  
  //Logging and debug flags
  this.debugTrace   = debugTrace
  
  this._lastTick      = 0.0
  this._horizonEvents = []
  this._entityIndex   = {}
}

var proto = World.prototype

proto.createEntity = function(params) {
  params = params|| {}
  
  var t       = params.t      || this.clock.now()
  var id      = params.id     || '' + this.entities.length
  var x       = params.x      || [0,0]
  var v       = params.v      || [0,0]
  var type    = params.type   || ''
  var team    = params.team   || ''
  var data    = params.data   || null
  var active  = params.active || false
  var state   = params.state  || null

  var entity  = createEntity(t, id, x, v, type, team, data, active)
  entity.trajectory.states[0].s = state
  this.entities.push(entity)
  this._entityIndex[id] = entity
  return entity
}

proto.destroyEntity = function(t, id) {
  var entity = this._entityIndex[id]
  if(!entity || 
     !entity.trajectory.exists(t)) {
    return false
  }
  entity.active     = false
  entity.lastUpdate = t
  entity.trajectory.destroy(t)
}

proto.createPlayer = function() {
  return this.createEntity({
    t:      this.clock.now() + this.maxRTT,
    type:   'player',
    team:   (Math.random() < 0.5 ? 'red' : 'blue'),
    active: true,
    data:   {
      numShots: 0,
      lastShot: 0
    }
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
         !entity.trajectory.exists(event.t)) {
        console.log('invalid entity')
        return false
      }
      //Check that event is in future light cone
      var t0 = entity.lastUpdate
      var x0 = entity.trajectory.x(t0)
      if(t0 < event.t &&
         minkowski.dist2(x0, t0, event.x, event.t, this.speedOfLight) > 0) {
        return false
      }

      //Check event specific constraints
      var v = event.v
      var vl = Math.sqrt(Math.pow(v[0],2), + Math.pow(v[1],2))
      if(event.type === 'move') {
        if(vl > this.playerSpeed + 1e-4) {
          return false
        }
      }
      if(event.type === 'shoot') {
        if(Math.abs(vl - this.bulletSpeed) < 1e-4) {
          console.log('reject shoot: bad speed', vl, this.bulletSpeed)
          return false
        }
        if(this.shootRate + entity.data.lastShot >= event.t) {
          console.log('reject shoot: too fast')
          return false
        }
      }

      return true
    break
  }
  return false
}

function simulate(world, oldHorizon, newHorizon) {
}

proto.handleEvent = function(event) {

  if(this.debugTrace) {
    console.log('event:', event)
  }

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
      var entity = this._entityIndex[event.id]
      entity.trajectory.setVelocity(event.t, event.v)
      entity.lastUpdate = event.t
    break

    case 'shoot':
      var entity    = this._entityIndex[event.id]
      var t         = event.t
      var bulletId  = event.id + '.' + (entity.data.numShots++)
      entity.data.lastShot = t
      var bullet = this.createEntity({
        id: bulletId,
        t: t,
        x: event.x,
        v: event.v,
        type: 'bullet',
        team: entity.team
      })
      bullet.trajectory.destroy(t + this.bulletLife)
    break

    case 'leave':
      this.destroyEntity(event.t, event.id)
    break
  }
  this._lastTick = this.clock.now()
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
    if(e.trajectory.x(e.lastUpdate, he)) {
      events.push(he)
    }
  }
  return createHorizon(
      events, 
      this._lastTick,
      1.0/this.speedOfLight)
}

function createWorld(options) {
  options         = options || {}
  var c           = options.speedOfLight || 3.0
  var maxRTT      = options.maxRTT       || 6.0
  var debugTrace  = options.debugTrace   || false
  var bulletSpeed = options.bulletSpeed  || 0.95*c
  var playerSpeed = options.playerSpeed  || 0.8*c
  var shootRate   = options.shootRate    || 0.5
  var bulletLife  = options.bulletLife   || 30.0/c
  return new World(
    c, 
    maxRTT, 
    debugTrace, 
    playerSpeed,
    bulletSpeed,
    shootRate,
    bulletLife,
    [], 
    createClock(0))
}

proto.toJSON = function() {
  return {
    speedOfLight: this.speedOfLight,
    maxRTT:       this.maxRTT,
    playerSpeed:  this.playerSpeed,
    bulletSpeed:  this.bulletSpeed,
    shootRate:    this.shootRate,
    bulletLife:   this.bulletLife,
    now:          this.clock.now(),
    entities: this.entities.map(function(e) {
      return e.toJSON()
    })
  }
}

function worldFromJSON(object) {
  var entities = object.entities.map(createEntity.fromJSON)
  var result   = new World(
    +object.speedOfLight, 
    +object.maxRTT, 
    +object.debugTrace, 
    +object.playerSpeed,
    +object.bulletSpeed,
    +object.shootRate,
    +object.bulletLife,
    entities, 
    createClock(+object.now))
  for(var i=0; i<entities.length; ++i) {
    result._entityIndex[entities[i].id] = entities[i]
  }
  result._lastTick = +object.now
  return result
}