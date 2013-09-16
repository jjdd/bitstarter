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
  //champion[0][3]= new Date(champion[0][3]);//TIME
  champion[0][9]= '<strong>' + champion[0][9].toString() + '</strong>';//rankings    
  champion[0][10]= '<strong>' + champion[0][10].toString() + '</strong>';
  
  var table_data= JSON.stringify(setNWP(champion));//send only first element
  //console.log(table_data);
  html= html.replace('CHART_DATA',chart_data);
  html= html.replace('TABLE_DATA',table_data);
  html= html.replace('CHAMPION',table_json[0][3]+', '+table_json[0][4]);//city and country 
  html= html.replace('COUNTRY',table_json[0][4]);//country
  html= html.replace('CITY',table_json[0][3]);//city   
  html= html.replace('NUM_LOCATIONS',table_json.length);   
  response.send(html);
});

/*
		[
        ['City',   'Population', 'Area'],
        ['Rome',      2761477,    1285.31],
        ['Milan',     1324110,    181.76],
        ['Naples',    959574,     117.27],
        ['Turin',     907563,     130.17],
        ['Palermo',   655875,     158.9],
        ['Genoa',     607906,     243.60],
        ['Bologna',   380181,     140.7],
        ['Florence',  371282,     102.41],
        ['Fiumicino', 67370,      213.44],
        ['Anzio',     52192,      43.43],
        ['Ciampino',  38262,      11]
      ]
*/

app.post('/', function(request, response) {
  var html= fs.readFileSync('results.html').toString();
  var chart_data= fs.readFileSync('country_chart.json').toString();
  var table_json= JSON.parse(fs.readFileSync('table.json').toString());
  var countries= JSON.parse(fs.readFileSync('countries.json').toString()); 
  var airports= JSON.parse(fs.readFileSync('airports.json').toString());

  //collapse spaces, heading and trailing 
  var search_term= collapseSpaces(request.body.search)
  var selected;   
  if (search_term)  selected= getSelection(search_term,table_json); //filter
  else selected= {data:table_json, columns:{iata:false, icao:false}};
     
  //add country chart if term is an unique country
  var c_data= [];
  var country_code= '';
  var country_disp= 'false';
  var sel_countries= [];
  var cterm= search_term.toLowerCase();
  for (coc in countries) {
     if (countries[coc].toLowerCase().search(cterm)>=0){
       sel_countries.push(coc);
     };
  };  
  if(sel_countries.length==1 || sel_countries.length==2){
  	  
     //c_data= selected.data.filter(function(x){return x[4]!=countries[sel_countries[0]]}); 
     c_data= selected.data.map(function(x){
       var city= x[3]+' '+x[1];//city + IATA
       if (x[1]==='   ' || x[1]==='  ' ||  x[1]===' ' ||  x[1]==='') city= x[3]+' '+x[2];
       lat= airports[x[2]][0]
       lon= airports[x[2]][1]
       return [lat,lon,city,x[0]];//city + ICAO
    });
     country_data= JSON.stringify([['Lat','Lon','City','Points']].concat(c_data));
     country_disp= 'true';
     sel_cod= sel_countries.reduce(function(x,y){
     	 if(countries[x].length<countries[y].length) return x; else return y;
     	},sel_countries[0]); 
     country_code= sel_cod;//sel_countries[0];  
  };

  // remove the unused columns
  selected.data= selected.data.map(function(x){
         x[11]= '<strong>' + x[11].toString() + '</strong>';//rankings
         x[12]= '<strong>' + x[12].toString() + '</strong>';
  	  		if (!selected.columns.iata && !selected.columns.icao) x=[x[0]].concat(x.slice(3));
  	  		if (!selected.columns.iata &&  selected.columns.icao) x=[x[0]].concat(x.slice(2));
  	  		if ( selected.columns.iata && !selected.columns.icao) x=x.slice(0,2).concat(x.slice(3));
  	  		return x;  	  			
  });
  
  var table_data= JSON.stringify(setNWP(selected.data));
  var table_columns= JSON.stringify(selected.columns);
  html= html.replace('TABLE_DATA',table_data);
  html= html.replace('TABLE_COLUMNS',table_columns);    
  html= html.replace('SEARCH_TERM',search_term);  
  html= html.replace('NUM_LOCATIONS',selected.data.length); 
  html= html.replace('COUNTRY_DATA',country_data);
  html= html.replace('COUNTRY_CODE',country_code);
  html= html.replace('COUNTRY_DISP',country_disp);
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
  var options2 = {
    host: 'www.locusamoenus.eu',
    port: 80,
    path: '/regions.json'
  };
  var file2 = fs.createWriteStream("regions.json");
  http.get(options2, function(response) {
    response.pipe(file2);
  });
  var options3 = {
    host: 'www.locusamoenus.eu',
    port: 80,
    path: '/countries.json'
  };
  var file3 = fs.createWriteStream("countries.json");
  http.get(options3, function(response) {
    response.pipe(file3);
  });

  var options4 = {
    host: 'www.locusamoenus.eu',
    port: 80,
    path: '/airports.json'
  };
  var file4 = fs.createWriteStream("airports.json");
  http.get(options4, function(response) {
    response.pipe(file4);
  });

});

var port = process.env.PORT || 8000;
app.listen(port, function() {
  console.log("Listening on " + port);
});
