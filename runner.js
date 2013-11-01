var server = require('./server/server');

var config = JSON.parse(require('fs').readFileSync('config.json'))

server.start(config.server, config.port);
