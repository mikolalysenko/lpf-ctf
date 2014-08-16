'use strict'

var url             = require('parsed-url')
var createCanvas    = require('canvas-testbed')
var vkey            = require('vkey')
var createWorld     = require('./world')
var createEvent     = require('./event')
var intersectCauchy = require('./intersect-cauchy')

var socket        = new WebSocket('ws://' + url.host)
var world, player, heartbeatInterval

var SYMBOLS = {
  'flag':     '⚑',
  'player':   '☺',
  'bullet':   '⁍'
}

socket.onmessage = function(socketEvent) {
  var event = createEvent.parse(socketEvent.data)
  if(!event) {
    console.warn('bad event:', socketEvent.data)
    return
  }
  switch(event.type) {
    case 'init':
      initWorld(event.world, event.id)
    break

    case 'join':
    case 'move':
    case 'shoot':
    case 'leave':
      world.clock.interpolate(event.now)
      world.handleEvent(event)
    break
  }
}

socket.onclose = function() {
  console.log('lost connection to server')
}

function initWorld(initState, id) {
  world            = createWorld.fromJSON(initState)
  world.debugTrace = true
  player           = world._entityIndex[id]

  setInterval(heartbeat, 1000.0 * 0.25* world.maxRTT)

  createCanvas(render, { 
    context: '2d'
  })

  //Hook up input handlers
  var keyState = {
    '<left>':   false,
    '<right>':  false,
    '<up>':     false,
    '<down>':   false
  }

  function updateMovement() {
    //Compute new movement event
    var v = [0,0]
    if(keyState['<left>']) {
      v[0] -= 1
    }
    if(keyState['<right>']) {
      v[0] += 1
    }
    if(keyState['<up>']) {
      v[1] -= 1
    }
    if(keyState['<down>']) {
      v[1] += 1
    }

    //Normalize velocity
    var vl = Math.sqrt(Math.pow(v[0],2) + Math.pow(v[1],2))
    if(vl > 1e-4) {
      vl = world.playerSpeed / vl
    }
    v[0] *= vl
    v[1] *= vl

    //Apply movement event
    var t = world.clock.now()
    var cv = player.trajectory.v(t)
    if(cv && Math.abs(v[0]-cv[0]) + Math.abs(v[1]-cv[1]) > 1e-4) {
      var moveEvent = createEvent({
        type: 'move',
        t:    t,
        now:  t,
        id:   player.id,
        x:    player.trajectory.x(t),
        v:    v
      })
      world.handleEvent(moveEvent)
      socket.send(JSON.stringify(moveEvent))
    }
  }

  document.body.addEventListener('keydown', function(event) {
    var key = vkey[event.keyCode]
    if(key in keyState) {
      keyState[key] = true
    }
    updateMovement()
  })

  document.body.addEventListener('keyup', function(event) {
    var key = vkey[event.keyCode]
    if(key in keyState) {
      keyState[key] = false
    }
    updateMovement()
  })

  document.body.addEventListener('blur', function() {
    for(var id in keyState) {
      keyState[id] = false
    }
    updateMovement()
  })
}

function heartbeat() {
  var t = world.clock.now()
  var x = player.trajectory.x(t)
  if(x) {
    socket.send(JSON.stringify({
      type: 'move',
      id:   player.id,
      now:  t,
      t:    t,
      x:    x,
      v:    player.trajectory.v(t)
    }))
  }
}

function render(context, width, height) {
  context.fillStyle = 'black'
  context.fillRect(0, 0, width, height)

  context.font = '0.5px sans-serif'
  context.textAlign ='center'
  context.textBaseline = 'middle'
  context.setTransform(
    height/20.0, 0,
    0, height/20.0,
    width, height)

  //For each entity, draw it dumbly (apply lpf later)
  var t = world.clock.now()
  for(var i=0; i<world.entities.length; ++i) {
    var e = world.entities[i]
    var x = e.trajectory.x(t)
    if(x) {
      if(e.id === player.id) {
        context.fillStyle = 'white'
        context.fillText('☻', x[0], x[1])
      }
      context.fillStyle = e.team
      context.fillText(SYMBOLS[e.type], x[0], x[1])
    }
  }
}