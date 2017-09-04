'use strict'
var RTC_ROOM_NAME = 'latency-perception-filter'

var PORTNUM = 8080

var quickconnect = require('rtc-quickconnect');
var webrtc = require('node-webrtc')

quickconnect('https://switchboard.rtc.io/', {
  RTCPeerConnection: webrtc.RTCPeerConnection,
  room: RTC_ROOM_NAME,
})
  .createDataChannel('primary')
  .on('channel:opened:primary', function(peerId, channel) {

    console.log('peer found')
    // networkStream = RtcDataStream(channel)
    // networkStream.on('data', onMessage)
    // eos(networkStream, onConnectionClose)

})

var beefy     = require('beefy')
var http      = require('http')
var path      = require('path')
var url       = require('url')
var ws        = require('ws')
var nextafter = require('nextafter')

var createWorld = require('./world')
var createEvent = require('./event')

//Initialize http server, websockets and beefy
var beefyHandler = beefy({
  entries: [
    'client.js',
    'visualize.js'
  ],
  cwd:      __dirname,
  live:     true,
  quiet:    false,
  watchify: false 
})
var server = http.createServer(function(req, res) {
  var parsedURL = url.parse(req.url)
  if(parsedURL && parsedURL.pathname === '/world' ) {
    res.end(JSON.stringify(world.toJSON()))
    return
  }
  return beefyHandler(req, res)
})

// var wss = new ws.Server({ 
//   server:         server,
//   clientTracking: false
// })
server.listen(PORTNUM)
console.log('listening on:', PORTNUM)

// //World state
// var world = createWorld({
//   debugTrace: true
// })

// //Initialize flags
// world.createFlag({
//   team: 'red',
//   x: [0,-9.5]
// })
// world.createFlag({
//   team: 'blue',
//   x: [0, 9.5]
// })

// //Client list
// var clients = []

// //Handle connections
// wss.on('connection', initNetworking)

// //Broadcast event to all clients
// function broadcast(event, skipID) {
//   event.now = world.clock.now()
//   var message = JSON.stringify(event)
//   for(var i=0; i<clients.length; ++i) {
//     if(clients[i].player.id === skipID) {
//       continue
//     }
//     if(clients[i].network.readyState === ws.OPEN) {
//       clients[i].network.send(message)
//     } else {
//       console.warn('trying to send message to closed socket')
//     }
//   }
// }

// function initNetworking(socket) {

//   socket.on('message', onMessage)
//   socket.on('close', disconnect)
//   socket.on('error', disconnect)

//   var peerConnection = {
//     send: function(data){
//       socket.send(JSON.stringify(data))
//     }
//   }

//   //Try adding player to the world
//   var player = world.createPlayer()

//   //Notify player connected
//   if(world.debugTrace) {
//     console.log('player connected:', player)
//   }

//   //Broadcast event
//   broadcast({
//     type: 'join',
//     t:    player.lastUpdate,
//     id:   player.id,
//     x:    player.trajectory.x(player.lastUpdate),
//     team: player.team
//   })

//   //Send initial state
//   peerConnection.sendMessage({
//     type: 'init',
//     id: player.id,
//     world: world.toJSON()
//   })
  
//   //Save player connection
//   var connection = {
//     player: player,
//     network: peerConnection,
//   }
//   clients.push(connection)

//   //Handle events from player
//   function onMessage(data) {
//     var event = createEvent.parse(data)
//     if(!event || 
//        event.id !== player.id ||
//       !world.validateEvent(event)) {
//       if(world.debugTrace) {
//         console.log('rejected bad event:', event)
//       }
//       return
//     }
//     var then = event.now
//     broadcast(event, player.id)
//     world.handleEvent(event)
//     peerConnection.sendMessage(JSON.stringify({
//       type: 'sync',
//       then:  then,
//       now:   world.clock.now()
//     }))
//   }

//   //Check timeout on socket
//   function checkDisconnect() {
//     if((player.lastUpdate + world.maxRTT < world.clock.now()) || player.destroyT < Infinity) {
//       disconnect()
//     }
//   }
//   var timeoutInterval = setInterval(checkDisconnect, 10)

//   //When socket closes, destroy player
//   var closed = false

//   function disconnect() {
//     if(closed) {
//       return
//     }
//     if(world.debugTrace) {
//       console.log('player disconnect:', player.id)
//     }
//     if(timeoutInterval) {
//       clearInterval(timeoutInterval)
//       timeoutInterval = null
//     }
//     var idx = clients.indexOf(connection)
//     if(idx >= 0) {
//       clients.splice(idx, 1)
//     }
//     var destroyT = player.trajectory.destroyTime
//     if(player.trajectory.destroyTime >= Infinity) {
//       destroyT = nextafter(player.lastUpdate, Infinity)
//     }
//     var destroyEvent = createEvent({
//       type: 'leave',
//       id:   player.id,
//       t:    destroyT,
//       x:    player.trajectory.x(destroyT)
//     })
//     world.handleEvent(destroyEvent)
//     broadcast(destroyEvent)
//     closed = true
//   }
  
// }