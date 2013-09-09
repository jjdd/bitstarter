var express = require('express');
var fs = require('fs')
var http = require('http');
var app = express.createServer(express.logger());

var table_json;
var chart_json;

//used for json parsing
app.use(express.bodyParser());


var NWPStyle= function(nwp){
   var maxval= 128;	
   var yellowFact= maxval*(500-Math.abs(nwp-500))/500;
	var red= Math.round((1000-nwp)/1000*maxval+yellowFact);
	var green= Math.round(nwp/1000*maxval+yellowFact);
	return "<strong class='caption' style='color: rgb("+red.toString()+","+green.toString()+",50)'>"+ nwp.toString() + "</strong>";	 
	};

var setNWP= function(data){
	for (i in data){
		data[i]= [NWPStyle(data[i][0])].concat(data[i].slice(1));
		}
	return data;
	};

var collapseSpaces= function(term){
	term= term.replace(/\s+/g, ' ');
  	term= term.replace(/\s+$/g, '');
  	term= term.replace(/^\s+/g, '');
	return term;
};

var getSelection= function(term,data){
	var result= [];
	var table_columns= {iata: false, icao: false};
	var search_term= term.toLowerCase();
	for (i in data){
		var found= data[i].slice(1,5).reduce(function(previous,x){return previous || x.toLowerCase().search(search_term)>=0},false);
		table_columns.iata= table_columns.iata || data[i][1].search(term)>=0;
		table_columns.icao= table_columns.icao || data[i][2].search(term)>=0;
		//console.log([term,found,data[i].slice(1,4)]);
		if (found) result.push(data[i].slice(0,1).concat(data[i].slice(1,5).map(function(x){return x.replace(term,'<strong>'+term+'</strong>')}),data[i].slice(5)));	
	}
	return {data:result,columns:table_columns};
};

app.get('/', function(request, response) {
  var html= fs.readFileSync('index.html').toString();
  var chart_data= fs.readFileSync('country_chart.json').toString();
  var table_json= JSON.parse(fs.readFileSync('table.json').toString());
  var champion= [[table_json[0][0]].concat(table_json[0].slice(3))];//remove iata,icao by default
  champion[0][8]= '<strong>' + champion[0][8].toString() + '</strong>';//rankings
  champion[0][9]= '<strong>' + champion[0][9].toString() + '</strong>';
  var table_data= JSON.stringify(setNWP(champion));//send only first element
  console.log(table_data);
  html= html.replace('CHART_DATA',chart_data);
  html= html.replace('TABLE_DATA',table_data);
  html= html.replace('CHAMPION',table_json[0][3]+', '+table_json[0][4]);//city and country 
  html= html.replace('COUNTRY',table_json[0][4]);//country 
  html= html.replace('NUM_LOCATIONS',table_json.length);   
  response.send(html);
});

app.post('/', function(request, response) {
  var html= fs.readFileSync('results.html').toString();
  var chart_data= fs.readFileSync('country_chart.json').toString();
  var table_json= JSON.parse(fs.readFileSync('table.json').toString());
  var table_data;
  
  //collapse spaces, heading and trailing 
  var search_term= collapseSpaces(request.body.search)
  var table_columns= JSON.stringify();//remove by default
  var selected;   
  if (search_term)  selected= getSelection(search_term,table_json); //filter
  else selected= {data:table_json, columns:{iata:false, icao:false}};
  
  selected.data= selected.data.map(function(x){
         x[10]= '<strong>' + x[10].toString() + '</strong>';//rankings
         x[11]= '<strong>' + x[11].toString() + '</strong>';
  	  		if (!selected.columns.iata && !selected.columns.icao) x=[x[0]].concat(x.slice(3));
  	  		if (!selected.columns.iata &&  selected.columns.icao) x=[x[0]].concat(x.slice(2));
  	  		if ( selected.columns.iata && !selected.columns.icao) x=x.slice(0,2).concat(x.slice(3));
  	  		return x;  	  			
  });// remove the unused columns

  var table_data= JSON.stringify(setNWP(selected.data));
  var table_columns= JSON.stringify(selected.columns);
  html= html.replace('TABLE_DATA',table_data);
  html= html.replace('TABLE_COLUMNS',table_columns);    
  html= html.replace('SEARCH_TERM',search_term);  
  html= html.replace('NUM_LOCATIONS',selected.data.length); 
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
