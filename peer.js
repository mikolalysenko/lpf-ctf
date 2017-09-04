var Server = require('./server.js')
var Client = require('./client.js')

var isServer = (window.location.search.slice(1) === 'server')

if (isServer) {
  Server()
} else {
  Client()
}