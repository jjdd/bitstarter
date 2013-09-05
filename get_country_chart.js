var http = require('http');
var fs= require('fs');

var options = {
  host: 'www.locusamoenus.eu',
  port: 80,
  path: '/country_chart.json'
};

var file = fs.createWriteStream("country_chart.json");

http.get(options, function(response) {
  response.pipe(file);
});

var http = require('http');
var fs = require('fs');

