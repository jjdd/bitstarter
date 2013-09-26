var express = require('express');
var fs = require('fs');
var http = require('http');
var app = express.createServer(express.logger());

var table_json;
var chart_json;

//used for json parsing
app.use(express.bodyParser());


var utci_values= [-40   ,0        ,22     ,36      ,46];
var utci_colors= ['indigo','cyan','green','yellow','red'];
var utci_matrix= [[75,0,130],[0,255,255],[0,128,0],[255,255,0],[255,0,0]];

var UTCIColor= function(u){
	if (u<=-40) return "rgb(75,0,130)";
	if (u>= 46) return "rgb(255,0,0)";
	var i= utci_values.reduce(function(x,y){if (y>u) return x; else return x+1;},-1);
	r0= utci_matrix[i][0];
	g0= utci_matrix[i][1];
	b0= utci_matrix[i][2];
	r1= utci_matrix[i+1][0];
	g1= utci_matrix[i+1][1];
	b1= utci_matrix[i+1][2];
	u0= utci_values[i];
	u1= utci_values[i+1];
	r= r0 + Math.round((r1-r0)*(u-u0)/(u1-u0));
	g= g0 + Math.round((g1-g0)*(u-u0)/(u1-u0));
	b= b0 + Math.round((b1-b0)*(u-u0)/(u1-u0));
	return "rgb("+r.toString()+","+g.toString()+","+b.toString()+")";
};

var UTCIStyle= function(utci){return "<strong class='caption' style='color:" + UTCIColor(utci) + "'>" + utci.toString() + "&deg;C </strong>";};

var NWPColor= function(nwp){
	if(nwp>500){
		//  y0 +            (y1 - y0)*(x  - x0)/dx 
		g= 220 + Math.round((128-220)*(nwp-500)/500);
		r= 220 + Math.round(  (0-220)*(nwp-500)/500);
		b= 0;
	}
	else
	{
		g= 128 + Math.round((220-128)*nwp/500);
		r= 128 + Math.round((220-128)*nwp/500);
		b= 128 + Math.round(  (0-128)*nwp/500);		
	}
	return "rgb("+r.toString()+","+g.toString()+","+b.toString()+")";	 
};

var NWPStyle= function(nwp){return "<strong class='caption' style='color:" + NWPColor(nwp) + "'>" + nwp.toString() + "</strong>";};


var setNWP= function(data){
	for (i in data){
		data[i]= [NWPStyle(data[i][0])].concat(data[i].slice(1));
		}
	return data;
};

var removeTags= function(term){
	term= term.replace(/<[^>]+>/g, '');
	return term;
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
		var search_columns= data[i].slice(1,5).concat(data[i].slice(13,14));// + region
		var found= search_columns.reduce(function(previous,x){return previous || x.toLowerCase().search(search_term)>=0},false);
		table_columns.iata= table_columns.iata || data[i][1].search(term)>=0;
		table_columns.icao= table_columns.icao || data[i][2].search(term)>=0;
		//console.log([term,found,data[i].slice(1,4)]);
		if (found) result.push(data[i].slice(0,1).concat(data[i].slice(1,5).map(function(x){return x.replace(term,'<strong>'+term+'</strong>')}),data[i].slice(5)));	
	}
	return {data:result,columns:table_columns};
};

app.get('/', function(request, response)
{
  var html= fs.readFileSync('index.html').toString();
  var chart_data= fs.readFileSync('country_chart.json').toString();
  var table_json= JSON.parse(fs.readFileSync('table.json').toString());
  var air= JSON.parse(fs.readFileSync('airdata.json').toString());
  
  var champion= table_json.slice(0,10).map(function(x){
	  x[3]=  '<a href="/icao/'+x[2]+'">' + x[3] + '</a>';
	  x[4]=  '<a href="/'+air[x[2]][10]+'">' + x[4] + '</a>';
	  x[9]= UTCIStyle(x[9]);
	  x[11]= '<strong>' + x[11].toString() + '</strong>';//rankings    
	  x[12]= '<strong>' + x[12].toString() + '</strong>';		  
	  return [x[0]].concat(x.slice(3,13));
  });//remove iata,icao by default

  
  var table_data= JSON.stringify(setNWP(champion));//send only first element
  //console.log(table_data);
  html= html.replace('CHART_DATA',chart_data);
  html= html.replace('TABLE_DATA',table_data);
  html= html.replace('CHAMPION',removeTags(table_json[0][3])+', '+removeTags(table_json[0][4]));//city and country 
  html= html.replace('COUNTRY',removeTags(table_json[0][4]));//country
  html= html.replace('CITY',removeTags(table_json[0][3]).split(',')[0]);//city   
  html= html.replace('NUM_LOCATIONS',table_json.length);   
  response.send(html);
});


