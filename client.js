'use strict'

var url             = require('parsed-url')
var createCanvas    = require('canvas-testbed')
var vkey            = require('vkey')
var colormap        = require('colormap')
var createWorld     = require('./world')
var createEvent     = require('./event')
var intersectCauchy = require('./intersect-cauchy')

var socket        = new WebSocket('ws://' + url.host)
var world, player, heartbeatInterval
var netLag        = 0.15
var netMass       = 0.05

var colors = colormap({
  colormap: 'jet',
  nshades:  256,
  format:   'rgb'
})

var SYMBOLS = {
  'flag':     ['⚑',0.3,0.38],
  'player':   ['☺',0,0.36],
  'bullet':   ['⁍',0,0.37],
  'score':    ['',0,0]
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

      var entity = world._entityIndex[event.id]
      var lagEstimate = 1.25*((world.clock.now()-entity.lastUpdate) + world.syncRate)
      if(entity && entity.active) {
        if(entity._netLag) {
          entity._netLag = (1.0-netMass)*entity._netLag + netMass*lagEstimate
        } else {
          entity._netLag = 4.0*lagEstimate
        }
      }
    break

    case 'sync':
      netLag = (1.0-netMass) * netLag + netMass * (world.clock.now() - event.then)
      world.clock.interpolate(event.now)
    break
  }
}

socket.onerror = socket.onclose = function() {
  console.log('lost connection to server')
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

    if(keyState['<shift>']) {
      if(!world.clock._bulletTime) {
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
      shootDirection[0] = world.bulletSpeed*v[0]/vl
      shootDirection[1] = world.bulletSpeed*v[1]/vl
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

    if(keyState['<space>']) {
      if(player.data.lastShot + world.shootRate < t) {
        var shootEvent = createEvent({
          type: 'shoot',
          t:    t,
          now:  t,
          id:   player.id,
          x:    player.trajectory.x(t),
          v:    shootDirection
        })
        world.handleEvent(shootEvent)
        socket.send(JSON.stringify(shootEvent))
      }
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
  } else if(player.trajectory.destroyTime < Infinity && !sentKillMessage) {
    sentKillMessage = true
    socket.send(JSON.stringify({
      type: 'move',
      id:   player.id,
      now:  t,
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
  if(x) {

    if(world.clock.elapsedBulletTime() > 0.9 * world.maxRTT) {
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
      var t = Math.max(Math.min(e.lastUpdate, now-e._netLag), e.trajectory.createTime)
      var x = e.trajectory.x(t)
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
      t = Math.min(t, t0 + d/world.speedOfLight)
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
      var y = (i-height/2) * scale
      var x = (j-width/2) * scale
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

  context.fillStyle = 'black'
  context.fillRect(0, 0, width, height)

  //Draw center line
  context.strokeStyle = 'grey'
  context.beginPath()
  context.moveTo(0,0.5*height)
  context.lineTo(width,0.5*height)
  context.stroke()

  context.font = '0.5px sans-serif'
  context.textAlign ='center'
  context.textBaseline = 'middle'
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

  //drawCauchy(context, 2*width, 2*height, phi, t0, t1)

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
        context.fillText(SYMBOLS['flag'][0], x[0]+0.4, x[1]-0.4)
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
  }
}