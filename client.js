'use strict'

var url             = require('parsed-url')
var createCanvas    = require('canvas-testbed')
var vkey            = require('vkey')
var colormap        = require('colormap')
var RtcDataStream = require('rtc-data-stream')
var quickconnect = require('rtc-quickconnect')
var eos = require('end-of-stream')
var extend             = require('xtend')
var createWorld     = require('./world')
var createEvent     = require('./event')
var intersectCauchy = require('./intersect-cauchy')

var RTC_ROOM_NAME = 'latency-perception-filter'

var netLag        = 0.1
var netMass       = 0.05
var lagMass       = 0.001
var world, player, heartbeatInterval, deadTimeout

var TEST_BULLET_TIME = false

var colors = colormap({
  colormap: 'jet',
  nshades:  256,
  format:   'rgb'
})

var SYMBOLS = {
  'flag':     ['⚑',0,0.25],
  'player':   ['☺',0,0.25],
  'bullet':   ['⁍',0,0.25],
  'score':    ['',0,0]
}

// var socket        = new WebSocket('ws://' + url.host)
// socket.onmessage = onMessage
// socket.onerror = socket.onclose = onConnectionClose
var networkStream = null

// quickconnect('https://switchboard.rtc.io/', { room: RTC_ROOM_NAME })
quickconnect('https://switchboard.rtc.io/', { room: RTC_ROOM_NAME })
  .createDataChannel('primary')
  .on('channel:opened:primary', function(peerId, channel) {

    console.log('peer found')
    networkStream = RtcDataStream(channel)
    networkStream.on('data', onMessage)
    eos(networkStream, onConnectionClose)

})



function onConnectionClose() {
  console.log('lost connection to server')
  destroyWorld()
}

function sendMessage(data){
  networkStream.push(JSON.stringify(data))
}

function onMessage(event) {
  handleMessage(JSON.parse(event))
}

function handleMessage(event) {
  var event = createEvent.parse(event.data)
  if(!event) {
    console.warn('bad event:', event.data)
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

      //world.clock.interpolate(event.now)
      world.handleEvent(event)

      var entity = world._entityIndex[event.id]
      entity._netLag = world.maxBulletTime
    break

    case 'sync':
      netLag = (1.0-netMass) * netLag + netMass * (world.clock.wall() - event.then)

      world.clock.interpolate(event.now)
    break
  }
}

function destroyWorld(){
  world = null
}

