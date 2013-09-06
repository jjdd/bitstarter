var express = require('express');
var fs = require('fs')
var app = express.createServer(express.logger());

var table_data;
var chart_data;

app.use(express.bodyParser());

app.get('/', function(request, response) {
  var html= fs.readFileSync('index.html').toString()
  var chart_data= fs.readFileSync('country_chart.json').toString()
  var table_json= JSON.parse(fs.readFileSync('table.json').toString())
  var table_data= JSON.stringify([table_json[0]])//send only first element
  var html= html.replace('CHART_DATA',chart_data)
  var html= html.replace('TABLE_DATA',table_data) 
  var html= html.replace('CHAMPION',table_json[0][2]+', '+table_json[0][3]) 
  response.send(html);
});

app.post('/set_table', function(request, response) {
  table_data= JSON.parse(request.body.table);
  console.log(table_data);
  response.send(JSON.stringify(table_data));
});

var port = process.env.PORT || 8000;
app.listen(port, function() {
  console.log("Listening on " + port);
});
