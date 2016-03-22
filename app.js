"use strict";

var express = require('express');
var streets = require('./routes/streets');
var geoUtil = require('./utility/geo');
var wifi = require('./utility/wifi');

var fs = require("fs");
var _ = require("underscore");

var commandLineArgs = require('command-line-args');

var cli = commandLineArgs([
	{ name: 'load', alias: 'l', type: Boolean },
	{ name: 'convert', alias: 'C', type: Boolean },
	{ name: 'aggregate', alias: 'a', type: Boolean },
	{ name: 'export', alias: 'e', type: Boolean },
	{ name: 'server', alias: 'S', type: Boolean },
	{ name: 'streets', alias: 's', type: String },
  { name: 'isp', alias: 'i', type: String, multiple: true},
  { name: 'year', alias: 'y', type: Number },
  { name: 'port', alias: 'p', type: Number },
  { name: 'cell', alias: 'c', type: Number },
  { name: 'radius', alias: 'r', type: Number },
  { name: 'db', alias: 'd', type: String },
  { name: 'wifidb', alias: 'w', type: String },
  { name: 'wificollection', alias: 'W', type: String },
  { name: 'config', type: String }
]);

var options = cli.parse();
var config;
if(options.config){
	var obj = fs.readFileSync(options.config, 'utf8');
	config = JSON.parse(obj);
	_.extend(options,config);
}

var databaseUrl = options.db;
var from = options.year;
var to = options.year;
var providers = options.isp || [""];
var cellWidthKm = options.cell;
var radiusMeters = options.radius;
var streetsGeoJsonUrl = options.streets;
var wifidb = options.wifidb;
var wifiCollection = options.wificollection;

if(options.load){
	if(streetsGeoJsonUrl && databaseUrl){
		console.log("Loading streets...");
		geoUtil.loadGeoJsonComplexInDB(streetsGeoJsonUrl, databaseUrl, "turinBBOXComplex").then(function(){
			console.log("Streets Loaded!");
		});
	}else{
		console.log("Usage: node app.js --load --streets <path GeoJson file> --db <database url>");
		console.log("Example: node app.js --load --streets 'Turin.json' --db 'localhost:27017/Explorer'");
	}
}

else if(options.convert){
	if(databaseUrl && wifidb && wifiCollection && radiusMeters){
		console.log("Convert streets...");
		wifi.convertData(databaseUrl, wifidb, wifiCollection, radiusMeters).then(function(){
			console.log("Streets converted!");
		});
	}else{
		console.log("Usage: node app.js --convert --radius <wifi radius in meters> --db <database url> --wifidb <database url of wifi> --wificollection <collection of wifi>");
		console.log("Example: node app.js --convert --radius 50 --db localhost:27017/Explorer --wifidb localhost:27017/Measurements --wificollection wifi");
	}
}

else if(options.aggregate){
	if(databaseUrl && wifidb && wifiCollection && providers && cellWidthKm && radiusMeters && from){
		console.log("Aggregate streets...");
		wifi.createResultsetRecursive(databaseUrl, from, providers, cellWidthKm, radiusMeters, 0,function(){
			wifi.createMatrix(databaseUrl, cellWidthKm).then(function(){
				wifi.createMatrixRecursive(databaseUrl,wifidb,wifiCollection,cellWidthKm,radiusMeters,providers,from,to,0, function(){
					console.log("Streets aggregated!");
				});
			});
		});
	}else{
		console.log("Usage: node app.js --aggregate --isp <ssid filters> --radius <wifi radius in meters> --cell <cell width in kilometers> --year <year> --db <database url>");
		console.log("Example: node app.js --aggregate --isp 'Telecom' 'Alice' '' --radius 50 --cell 1 --year 2015 --db localhost:27017/Explorer");
	}
}

else if(options.export){
	if(databaseUrl && providers && cellWidthKm && radiusMeters && from){
		for(var year=from; year>to-1; year--){
			for(var i=0; i<providers.length; i++){
				wifi.createProviderCSV("export/wifi_coverage_"+cellWidthKm+"_"+providers[i]+"_"+year+"_"+radiusMeters+".csv", databaseUrl, year, providers[i], cellWidthKm, radiusMeters);
			}
		}
	}else{
		console.log("Usage: node app.js --export --isp <ssid filters> --radius <wifi radius in meters> --cell <cell width in kilometers> --year <year> --db <database url>");
		console.log("Example: node app.js --export --isp 'Telecom' 'Alice' '' --radius 50 --cell 1 --year 2015 --db localhost:27017/Explorer");
	}
}

else if(options.server){
	if(databaseUrl && wifidb && wifiCollection){
		var app = express();

		app.use(express.static('public'));

		app.get('/turinBBOXComplex/rect/:lng/:lat/:lng2/:lat2', streets.findRectTurinBBOXComplex);

		app.get('/coverage/rect/:lng/:lat/:lng2/:lat2/:year/:width/:radius', streets.findRectCoverage2);
		app.get('/coverage/rect/:lng/:lat/:lng2/:lat2/:year/:width/:radius/:provider', streets.findRectCoverage2);


		app.get('/wifi/rect/:lng/:lat/:lng2/:lat2/:year', streets.findRectWifi);
		app.get('/wifi/rect/:lng/:lat/:lng2/:lat2/:year/:provider', streets.findRectWifi);

		app.get('/matrix/:year/:width/:radius', streets.readMatrix);
		app.get('/matrix/:year/:width/:radius/:provider', streets.readMatrix);

		streets.setDatabases(databaseUrl,wifidb,wifiCollection);

		var listener = app.listen(options.port || 8443, function(){
			console.log('Listening on port ' + listener.address().port);
		});
	}else{
		console.log("Usage: node app.js --server --db <database url> --wifidb <database url of wifi> --wificollection <collection of wifi>");
		console.log("Example: node app.js --server --db localhost:27017/Explorer --wifidb localhost:27017/Measurements --wificollection wifi");
	}
}

