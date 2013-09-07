var express = require('express');
var fs = require('fs')
var http = require('http');
var app = express.createServer(express.logger());

var table_json;
var chart_json;

//used for json parsing
app.use(express.bodyParser());

var getSelection= function(term,data){
	var result= [];
	for (i in data){
		var found= data[i].slice(1,4).reduce(function(previous,x){return previous || x.search(term)>=0},false);
		//console.log([term,found,data[i].slice(1,4)]);
		if (found) result.push(data[i].slice(0,1).concat(data[i].slice(1,4).map(function(x){return x.replace(term,'<strong>'+term+'</strong>')}),data[i].slice(4,11)));	
	}
	return result;
};

app.get('/', function(request, response) {
  var html= fs.readFileSync('index.html').toString();
  var chart_data= fs.readFileSync('country_chart.json').toString();
  var table_json= JSON.parse(fs.readFileSync('table.json').toString());
  var table_data= JSON.stringify([table_json[0]]);//send only first element
  var html= html.replace('CHART_DATA',chart_data);
  var html= html.replace('TABLE_DATA',table_data);
  var html= html.replace('CHAMPION',table_json[0][2]+', '+table_json[0][3]); 
  response.send(html);
});

app.post('/', function(request, response) {
  var html= fs.readFileSync('results.html').toString();
  var chart_data= fs.readFileSync('country_chart.json').toString();
  var table_json= JSON.parse(fs.readFileSync('table.json').toString());
  var table_data;
  if (request.body.search){ 
  	 table_data= JSON.stringify(getSelection(request.body.search,table_json));
  	 }
  else
    table_data= JSON.stringify([table_json[0]]);//send only first element
  var html= html.replace('CHART_DATA',chart_data);
  var html= html.replace('TABLE_DATA',table_data);
  var html= html.replace('CHAMPION',table_json[0][2]+', '+table_json[0][3]); 
  response.send(html);
});

app.get('/set_table', function(request, response) {
  //ack
  response.send('ok');
  
  //request and save into file
  var options = {
    host: 'www.locusamoenus.eu',
    port: 80,
    path: '/table.json'
  };
  var file = fs.createWriteStream("table.json");
  http.get(options, function(response) {
    response.pipe(file);
  });
});

app.get('/set_chart', function(request, response) {
  //ack
  response.send('ok');
  
  //request and save into file
  var options = {
    host: 'www.locusamoenus.eu',
    port: 80,
    path: '/country_chart.json'
  };
  var file = fs.createWriteStream("country_chart.json");
  http.get(options, function(response) {
    response.pipe(file);
  });
});

var port = process.env.PORT || 8000;
app.listen(port, function() {
  console.log("Listening on " + port);
});
