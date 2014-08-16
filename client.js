'use strict'

var url             = require('parsed-url')
var createCanvas    = require('canvas-testbed')
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
      context.fillStyle = e.team
      context.fillText(SYMBOLS[e.type], x[0], x[1])
    }
  }
}