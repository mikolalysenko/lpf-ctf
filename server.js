'use strict'

var PORTNUM = 8080

var beefy     = require('beefy')
var http      = require('http')
var path      = require('path')
var ws        = require('ws')
var nextafter = require('nextafter')

var createWorld = require('./world')
var createEvent = require('./event')

//Initialize http server, websockets and beefy
var beefyHandler = beefy({
  entries: [ path.join(__dirname, 'client.js') ],
  cwd:      __dirname,
  live:     true,
  quiet:    false,
  watchify: false 
})
var server = http.createServer(function(req, res) {
  return beefyHandler(req, res)
})
var wss = new ws.Server({ 
  server:         server,
  clientTracking: false
})
server.listen(PORTNUM)
console.log('listening on:', PORTNUM)

//World state
var world = createWorld()

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
    clients[i].socket.send(message)
  }
}

//Handle connections
wss.on('connection', function(socket) {

  //Try adding player to the world
  var player = world.createPlayer()

  //Broadcast event
  broadcast({
    type: 'join',
    t:    player.lastUpdate,
    id:   player.id,
    x:    player.trajectory.events[0].x,
    team: player.team
  })

  //Send initial state
  socket.send({
    type: 'init',
    id: player.id,
    world: world.toJSON()
  })
  
  //Save player connection
  var connection = {
    player: player,
    socket: socket 
  }
  clients.push(connection)

  //Handle events from player
  socket.on('message', function(data) {
    var event = createEvent.parse(data)
    if(!event || 
       event.id !== player.id ||
      !world.validateEvent(event)) {
      return
    }
    broadcast(event, player.id)
    world.handleEvent(event)
  })

  //Check timeout on socket
  function checkTimeout() {
    if(player.lastUpdate + world.maxRTT < world.clock.now()) {
      disconnect()
    }
  }
  var timeoutInterval = setInterval(checkTimeout, 0.25 * world.maxRTT)

  //When socket closes, destroy player
  var closed = false
  function disconnect() {
    if(closed) {
      return
    }
    if(timeoutInterval) {
      clearInterval(timeoutInterval)
      timeoutInterval = null
    }
    var idx = clients.indexOf(connection)
    if(idx >= 0) {
      clients.splice(idx, 1)
    }
    if(world.destroyPlayer(
        nextafter(player.lastUpdate, Infinity), 
        player.id)) {
      broadcast({
        type: 'leave',
        id:   player.id,
        t:    player.trajectory.destroyTime
      })
    }
    closed = true
  }
  socket.on('close', disconnect)
  socket.on('error', disconnect)
})