function initWorld(initState, id) {
  world            = createWorld.fromJSON(initState)
  world.debugTrace = true
  player           = world._entityIndex[id]
  netLag          = 2.0*world.syncRate

  setInterval(heartbeat, 1000.0 * world.syncRate)

  var gadget = createCanvas(render, { 
    context: '2d',
    retina: false
  })

  //Hook up input handlers
  var keyState = {
    '<left>':   false,
    '<right>':  false,
    '<up>':     false,
    '<down>':   false,
    '<space>':  false,
    '<shift>':  false
  }

  var shootDirection = [world.bulletSpeed,0]

  function updateMovement() {
    if(!world) {
      return
    }

    if(TEST_BULLET_TIME || keyState['<shift>']) {
      if(!world.clock._bulletTime  && (world.clock.bulletDelay()+netLag) < 0.1*world.maxBulletTime) {
        console.log('bullet time on')
        world.clock.startBulletTime(0.5)
      }
    } else {
      if(world.clock._bulletTime) {
        console.log('bullet time off')
        world.clock.stopBulletTime()
      }
    }

    //Compute new movement event
    var movementVector = [0,0]
    if(keyState['<left>']) {
     movementVector[0] -= 1
    }
    if(keyState['<right>']) {
      movementVector[0] += 1
    }
    if(keyState['<up>']) {
      movementVector[1] -= 1
    }
    if(keyState['<down>']) {
      movementVector[1] += 1
    }


    //Normalize velocity
    const minimumDeltaThreshold = 1e-4
    var velocity = Math.sqrt(Math.pow(movementVector[0],2) + Math.pow(movementVector[1],2))
    if(velocity > minimumDeltaThreshold) {
      shootDirection[0] = world.bulletSpeed*movementVector[0]/velocity
      shootDirection[1] = world.bulletSpeed*movementVector[1]/velocity
      velocity = world.playerSpeed / velocity
    }
    movementVector[0] *= velocity
    movementVector[1] *= velocity

    var time = world.clock.now()
    //Apply movement event
    
    var playerTrajectoryVector = player.trajectory.v(time)
    if(playerTrajectoryVector && Math.abs(movementVector[0]-playerTrajectoryVector[0]) + Math.abs(movementVector[1]-playerTrajectoryVector[1]) > minimumDeltaThreshold) {
      var moveEvent = createEvent({
        type: 'move',
        x:    player.trajectory.x(time),
        v:    v
      })
      emitEvent(moveEvent)
    }

    if(keyState['<space>']) {
      if(player.data.lastShot + world.shootRate < time) {
        var shootEvent = createEvent({
          type: 'shoot',
          x:    player.trajectory.x(time),
          v:    shootDirection
        })
        emitEvent(shootEvent)
      }
    }

    function emitEvent(event){
      event = extend(event, {
        t:    time,
        now:  world.clock.wall(),
        id:   player.id,
      })
      world.handleEvent(event)
      sendMessage(JSON.stringify(event))
    }
  }

  document.body.addEventListener('keydown', function(event) {
    var key = vkey[event.keyCode]
    if(key in keyState) {
      keyState[key] = true
    }
    if(key === 'A') {
      //TEST_BULLET_TIME = true
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

  function handleBlur() {
    for(var id in keyState) {
      keyState[id] = false
    }
    updateMovement()
  }
  document.body.addEventListener('blur', handleBlur)
  window.addEventListener('blur', handleBlur)
}


var sentKillMessage = false
function heartbeat() {
  if(!world) {
    return
  }
  var t = world.clock.now()
  var n = world.clock.wall()
  var x = player.trajectory.x(t)
  if(x) {
    sendMessage(JSON.stringify({
      type: 'move',
      id:   player.id,
      now:  n,
      t:    t,
      x:    x,
      v:    player.trajectory.v(t)
    }))
  } else if(player.trajectory.destroyTime < Infinity && !sentKillMessage) {
    sentKillMessage = true
    sendMessage(JSON.stringify({
      type: 'move',
      id:   player.id,
      now:  n,
      t:    t,
      x:    player.trajectory.states[player.trajectory.states.length-1].x,
      v:    player.trajectory.states[player.trajectory.states.length-1].v
    }))
  }
}


function tickLocal() {
  if(!world) {
    return
  }
  var t = world.clock.now()
  var x = player.trajectory.x(t)

  if(TEST_BULLET_TIME && !world.clock._bulletTime  && (world.clock.bulletDelay()+netLag+world.syncRate) < 0.1*world.maxBulletTime) {
    console.log('bullet time on')
    world.clock.startBulletTime(0.5)
  }
    
  if(x) {

    if(world.clock.bulletDelay()+netLag > world.maxBulletTime) {
      console.log('bullet time drained')
      world.clock.stopBulletTime()
    }

    world.handleEvent(createEvent({
      type: 'move',
      id:   player.id,
      now:  t,
      t:    t,
      x:    x,
      v:    player.trajectory.v(t)
    }))
  } else if(!sentKillMessage) {
    heartbeat()
  }
}

function computeCauchySurface(deltaT) {
  var now            = world.clock.now()
  var horizonPoints  = []
  var t0             = now
  var t1             = now
  for(var i=0; i<world.entities.length; ++i) {
    var e = world.entities[i]
    if(e.id === player.id) {
      continue
    }
    if(e.active && e._netLag) {
      var t = Math.min(e.lastUpdate, t1-(e._netLag + 2.0*netLag))
      var x = e.trajectory.x(Math.max(t, e.trajectory.createTime))
      horizonPoints.push([t, x[0], x[1]])
      t0 = Math.min(t0, t)
    }
  }
  function phi(x,y) {
    var t = t1
    for(var i=0; i<horizonPoints.length; ++i) {
      var p = horizonPoints[i]
      var t0 = p[0]
      var dx = p[1] - x
      var dy = p[2] - y
      var d  = Math.max(Math.sqrt(Math.pow(dx,2) + Math.pow(dy,2))-world._interactionRadius, 0)
      //t = Math.min(t, t0 + d/world.speedOfLight)

      var d2 = d/world.speedOfLight
      t = Math.min(t, t0 + (t1-t0)*(1-Math.exp(-3.0*d2)))
    }
    return t
  }
  return [phi, t0, t1]
}

function drawCauchy(context, width, height, phi, t0, t1) {
  var imgData = context.getImageData(0, 0, width, height)
  var scale   = 24/height
  var ptr     = 0
  for(var i=0; i<height; ++i) {
    for(var j=0; j<width; ++j) {
      var y = (i-0.5*height) * scale
      var x = (j-0.5*width) * scale
      var t = phi(x, y)
      var idx = (255 * (t - t0) / (t1 - t0))|0
      var color = colors[idx]
      for(var k=0; k<3; ++k) {
        imgData.data[ptr++] = color[k]
      }
      imgData.data[ptr++] = 255
    }
  }
  context.putImageData(imgData,0,0)
}

function render(context, width, height) {

  context.setTransform(1,0,0,1,0,0)

  if(world.clock._bulletTime) {
    context.fillStyle = 'rgba(0,0,0,0.05)'
    context.fillRect(0, 0, width, height)
  } else {
    context.fillStyle = 'black'
    context.fillRect(0, 0, width, height)
  }

  //Draw center line
  context.strokeStyle = 'grey'
  context.beginPath()
  context.moveTo(0,0.5*height)
  context.lineTo(width,0.5*height)
  context.stroke()

  context.font = '0.5pt sans-serif'
  context.textAlign ='center'
  context.textBaseline = 'bottom'
  context.setTransform(
    height/24.0, 0,
    0, height/24.0,
    0.5*width, 0.5*height)

  if(!world) {
    context.fillStyle = 'white'
    context.fillText('lost connection to server', 0,0)
    return
  }

  var prevTick = world._lastTick
  tickLocal()
  var deltaT = world._lastTick - prevTick

  //Compute cauchy surface
  var surfaceData = computeCauchySurface(deltaT)
  var phi = surfaceData[0]
  var t0  = surfaceData[1]
  var t1  = surfaceData[2]

  //drawCauchy(context, width, height, phi, t0, t1)

  if(world.clock._bulletTime) {
    context.fillStyle = 'rgba(255,255,255,0.15)'
    context.fillText('BULLET TIME', 0,-10)
  }

  //For each entity, draw it dumbly (apply lpf later)
  var redScore  = 0
  var blueScore = 0
  for(var i=0; i<world.entities.length; ++i) {
    var e = world.entities[i]
    var t = intersectCauchy(phi, e.trajectory, t0, t1)
    if(t < 0) {
      continue
    }
    if(e.type === 'score') {
      var s = e.trajectory.state(t)
      if(e.team === 'red') {
        redScore  = +s
      } else {
        blueScore = +s
      }
    }
    var x = e.trajectory.x(t)
    if(x) {
      var s = e.trajectory.state(t)
      if(e.type === 'player' && s.indexOf('carry') >= 0) {
        //Draw flag
        if(Math.random() < 0.5) {
          context.fillStyle = 'white'
        } else if(e.team === 'red') {
          context.fillStyle = 'blue'
        } else {
          context.fillStyle = 'red'
        }
        context.fillText(SYMBOLS['flag'][0], x[0]+0.2, x[1]-0.2)
      }
      if(e.type === 'flag' && 
        !(s === 'ready' || s === 'dropped')) {
        continue
      }

      var symbol = SYMBOLS[e.type]
      if(e.id === player.id) {
        context.fillStyle = 'white'
        context.fillText('☻', x[0]+symbol[1], x[1]+symbol[2])
      }

      context.fillStyle = e.team
      if(e.type === 'bullet') {
        var v = e.trajectory.v(t)
        var theta = Math.atan2(v[1], v[0])
        context.save()
        context.translate(x[0], x[1])
        context.rotate(theta)
        context.fillText(symbol[0], symbol[1], symbol[2])
        context.restore()
      } else {
        context.fillText(symbol[0], x[0]+symbol[1], x[1]+symbol[2])
      }
    }
  }

  context.fillStyle = 'red'
  context.fillText(''+redScore, -10,-10)

  context.fillStyle = 'blue'
  context.fillText(''+blueScore, 10,10)

  //At start of game pop up instructions
  if(t1 <= player.trajectory.createTime) {
    context.fillStyle = 'white'
    context.fillText('arrow keys move. space shoots.', 0, 0)
  } else if(player.trajectory.destroyTime < Infinity) {
    context.fillStyle = 'white'
    context.fillText('you died.', 0, 0)

    if(!deadTimeout) {
      deadTimeout = setTimeout(function() {
        location.reload()
      }, 2500)
    }
  }
}