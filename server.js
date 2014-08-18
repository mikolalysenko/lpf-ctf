'use strict'

var PORTNUM = 8080

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
var wss = new ws.Server({ 
  server:         server,
  clientTracking: false
})
server.listen(PORTNUM)
console.log('listening on:', PORTNUM)

//World state
var world = createWorld({
  debugTrace: true
})

//Initialize flags
world.createFlag({
  team: 'red',
  x: [0,-9.5]
})
world.createFlag({
  team: 'blue',
  x: [0, 9.5]
})

//Client list
var clients = []

//Broadcast event to all clients
function broadcast(event, skipID) {
  event.now = world.clock.now()
  var message = JSON.stringify(event)
  for(var i=0; i<clients.length; ++i) {
    if(clients[i].player.id === skipID) {
      continue
    }
    if(clients[i].socket.readyState === ws.OPEN) {
      clients[i].socket.send(message)
    } else {
      console.warn('trying to send message to closed socket')
    }
  }
}

//Handle connections
wss.on('connection', function(socket) {

  //Try adding player to the world
  var player = world.createPlayer()

  //Notify player connected
  if(world.debugTrace) {
    console.log('player connected:', player)
  }

  //Broadcast event
  broadcast({
    type: 'join',
    t:    player.lastUpdate,
    id:   player.id,
    x:    player.trajectory.x(player.lastUpdate),
    team: player.team
  })

  //Send initial state
  socket.send(JSON.stringify({
    type: 'init',
    id: player.id,
    world: world.toJSON()
  }))
  
  //Save player connection
  var connection = {
    player: player,
    socket: socket 
  }
  clients.push(connection)

  //Handle events from player
  socket.on('message', function(data) {
    //console.log('raw data:', data)

    var event = createEvent.parse(data)
    if(!event || 
       event.id !== player.id ||
      !world.validateEvent(event)) {
      if(world.debugTrace) {
        console.log('rejected bad event:', event)
      }
      return
    }
    broadcast(event, player.id)
    world.handleEvent(event)
    socket.send(JSON.stringify({
      type: 'sync',
      then:  event.now,
      now:   world.clock.now()
    }))
  })

  //Check timeout on socket
  function checkDisconnect() {
    if((player.lastUpdate + world.maxRTT < world.clock.now()) || player.destroyT < Infinity) {
      disconnect()
    }
  }
  var timeoutInterval = setInterval(checkDisconnect, 10)

  //When socket closes, destroy player
  var closed = false
  function disconnect() {
    if(closed) {
      return
    }
    if(world.debugTrace) {
      console.log('player disconnect:', player.id)
    }
    if(timeoutInterval) {
      clearInterval(timeoutInterval)
      timeoutInterval = null
    }
    var idx = clients.indexOf(connection)
    if(idx >= 0) {
      clients.splice(idx, 1)
    }
    var destroyT = player.trajectory.destroyTime
    if(player.trajectory.destroyTime >= Infinity) {
      destroyT = nextafter(player.lastUpdate, Infinity)
    }
    var destroyEvent = createEvent({
      type: 'leave',
      id:   player.id,
      t:    destroyT,
      x:    player.trajectory.x(destroyT)
    })
    world.handleEvent(destroyEvent)
    broadcast(destroyEvent)
    closed = true
  }
  socket.on('close', disconnect)
  socket.on('error', disconnect)
})