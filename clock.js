'use strict'

module.exports = createClock

var now = require('right-now')

function Clock(shift) {
  this.shift           = shift
  this._target         = shift
  this._interpolating  = false
  this._interpStart    = 0.0
  this._interpRate     = 0.5
}

var proto = Clock.proto

proto.now = function() {
  if(this._interpolating) {
    var delta   = this._target - this.shift
    var interpT = now() - this._interpStart
    var offset  = interpT * this._interpRate
    if(delta < 0) {
      this.shift = this.shift - offset
      if(this.shift < this._target) {
        this.shift = this._target
        this._interpolating = false
      }
    } else if(delta > 0) {
      this.shift = this.shift + offset
      if(this.shift > this.target) {
        this.shift = this._target
        this._interpolating = false
      }
    } else {
      this._interpolating = false
    }
  }
  return now() + this.shift
}

proto.reset = function(currentTime) {
  this.shift          = currentTime - now()
  this._interpolating = false
}

proto.interpolate = function(targetTime, rate) {
  this._interpStart   = now()
  this._target        = targetTime - now()
  this._interpolating = true
  this._interpRate    = rate || 0.5
}

function createClock(wallTime) {
  var shift = wallTime - now()
  return new Clock(shift)
}