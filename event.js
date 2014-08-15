'use strict'

module.exports       = createEvent
module.exports.parse = parseEvent

function InitEvent(id, world) {
  this.type  = 'init'
  this.id    = id
  this.world = world
}

function JoinEvent(t, now, x, id, team) {
  this.type = 'join'
  this.t    = t
  this.now  = now
  this.x    = x
  this.id   = id
  this.team = team
}

function LeaveEvent(t, now, x, id) {
  this.type = 'leave'
  this.t    = t
  this.now  = now
  this.x    = x
  this.id   = id
}

function MoveEvent(t, now, x, id, v) {
  this.type = 'move'
  this.t    = t
  this.now  = now
  this.x    = x
  this.id   = id
  this.v    = v
}

function ShootEvent(t, now, x, id, v) {
  this.type = 'shoot'
  this.t    = t
  this.now = now
  this.x    = x
  this.id   = id
  this.v    = v
}

//Turn description of event into object
function createEvent(object) {
  if(Object.type === 'init') {
    return new InitEvent(
      ''+object.id,
      object.world)
  }

  if(typeof object.id !== 'string' ||
     typeof object.t  !== 'number' ||
     object.t < 0 ||
     isNaN(object.t) ||
     !Array.isArray(object.x) ||
     object.x.length !== 2) {
    return null
  }

  switch(object.type) {
    case 'join':
      if(!Array.isArray(object.x)) {
        return null
      }
      return new JoinEvent(
        +object.t,
        +object.now,
        [ +object.x[0], +object.x[1] ],
        ''+object.id,
        ''+object.team) 
    break

    case 'shoot':
      if(!Array.isArray(object.v)) {
        return null
      }
      return new ShootEvent(
        +object.t,
        +object.now,
        [ +object.x[0], +object.x[1] ],
        ''+object.id,
        [ +object.v[0], +object.v[1] ])
    break

    case 'move':
      if(!Array.isArray(object.v)) {
        return null
      }
      return new MoveEvent(
        +object.t,
        +object.now,
        [ +object.x[0], +object.x[1] ],
        ''+object.id,
        [ +object.v[0], +object.v[1] ])
    break

    case 'leave':
      return new LeaveEvent(
        +object.t,
        +object.now,
        [ +object.x[0], +object.x[1] ],
        ''+object.id)
    break
  }
  return null
}

//Parse an event
function parseEvent(message) {
  if(typeof message !== 'string') {
    return null
  }
  var object
  try {
    object = JSON.parse(message)
  } catch(e) {
    return null
  }
  return createEvent(object)
}