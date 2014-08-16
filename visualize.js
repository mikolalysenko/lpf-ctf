'use strict'

var xhr = require('xhr')
var createVisualizer = require('./worldvis')

xhr({ 
  uri: '/world'
}, function(err, resp, body) {
  if(err) {
    console.error(err)
    return
  }
  createVisualizer(JSON.parse(body))
})