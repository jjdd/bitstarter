var http = require('http');
var fs= require('fs');

var options = {
  host: 'www.locusamoenus.eu',
  port: 80,
  path: '/table.json'
};

var file = fs.createWriteStream("table.json");

http.get(options, function(response) {
  response.pipe(file);
});

var http = require('http');
var fs = require('fs');

