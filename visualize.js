'use strict'

// var xhr = require('xhr')
var url             = require('parsed-url')
var createVisualizer = require('./worldvis')
var createEvent     = require('./event')

var socket = new WebSocket('ws://' + url.host)

socket.onerror = socket.onclose = function() {
  console.log('lost connection to server')
}

socket.onmessage = onMessage

function onMessage(socketEvent) {
  var event = createEvent.parse(socketEvent.data)

  if(!event) {
    console.warn('bad event:', socketEvent.data)
    return
  }

  console.log(event)
  switch(event.type) {

    case 'init':
      // initWorld(event.world, event.id)
      createVisualizer(event.world)
    break

    case 'join':
    case 'move':
    case 'shoot':
    case 'leave':
    var entity = this._entityIndex[event.id]
      entity.trajectory.setVelocity(event.t, event.v)
      entity.lastUpdate = event.t
      
      // //world.clock.interpolate(event.now)
      // world.handleEvent(event)

      // var entity = world._entityIndex[event.id]
      // entity._netLag = world.maxBulletTime
    break

    case 'sync':
      // netLag = (1.0-netMass) * netLag + netMass * (world.clock.wall() - event.then)

      // world.clock.interpolate(event.now)
    break
  }
}

// xhr({ 
//   uri: '/world'
// }, function(err, resp, body) {
//   if(err) {
//     console.error(err)
//     return
//   }
//   createVisualizer(JSON.parse(body))
// })