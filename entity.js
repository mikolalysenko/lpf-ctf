'use strict'

module.exports = createEntity
module.exports.fromJSON = entityFromJSON

var createTrajectory = require('./trajectory')

function Entity(
  id, 
  team, 
  type,
  radius,
  lastUpdate, 
  data,
  active,
  trajectory) {
  this.id         = id
  this.team       = team
  this.type       = type
  this.radius     = radius
  this.lastUpdate = lastUpdate
  this.data       = data
  this.active     = active
  this.trajectory = trajectory
}

var proto = Entity.prototype

proto.toJSON = function() {
  return this
}

function createEntity(t, id, x, v, type, team, radius, data, active) {
  return new Entity(
    id,
    team,
    type,
    radius,
    t,
    data,
    active,
    createTrajectory(t, x, v))
}

function entityFromJSON(object) {
  var trajectory = createTrajectory.fromJSON(object.trajectory)
  return new Entity(
    object.id,
    object.team,
    object.type,
    +object.radius,
    +object.lastUpdate,
    object.data||null,
    !!object.active,
    trajectory)
}