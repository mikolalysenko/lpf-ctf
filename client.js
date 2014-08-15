'use strict'

var url           = require('parsed-url')
var createCanvas  = require('canvas-testbed')
var createWorld   = require('./world')
var createEvent   = require('./event')

var socket        = new WebSocket('ws://' + url.host)
var world, playerId

createCanvas(render, { 
  context: '2d'
})

socket.onmessage = function(socketEvent) {
  var event = createEvent.parse(socketEvent.data)
  if(!event) {
    return
  }
  switch(event.type) {
    case 'init':
      world    = createWorld.fromJSON(event.world)
      playerId = event.id
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

function render(context, width, height) {
  context.fillStyle = 'black'
  context.fillRect(0, 0, width, height)

  //For each entity, draw 
}