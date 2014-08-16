'use strict'

module.exports          = createWorld
module.exports.fromJSON = worldFromJSON

var createClock     = require('./clock')
var createEntity    = require('./entity')
var minkowski       = require('./minkowski')
var intersectCauchy = require('./intersect-cauchy')
var testHit         = require('./test-hit')

function World(
    speedOfLight, 
    maxRTT, 
    debugTrace, 
    playerSpeed, 
    bulletSpeed,
    shootRate,
    bulletLife,
    playerRadius,
    bulletRadius,
    flagRadius,
    entities, 
    clock) {
  //Constants
  this.speedOfLight = speedOfLight
  this.maxRTT       = maxRTT
  this.playerSpeed  = playerSpeed
  this.bulletSpeed  = bulletSpeed
  this.shootRate    = shootRate
  this.bulletLife   = bulletLife
  this.playerRadius = playerRadius
  this.bulletRadius = bulletRadius
  this.flagRadius   = flagRadius

  this.entities     = entities

  this.clock        = clock
  
  //Logging and debug flags
  this.debugTrace   = debugTrace
  
  this._lastTick          = 0.0
  this._oldestEvent       = 0.0
  this._horizonEvents     = []
  this._entityIndex       = {}
  this._interactionRadius = this.playerRadius + Math.max(this.bulletRadius, this.flagRadius)
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

  var entity  = createEntity(t, id, x, v, type, team, data, active, state)
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

proto.createPlayer = function(params) {
  var numRed    = 0
  var numBlue   = 0
  var entities  = this.entities
  for(var i=0; i<entities.length; ++i) {
    var e = entities[i]
    if(e.type === 'player' && e.active) {
      if(e.team === 'red') {
        numRed += 1
      } else if(e.team === 'blue') {
        numBlue += 1
      }
    }
  }

  var nextTeam = Math.random()
  if(numRed > numBlue) {
    nextTeam = 1.0
  } else {
    nextTeam = 0.0
  }

  params = params || {}
  return this.createEntity({
    id:     params.id,
    t:      params.t || this.clock.now() + this.maxRTT,
    x:      params.x,
    team:   (nextTeam < 0.5 ? 'red' : 'blue'),
    type:   'player',
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
        if(this.debugTrace) {
          console.log('event: invalid entity')
        }
        return false
      }
      //Check that event is in future light cone
      var t0 = entity.lastUpdate
      var x0 = entity.trajectory.x(t0)
      if(t0 < event.t &&
         minkowski.dist2(x0, t0, event.x, event.t, this.speedOfLight) > 0) {
        if(this.debugTrace) {
          console.log('event: violates causality')
        }
        return false
      }

      //Check event specific constraints
      var v = event.v
      var vl = Math.sqrt(Math.pow(v[0],2) + Math.pow(v[1],2))
      if(event.type === 'move') {
        if(vl > this.playerSpeed + 1e-4) {
          if(this.debugTrace) {
            console.log('move event: player too fast')
          }
          return false
        }
      }
      if(event.type === 'shoot') {
        if(Math.abs(vl - this.bulletSpeed) > 1e-4) {
          if(this.debugTrace) {
            console.log('shoot event: bullet too fast -- ', vl/this.bulletSpeed)
          }
          return false
        }
        if(this.shootRate + entity.data.lastShot > event.t) {
          if(this.debugTrace) {
            console.log('shoot event: fired too fast')
          }
          return false
        }
      }

      return true
    break
  }
  if(this.debugTrace) {
    console.log('event: bad type')
  }
  return false
}


function testBullets(world, bullets, players) {
  var n = bullets.length
  var m = players.length
  for(var i=0; i<n; ++i) {
    var bs = bullets[i]
    var b  = bs[0]
    var b0 = bs[1]
    var b1 = bs[2]
    for(var j=0; j<m; ++j) {
      var ps = players[j]
      var p  = ps[0]
      var p0 = ps[1]
      var p1 = ps[2]
      console.log('test hit: [', b0, ',', b1, ']  vs [', p0, ',', p1, ']')
      var t = testHit(
        b.trajectory, 
        p.trajectory,
        Math.max(b0, p0), 
        Math.min(b1, p1),
        world.playerRadius + world.bulletRadius)
      //If hit, destroy player
      if(t > 0) {
        if(world.debugTrace) {
          console.log('bullet hit:', t, p.trajectory.x(t), p.id, b.id, b.team)
        }
        world.destroyEntity(t, p.id)
      }
    }
  }
}

function simulate(world, oldHorizon, newHorizon, t0, t1) {
  //First filter entities into groups
  var teams = {
    red: {
      bullet: [],
      player: [],
      flag:   []
    },
    blue: {
      bullet: [],
      player: [],
      flag:   []
    }
  }
  var entities = world.entities
  for(var i=0, n=entities.length; i<n; ++i) {
    var e = entities[i]
    if(e.trajectory.destroyTime <= t0) {
      continue
    }
    var e0 = intersectCauchy(oldHorizon, e.trajectory, t0, t1)
    var e1 = intersectCauchy(newHorizon, e.trajectory, e0, t1)
    if(e0 < 0 && e1 < 0) {
      continue
    } else if(e0 < 0 && e1 >= 0) {
      e0 = e.trajectory.createTime
    } else if(e1 < 0 && e0 >= 0) {
      e1 = e.trajectory.destroyTime
    }
    if(e1 < e0) {
      continue
    }
    teams[e.team][e.type].push([e, e0, e1])
  }
  //Handle bullet-player interactions
  testBullets(world, teams.red.bullet,  teams.blue.player)
  testBullets(world, teams.blue.bullet, teams.red.player)
  //Handle flag-player interactions
}

proto.handleEvent = function(event) {

  if(this.debugTrace) {
    if(event.type !== 'move') {
      console.log('event:', event)
    }
  }

  var oldHorizon = this.horizon()
  var lowerBoundT = this._oldestEvent
  switch(event.type) {
    case 'join':
      this.createPlayer({
        id:   event.id,
        t:    event.t,
        x:    event.x,
        team: event.team
      })
    break

    case 'move':
      var entity = this._entityIndex[event.id]
      entity.trajectory.setVelocity(event.t, event.v)
      entity.lastUpdate = event.t
    break

    case 'shoot':
      var entity    = this._entityIndex[event.id]

      //Update player position
      entity.trajectory.setVelocity(event.t, entity.trajectory.v(event.t))
      entity.lastUpdate = event.t

      //Spawn bullet
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
  simulate(this, oldHorizon, newHorizon, lowerBoundT, this._lastTick)
}

function createHorizon(events, now, cr, ir) {
  var n = events.length
  return function(x,y) {
    var result = Infinity
    for(var i=0; i<n; ++i) {
      var e  = events[i]
      var dx = e[0] - x
      var dy = e[1] - y
      var d  = Math.max(Math.sqrt(Math.pow(dx,2) + Math.pow(dy,2))-ir, 0.0)
      result = Math.min(e[2] + d * cr, result)
    }
    return result
  }
}

proto.horizon = function() {
  var entities  = this.entities
  var n         = entities.length
  var events    = []
  var oldest    = this._lastTick
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
    oldest = Math.min(oldest, e.lastUpdate)
  }
  this._oldestEvent = oldest
  return createHorizon(
      events, 
      this._lastTick,
      1.0/this.speedOfLight,
      this._interactionRadius)
}

function createWorld(options) {
  options           = options || {}
  var c             = options.speedOfLight || 3.0
  var maxRTT        = options.maxRTT       || 6.0
  var debugTrace    = options.debugTrace   || false
  var bulletSpeed   = options.bulletSpeed  || 0.95*c
  var playerSpeed   = options.playerSpeed  || 0.8*c
  var shootRate     = options.shootRate    || 0.5
  var bulletLife    = options.bulletLife   || 30.0/c
  var playerRadius  = options.playerRadius || 0.5
  var bulletRadius  = options.bulletRadius || 0.25
  var flagRadius    = options.flagRadius   || 0.3
  return new World(
    c, 
    maxRTT, 
    debugTrace, 
    playerSpeed,
    bulletSpeed,
    shootRate,
    bulletLife,
    playerRadius,
    bulletRadius,
    flagRadius,
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
    playerRadius: this.playerRadius,
    bulletRadius: this.bulletRadius,
    flagRadius:   this.flagRadius,
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
    +object.playerRadius,
    +object.bulletRadius,
    +object.flagRadius,
    entities, 
    createClock(+object.now))
  for(var i=0; i<entities.length; ++i) {
    result._entityIndex[entities[i].id] = entities[i]
  }
  result._lastTick = +object.now
  return result
}