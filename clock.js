'use strict'

module.exports = createClock

var nowMS = require('right-now')

function now() {
  return nowMS() / 1000.0
}

function Clock(shift) {
  this.shift           = shift
  this._target         = shift
  this._interpolating  = false
  this._interpStart    = 0.0
  this._interpRate     = 0.5
  this._bulletTime     = false
  this._bulletScale    = 1.0
  this._bulletStart    = 0.0
  this._bulletShift    = 0.0
}

var proto = Clock.prototype

proto.wall = function() {
  return now()
}

proto.now = function() {
  if(this._bulletTime) {
    return this._bulletScale*(now() - this._bulletStart) + this._bulletShift
  }

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

proto.interpolate = function(targetTime) {
  this._interpStart   = now()
  this._target        = targetTime - now()
  this._interpolating = true
  this._interpRate    = 0.15
}

proto.startBulletTime = function(slowFactor) {
  if(this._bulletTime) {
    this.stopBulletTime()
  }
  var ctime = this.now()
  this._bulletScale = slowFactor
  this._bulletStart = now()
  this._bulletShift = ctime
  this._bulletTime  = true
}

proto.stopBulletTime = function() {
  if(!this._bulletTime) {
    return
  }
  var ctime           = this.now()
  var t               = now()
  var elapsedTime     = t - this._bulletStart
  this._bulletTime    = false
  this._interpStart   = t
  this._target        = elapsedTime + this._bulletShift
  this._interpolating = true
  this._interpRate    = 0.15
  this.shift          = ctime - t
}

proto.bulletDelay = function() {
  if(this._bulletTime) {
    return this.elapsedBulletTime() * (1.0 - this._bulletScale)
  }
  var interp = this.now()
  var target = now() + this._target
  return Math.max(target-interp, 0)
}

proto.elapsedBulletTime = function() {
  if(!this._bulletTime) {
    return
  }
  return now() - this._bulletStart
}

function createClock(wallTime) {
  var shift = wallTime - now()
  return new Clock(shift)
}