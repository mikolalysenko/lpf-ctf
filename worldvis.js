'use strict'

module.exports = createWorldVisualizer

var createShell   = require('gl-now')
var createCamera  = require('game-shell-orbit-camera')
var createAxes    = require('gl-axes')
var createLine    = require('gl-line-plot')
var createScatter = require('gl-scatter-plot')
var glm           = require('gl-matrix')
var mat4          = glm.mat4

var SYMBOLS = {
  'flag':     '⚑',
  'player':   '☺',
  'bullet':   '⁍'
}

var COLORS  = {
  'red':     [1,0,0],
  'blue':    [0,0,1]
}

function createWorldVisualizer(world) {

  var shell = createShell({
    clearColor: [0,0,0,0],
    tickRate:   5
  })

  var camera = createCamera(shell)
  var lines  = []
  var points = []
  var axes   = null
  var bounds = [[-10, -10, 0],
                [ 10,  10, world.now]]
  var model  = [1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 40.0/world.now, 0,
                0, 0, -20, 1]
  var tickScale = bounds[1][2]/25.0

  camera.lookAt(
    [5,-50,5],
    [0,0,0],
    [0,0,1])

  var ticks = [ [], [], [] ]

  for(var i=-10; i<=10; ++i) {
    ticks[0].push({
      x:    i,
      text: ''+i
    })
    ticks[1].push({
      x:    i,
      text: ''+i
    })
  }
  for(var i=0; i<25; ++i) {
    ticks[2].push({
      x:    i*tickScale,
      text: Math.round(i*tickScale)
    })
  }


  shell.on('gl-init', function() {

    var gl = shell.gl

    axes = createAxes(gl, {
      bounds:         bounds,
      ticks:          ticks,
      labels:         ['x', 'y', 't'],
      lineMirror:     true,
      lineTickEnable: true,
      lineTickLength: [0.25, 0.25, 0.25],
      zeroEnable:     [true, true, false],
      gridColor:      [0.8, 0.8, 0.8]
    })

    for(var i=0; i<world.entities.length; ++i) {
      var e         = world.entities[i]
      if(e.type === 'score') {
        continue
      }
      var symbol    = SYMBOLS[e.type]
      var color     = COLORS[e.team]
      var pointList = []
      for(var j=0; j<e.trajectory.states.length; ++j) {
        var s = e.trajectory.states[j]
        pointList.push([s.x[0], s.x[1], s.t])
      }
      lines.push(createLine(gl, {
        position:   pointList,
        color:      color,
        lineWidth:  1
      }))
      points.push(createScatter(gl, {
        position:     pointList,
        color:        color,
        glyph:        symbol,
        size:         12,
        orthographic: true
      }))
    }
  })

  shell.on('gl-render', function() {
    var gl = shell.gl
    gl.enable(gl.DEPTH_TEST)

    //Compute camera parameters
    var cameraParameters = {
      view: camera.view(),
      projection: mat4.perspective(
          mat4.create(),
          Math.PI/4.0,
          shell.width/shell.height,
          0.1,
          1000.0),
      model: model
    }

    //Draw all objects
    axes.draw(cameraParameters)
    for(var i=0; i<lines.length; ++i) {
      lines[i].draw(cameraParameters)
    }
    for(var i=0; i<points.length; ++i) {
      points[i].draw(cameraParameters)
    }
  })
}