app.post('/', function(request, response) {
  var html= fs.readFileSync('results.html').toString();
  var table_json= JSON.parse(fs.readFileSync('table.json').toString());
  var countries= JSON.parse(fs.readFileSync('countries.json').toString()); 
  var airports= JSON.parse(fs.readFileSync('airports.json').toString());
  var regions= JSON.parse(fs.readFileSync('regions.json').toString());
  var air= JSON.parse(fs.readFileSync('airdata.json').toString());  

  //collapse spaces, heading and trailing 
  var search_term= collapseSpaces(request.body.search);
  var selected;   
  if (search_term)  selected= getSelection(search_term,table_json); //filter
  else selected= {data:table_json, columns:{iata:false, icao:false}};
     
  //add country chart if term is an unique country
  var c_data= [];
  var country_data= [];
  var country_code= '';
  var country_disp= 'false';
  var resolution= 'countries';
  var sel_countries= [];
  var cterm= search_term.toLowerCase();
  for (coc in countries) {
     if (countries[coc].toLowerCase().search(cterm)>=0){
       sel_countries.push(coc);
     };
  };  
  if(selected.data.length>0 && (sel_countries.length==1 || sel_countries.length==2)){
  	  
     //c_data= selected.data.filter(function(x){return x[4]!=countries[sel_countries[0]]}); 
     c_data= selected.data.map(function(x){
       var city= removeTags(x[3].split(',')[0])+' '+removeTags(x[1]);//city + IATA
       if (x[1]==='   ' || x[1]==='  ' ||  x[1]===' ' ||  x[1]==='') city=  removeTags(x[3].split(',')[0])+' '+removeTags(x[2]);
       var icao= x[2].replace('<strong>','').replace('</strong>','');
       lat= airports[icao][0];
       lon= airports[icao][1];
       return [lat,lon,city,Math.round(x[9]),x[0]];//city + ICAO
    });
     country_data= JSON.stringify([['Lat','Lon','City','UTCI','Points'],[0.0,0.0,'',0,0],[0.0,0.0,'',0,1000]].concat(c_data));
     country_disp= 'true';
     sel_cod= sel_countries.reduce(function(x,y){
     	 if(countries[x].length<countries[y].length) return x; else return y;
     	},sel_countries[0]); 
     country_code= sel_cod; 
  };
  
  if (selected.data.length>0 && country_disp==='false'){

  //add United States Region chart if term is an unique Region
  var r_data= [];
  var sel_regions= [];
  for (reg in regions) {
     if (regions[reg].toLowerCase().search(cterm)>=0){
       sel_regions.push(reg);
     };
  };  
  if(sel_regions.length==1 || sel_regions.length==2){
  	  
     r_data= selected.data.map(function(x){
       var city= removeTags(x[3].split(',')[0])+' '+removeTags(x[1]);//city + IATA
       if (x[1]==='   ' || x[1]==='  ' ||  x[1]===' ' ||  x[1]==='') city=  removeTags(x[3].split(',')[0])+' '+removeTags(x[2]);
       lat= airports[x[2]][0];
       lon= airports[x[2]][1];
       return [lat,lon,city,x[9],x[0]];//city + ICAO
    });
     country_data= JSON.stringify([['Lat','Lon','City','UTCI','Points']].concat(r_data));
     country_disp= 'true';
     sel_cod= sel_regions.reduce(function(x,y){
     	 if(regions[x].length<regions[y].length) return x; else return y;
     	},sel_regions[0]); 
     country_code= 'US-'+sel_cod;
     resolution= 'provinces';
  };

	//console.log(JSON.stringify(sel_regions));
	};


  // remove the unused columns
  selected.data= selected.data.map(function(x){
  		x= x.slice(0,13);
        var icao= removeTags(x[2]);
  		x[3]=  '<a href="/icao/'+icao+'">' + x[3] + '</a>';
  		x[4]=  '<a href="/'+air[icao][10]+'">' + x[4] + '</a>';
  	    x[9]= UTCIStyle(x[9]);
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
  html= html.replace(/SEARCH_TERM/g,search_term);  
  html= html.replace('NUM_LOCATIONS',selected.data.length); 
  html= html.replace('COUNTRY_DATA',country_data);
  html= html.replace('COUNTRY_CODE',country_code);
  html= html.replace('COUNTRY_DISP',country_disp);
  html= html.replace('RESOLUTION',resolution);
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

  var options5 = {
    host: 'www.locusamoenus.eu',
    port: 80,
    path: '/us_chart.json'
  };
  var file5 = fs.createWriteStream("us_chart.json");
  http.get(options5, function(response) {
    response.pipe(file5);
  });

  var options6 = {
		    host: 'www.locusamoenus.eu',
		    port: 80,
		    path: '/eu_chart.json'
  };
  var file6 = fs.createWriteStream("eu_chart.json");
  http.get(options6, function(response) {
		    response.pipe(file6);
  });  

  var options7 = {
		    host: 'www.locusamoenus.eu',
		    port: 80,
		    path: '/airdata.json'
};
var file7 = fs.createWriteStream("airdata.json");
http.get(options7, function(response) {
		    response.pipe(file7);
});    
  
});

app.get('/us', function(request, response) {
  var html= fs.readFileSync('us.html').toString();
  var chart_data= fs.readFileSync('us_chart.json').toString();
  var table_json= JSON.parse(fs.readFileSync('table.json').toString());
  var regions= JSON.parse(fs.readFileSync('regions.json').toString()); 
  var air= JSON.parse(fs.readFileSync('airdata.json').toString());
  
  table_json= table_json.filter(function(x){
  		return x[4]=='United States';
  	});

  var champion= table_json.slice(0,10).map(function(x){
	  
	  var name= x[3].split(', ');
	  x[3]= name[0];  
	  x[4]= regions[name[1]];  
	  
	  x[3]=  '<a href="/icao/'+x[2]+'">' + x[3] + '</a>';
	  x[4]=  '<a href="/us/'+air[x[2]][9]+'">' + x[4] + '</a>';
	  x[9]= UTCIStyle(x[9]);
	  x[11]= '<strong>' + x[11].toString() + '</strong>';//rankings    
	  x[12]= '<strong>' + x[12].toString() + '</strong>';		  
	  return [x[0]].concat(x.slice(3,13));
  });//remove iata,icao by default
  
  var city= removeTags(champion[0][1]);
  var region= removeTags(champion[0][2]);
  var table_data= JSON.stringify(setNWP(champion));//send only first element
  
  //console.log(table_data);
  html= html.replace('CHART_DATA',chart_data);
  html= html.replace('TABLE_DATA',table_data);
  html= html.replace('CHAMPION',city+', '+region);//city and State
  html= html.replace('STATE',region);
  html= html.replace('CITY',city);//city   
  html= html.replace('NUM_LOCATIONS',table_json.length);   
  response.send(html);
});

var EUROPE= ["Guernsey", "Jersey", "Aland Islands", "Denmark", "Estonia", "Finland",
             "Faroe Islands", "United Kingdom", "Ireland", "Isle Of Man", "Iceland",
             "Lithuania", "Latvia", "Norway", "Sweden", "Svalbard And Jan Mayen",
             "Austria", "Belgium", "Switzerland", "Germany", "France",
             "Liechtenstein", "Luxembourg", "Monaco", "Netherlands",
             "Bulgaria", "Belarus", "Czech Republic", "Hungary", "Moldova", "Poland",
             "Romania", "Russia", "Slovakia", "Ukraine", "Andorra", "Albania",
             "Bosnia And Herzegovina", "Spain", "Gibraltar", "Greece", "Croatia",
             "Italy", "Montenegro", "Macedonia", "Malta", "Serbia", "Serbia",
             "Portugal", "Slovenia", "San Marino", "Vatican City"];//, "Turkey"]


app.get('/eu', function(request, response) {
	  var html= fs.readFileSync('eu.html').toString();
	  var chart_data= fs.readFileSync('eu_chart.json').toString();
	  var table_json= JSON.parse(fs.readFileSync('table.json').toString());
	  var air= JSON.parse(fs.readFileSync('airdata.json').toString());
	  
	  table_json= table_json.filter(function(x){
	  		return  EUROPE.reduce(function(y,z){return y || z.search(x[4])>=0;},false);
	  	});

	  var champion= table_json.slice(0,10).map(function(x){
		  x[3]=  '<a href="/icao/'+x[2]+'">' + x[3] + '</a>';
		  x[4]=  '<a href="/'+air[x[2]][10]+'">' + x[4] + '</a>';
		  x[9]= UTCIStyle(x[9]);
		  x[11]= '<strong>' + x[11].toString() + '</strong>';//rankings    
		  x[12]= '<strong>' + x[12].toString() + '</strong>';		  
		  return [x[0]].concat(x.slice(3,13));
	  });//remove iata,icao by default
	  
	  var ccity= removeTags(champion[0][1]);
	  var ccountry= removeTags(champion[0][2]);
	  var table_data= JSON.stringify(setNWP(champion));//send only 10 element
	  
	  
	  //console.log(table_data);
	  html= html.replace('CHART_DATA',chart_data);
	  html= html.replace('TABLE_DATA',table_data);
	  html= html.replace('CHAMPION',ccity+', '+ccountry);//city and State
	  html= html.replace('CITY',ccity);//city   
	  html= html.replace('NUM_LOCATIONS',table_json.length);   
	  response.send(html);
	});

app.all('/icao/*', function (req, res) {
	console.log(req.params);
	var icao= req.params[0];
	var html= fs.readFileSync('icao.html').toString();
	var table_json= JSON.parse(fs.readFileSync('table.json').toString());
	var air= JSON.parse(fs.readFileSync('airdata.json').toString());
	var row= table_json.filter(function(x){return x[2]===icao;})[0];
	if (row[4]==="United States"){
		row[3]= row[3].split(',')[0] + ', ' + row[13]; 
	}
	html= html.replace(/ICAO/g,icao);//usado para las graficas
	html= html.replace(/POIN/g,NWPStyle(row[0]));
	html= html.replace(/CITY/g,row[3]);
	html= html.replace(/COUN/g,row[4]);
	html= html.replace(/WEAT/g,row[5]);
	html= html.replace(/TEMP/g,row[6]);
	html= html.replace(/WIND/g,Math.round(row[7],1));
	html= html.replace(/HUMI/g,row[8]);
	html= html.replace(/UTCI/g,UTCIStyle(row[9]));
	html= html.replace(/TIME/g,row[10]);
	html= html.replace(/CRAN/g,row[11]);
	html= html.replace(/WRAN/g,row[12]);
	
	var name= '';
	//if (air[icao][1]!==row[3]) name= '<p class="lead">'+air[icao][1]+'</p>';
	html= html.replace(/NAME/g,name);
	
	html= html.replace(/LATI/g,air[icao][6]);
	html= html.replace(/LONG/g,air[icao][5]);	
	
	var badge= '<span class="badge" style="background-color:'+NWPColor(row[0]) +'; font-size: 36px; height: 40px;line-height: 36px">'+row[0]+'</span>';
	html= html.replace(/BADGE/g,badge);	
	var desc= row[5].match(/title='([^']*)'/)[1];
	html= html.replace(/DESC/g,desc);
	res.send(html);

	//title='light drizzle; fog'
});

app.all('/us/*', function(req, res) {
	  var rec= req.params[0];
	  
	  var html= fs.readFileSync('country.html').toString();
	  var table_json= JSON.parse(fs.readFileSync('table.json').toString());
	  var airports= JSON.parse(fs.readFileSync('airports.json').toString());
	  var regions= JSON.parse(fs.readFileSync('regions.json').toString());
	  var air= JSON.parse(fs.readFileSync('airdata.json').toString());

      selected= {data:table_json.filter(function (x){return air[x[2]][9]==rec;}), columns:{iata:false, icao:false}};
	     
	  //add country chart
	  var country_name= regions[rec];
	  var country_code= 'US-'+rec;
	  var resolution= 'provinces';  
	  
	  var c_data= selected.data.map(function(x){
	       var city= x[3].split(',')[0]+' '+x[1];//city + IATA
	       if (x[1]==='   ' || x[1]==='  ' ||  x[1]===' ' ||  x[1]==='') city=  x[3].split(',')[0]+' '+x[2];
	       lat= airports[x[2]][0];
	       lon= airports[x[2]][1];
	       return [lat,lon,{v:x[2],f:city},x[9],x[0]];//city + ICAO
	    });
	  var country_data= JSON.stringify([['Lat','Lon','City','UTCI','Points'],[0.0,0.0,'',0,0],[0.0,0.0,'',0,1000]].concat(c_data));
	 
	  // remove the unused columns
	  selected.data= selected.data.map(function(x){
	  		x= x.slice(0,13);
	  		x[3]=  '<a href="/icao/'+x[2]+'">' + x[3].split(',')[0] + '</a>';
	  	    x[9]= UTCIStyle(x[9]);
	        x[11]= '<strong>' + x[11].toString() + '</strong>';//rankings
	        x[12]= '<strong>' + x[12].toString() + '</strong>';
	  	    
	        //country es redundante
	        x= x.slice(0,4).concat(x.slice(5));
	        
	        if (!selected.columns.iata && !selected.columns.icao) x=[x[0]].concat(x.slice(3));
	  	  	if (!selected.columns.iata &&  selected.columns.icao) x=[x[0]].concat(x.slice(2));
	  	  	if ( selected.columns.iata && !selected.columns.icao) x=x.slice(0,2).concat(x.slice(3));
	  	 
	  	  	return x;  	  			
	  });
	  
  
	  var table_data= JSON.stringify(setNWP(selected.data));
	  var table_columns= JSON.stringify(selected.columns);
	  html= html.replace('TABLE_DATA',table_data);
	  html= html.replace('TABLE_COLUMNS',table_columns);    
	  html= html.replace('NUM_LOCATIONS',selected.data.length); 
	  html= html.replace('COUNTRY_DATA',country_data);
	  html= html.replace('COUNTRY_CODE',country_code);
	  html= html.replace('COUNTRY_NAME',country_name);  	  
	  html= html.replace('RESOLUTION',resolution);
	  res.send(html);  
	});

app.all('/*', function (req, res) {
	  var coc= req.params[0];
	  var countries= JSON.parse(fs.readFileSync('countries.json').toString()); 
	  
	  if (typeof countries[coc] === "undefined"){
		  res.send("Invalid");
	  }
	  else
	  {
	  
	  var html= fs.readFileSync('country.html').toString();
	  var table_json= JSON.parse(fs.readFileSync('table.json').toString());
	  var airports= JSON.parse(fs.readFileSync('airports.json').toString());
	  var air= JSON.parse(fs.readFileSync('airdata.json').toString());

      selected= {data:table_json.filter(function (x){return air[x[2]][10]==coc}), columns:{iata:false, icao:false}};
	     
	  //add country chart
	  var country_code= coc;
	  var country_name= countries[coc];
	  var resolution= 'countries';

	  var c_data= selected.data.map(function(x){
	       var city= x[3].split(',')[0]+' '+x[1];//city + IATA
	       if (x[1]==='   ' || x[1]==='  ' ||  x[1]===' ' ||  x[1]==='') city=  removeTags(x[3].split(',')[0])+' '+removeTags(x[2]);
	       var icao= x[2];
	       lat= airports[icao][0];
	       lon= airports[icao][1];
	       return [lat,lon,{v:x[2],f:city},Math.round(x[9]),x[0]];
	    });
	  var country_data= JSON.stringify([['Lat','Lon','City','UTCI','Points'],[0.0,0.0,'',0,0],[0.0,0.0,'',0,1000]].concat(c_data));

	  // remove the unused columns
	  selected.data= selected.data.map(function(x){
	  			x= x.slice(0,13);
		  		x[3]=  '<a href="/icao/'+x[2]+'">' + x[3] + '</a>';
		  	    x[9]= UTCIStyle(x[9]);
		  		x[11]= '<strong>' + x[11].toString() + '</strong>';//rankings
	            x[12]= '<strong>' + x[12].toString() + '</strong>';
		        //country es redundante
		        x= x.slice(0,4).concat(x.slice(5));
	  	  		if (!selected.columns.iata && !selected.columns.icao) x=[x[0]].concat(x.slice(3));
	  	  		if (!selected.columns.iata &&  selected.columns.icao) x=[x[0]].concat(x.slice(2));
	  	  		if ( selected.columns.iata && !selected.columns.icao) x=x.slice(0,2).concat(x.slice(3));
	  	  		return x;  	  			
	  });
	  
	  var table_data= JSON.stringify(setNWP(selected.data));
	  var table_columns= JSON.stringify(selected.columns);
	  html= html.replace('TABLE_DATA',table_data);
	  html= html.replace('TABLE_COLUMNS',table_columns);    
	  html= html.replace('NUM_LOCATIONS',selected.data.length); 
	  html= html.replace('COUNTRY_DATA',country_data);
	  html= html.replace('COUNTRY_CODE',country_code);
	  html= html.replace('COUNTRY_NAME',country_name);  	  
	  html= html.replace('RESOLUTION',resolution);
	  res.send(html);
	  
	  }

});



var port = process.env.PORT || 8000;
app.listen(port, function() {
  console.log("Listening on " + port);
});
