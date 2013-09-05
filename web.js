var express = require('express');
var fs = require('fs')
var app = express.createServer(express.logger());

app.get('/', function(request, response) {
  var html= fs.readFileSync('index.html').toString()
  var chart_data= fs.readFileSync('country_chart.json').toString()
  var table_json= JSON.parse(fs.readFileSync('table.json').toString())
  var table_data= JSON.stringify([table_json[0]])//send only first element
  var html= html.replace('CHART_DATA',chart_data)
  var html= html.replace('TABLE_DATA',table_data) 
  response.send(html);
});

var port = process.env.PORT || 8000;
app.listen(port, function() {
  console.log("Listening on " + port);
});
