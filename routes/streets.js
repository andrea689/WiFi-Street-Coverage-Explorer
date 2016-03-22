"use strict";

var mongojs = require("mongojs");
var moment = require('moment');
var turf = require("turf");

var databaseUrl;
var wifidb;
var wifiCollection;

exports.setDatabases = function(db,wdb,wc) {
	databaseUrl = db;
	wifidb = wdb;
	wifiCollection=wc;
};

exports.findRectWifi = function(req, res) {
    var lng = req.params.lng*1;
    var lat = req.params.lat*1;
    var lng2 = req.params.lng2*1;
    var lat2 = req.params.lat2*1;
  	var year = req.params.year*1;
		var provider = "";
		if(req.params.provider)
			provider = req.params.provider;

		var from = moment(year+"-01-01 00:00:00").toDate();
		var to = moment(year+"-12-31 23:59:59").toDate();
		
		var mydb = mongojs(wifidb, [wifiCollection]);
		
	  mydb[wifiCollection].find({"properties.ssid": {$regex:provider, $options: 'i'}, "properties.lasttime": {$gte: from, $lt: to}, geometry:{$geoWithin:{$box:[[lng,lat],[lng2,lat2]]}}}, {_id:false}, function(err, features) {
      mydb.close();
			res.send({ type: "FeatureCollection", timestamp: new Date(), features: features});
		});
};

exports.findRectCoverage2 = function(req, res) {

  var lng = req.params.lng*1;
  var lat = req.params.lat*1;
  var lng2 = req.params.lng2*1;
  var lat2 = req.params.lat2*1;
  var year = req.params.year*1;
  var radius = req.params.radius*1;
	var cellWidth = req.params.width*1;
	var provider = "";
	if(req.params.provider)
		provider = req.params.provider;
	
	var resultsetCollection = "resultset_"+cellWidth+"_"+provider+"_"+year+"_"+radius;
	var mydb = mongojs(databaseUrl, [resultsetCollection]);
	
  mydb[resultsetCollection].find({geometry:{$geoWithin:{$geometry:{type:"Polygon",coordinates:[[[lng,lat],[lng,lat2],[lng2,lat2],[lng2,lat],[lng,lat]]]}}}}, {_id:false}, function(err, features) {
    if(err) console.log(err);
		var coverageLength = 0;
		for(var i=0; i<features.length; i++){
			coverageLength += turf.lineDistance(features[i], 'kilometers');
		}
		mydb.close();
		res.send({ type: "FeatureCollection", timestamp: new Date(), features: features, length: coverageLength});
	});
		
};

exports.findRectTurinBBOXComplex = function(req, res) {
  var lng = req.params.lng*1;
  var lat = req.params.lat*1;
  var lng2 = req.params.lng2*1;
  var lat2 = req.params.lat2*1;
	
	var mydb = mongojs(databaseUrl, ["turinBBOXComplex"]);
	
  mydb.turinBBOXComplex.find({geometry:{$geoWithin:{$geometry:{type:"Polygon",coordinates:[[[lng,lat],[lng,lat2],[lng2,lat2],[lng2,lat],[lng,lat]]]}}}}, {_id:false}, function(err, features) {
		var streetLength = 0;
		for(var i=0; i<features.length; i++){
			streetLength += turf.lineDistance(features[i], 'kilometers');
		}
		mydb.close();
		res.send({ type: "FeatureCollection", timestamp: new Date(), features: features, length: streetLength});
	});
		
}

exports.readMatrix = function(req,res){

  var year = req.params.year*1;
  var radius = req.params.radius*1;
	var cellWidth = req.params.width*1;
	var provider = "";
	if(req.params.provider)
		provider = req.params.provider;
	
	var matrixCollection = "matrix_"+cellWidth+"_"+provider+"_"+year+"_"+radius;
	var mydb = mongojs(databaseUrl, [matrixCollection]);
	
	var features = [];
  mydb[matrixCollection].find({}).sort({"geometry.coordinates":1}).limit(1000, function(err, featuresA) {
		if(err) console.log(err);
		features = features.concat(featuresA);
		mydb[matrixCollection].find({}).sort({"geometry.coordinates":1}).limit(1000).skip(1000, function(err, featuresB) {
			if(err) console.log(err);
			features = features.concat(featuresB);
			mydb[matrixCollection].find({}).sort({"geometry.coordinates":1}).limit(1000).skip(2000, function(err, featuresC) {
				if(err) console.log(err);
				features = features.concat(featuresC);
				mydb[matrixCollection].find({}).sort({"geometry.coordinates":1}).limit(1000).skip(3000, function(err, featuresD) {
					if(err) console.log(err);
					features = features.concat(featuresD);
					var posX = 0;
					var posY = 0;
					var prevY = null;
					features.forEach(function(feature){
						if(prevY==null){
							prevY = feature.geometry.coordinates[0][0][0];
						}
						else if(prevY==feature.geometry.coordinates[0][0][0]){
							posY++;
						}else{
							posY=0;
							posX++;
						}
						feature.properties.posX=posX;
						feature.properties.posY=posY;
						//console.log(posX+" - "+posY);
						prevY = feature.geometry.coordinates[0][0][0];
					});
					mydb.close();
					res.send({ type: "FeatureCollection", timestamp: new Date(), features: features});
				});
			});
		});
	});
}
