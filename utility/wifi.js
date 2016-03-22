"use strict";

var mongojs = require('mongojs');
var moment = require('moment');
var q = require('q');
var turf = require("turf");
var json2csv = require('json2csv');
var fs = require('fs');
var mkdirp = require('mkdirp');
var getDirName = require('path').dirname;

//

var pageSize = 1000;

exports.convertData = function(databaseUrl, wifidb, wifiCollection, radiusMeters){
	var deferred = q.defer();
	
	var coverageCollection = "coverage"+radiusMeters;
	var mydb = mongojs(databaseUrl, [coverageCollection, "turinBBOXComplex"]);
	var mydb2 = mongojs(wifidb, [wifiCollection]);
		
	var count = 0;
	
  mydb[coverageCollection].remove({}, function(){
	  
		mydb[coverageCollection].ensureIndex({geometry: "2dsphere"}, function(){

			getPage(0, mydb, mydb2, wifiCollection, coverageCollection, radiusMeters, function(){
				mydb.close();
				mydb2.close();
				deferred.resolve();
			}); 
			
		});
  });
  
	return deferred.promise;
}

function getPage(index, mydb, mydb2, wifiCollection, coverageCollection, radiusMeters, callback){
	mydb2[wifiCollection].find({}).skip(index*pageSize).limit(pageSize, function(err, features) {
		if(err){
			console.log(err);
			return;
		}
			
		if(features.length==0)
			return callback();
		
		insert(features, 0, mydb, coverageCollection, radiusMeters, function(){
			index++;
			getPage(index, mydb, mydb2, wifiCollection, coverageCollection, radiusMeters, callback);
		});
		
	});
}

function insert(featuresWifi, position, mydb, coverageCollection, radiusMeters, callback){
	var lenFeaturesWifi = featuresWifi.length;
	
	var featureWifi = featuresWifi[position];
			
  insert2(featureWifi, mydb, coverageCollection, radiusMeters, function(){
		position++;
		if(position==lenFeaturesWifi){
			callback();
		}else{
			insert(featuresWifi, position, mydb, coverageCollection, radiusMeters, callback);
		}
  });
		
}

function insert2(featureWifi, mydb, coverageCollection, radiusMeters, callback){
		
  mydb.turinBBOXComplex.find({geometry:{$near:{$geometry:{type: "Point", coordinates: featureWifi.geometry.coordinates},$maxDistance:radiusMeters}}}, function(err, featuresStreets) {
				
		if(featuresStreets.length==0){
			return callback();
		}
		
	  insert3(featuresStreets, 0, featureWifi, mydb, coverageCollection, radiusMeters, function(){
			callback();
	  });

	
	});
	
}

function insert3(featuresStreets, position, featureWifi, mydb, coverageCollection, radiusMeters, callback){
	var lenFeaturesStreets = featuresStreets.length;
	
	var featureStreet = featuresStreets[position];
	
	var ssid = featureWifi.properties.ssid;
	var netid = featureWifi.properties.netid;
	var lasttime = featureWifi.properties.lasttime;

	featureStreet.properties.street_id = featureStreet._id;
	featureStreet.properties.ssid = ssid;
	featureStreet.properties.netid = netid;
	featureStreet.properties.lasttime = moment(lasttime).toDate();

	delete featureStreet._id;
	
	if(featureStreet.geometry.type == "Polygon"){
		position++;
		if(position==lenFeaturesStreets){
			return callback();
		}else{
			return insert3(featuresStreets, position, featureWifi, mydb, radiusMeters, callback);
		}
	}
	
	mydb[coverageCollection].insert(featureStreet, function(){
		
		position++;
		if(position==lenFeaturesStreets){
			callback();
		}else{
			insert3(featuresStreets, position, featureWifi, mydb, coverageCollection, radiusMeters, callback);
		}
		
	});
	
}

//

exports.createResultsetRecursive = function (databaseUrl, from, providers, cellWidthKm, radiusMeters, count, callback){
	
	createResultset(databaseUrl, from, providers[count], cellWidthKm, radiusMeters).then(function(){
		console.log("ResultSet "+providers[count]+" finished");
		count++;
		if(count==providers.length) return callback(); 
		exports.createResultsetRecursive(databaseUrl, from, providers, cellWidthKm, radiusMeters, count,callback);
	});
	
}

function createResultset (databaseUrl, year, provider, cellWidthKm, radiusMeters){
  var deferred = q.defer();
	
	var coverageCollection = "coverage"+radiusMeters;
	var resultSetCollection = "resultset_"+cellWidthKm+"_"+provider+"_"+year+"_"+radiusMeters;
	var mydb = mongojs(databaseUrl, [coverageCollection, resultSetCollection]);

	var from = moment(year+"-01-01 00:00:00").toDate();
	var to = moment(year+"-12-31 23:59:59").toDate();

	var mapFunction = function() {
		emit(this.properties.street_id, {properties: {street_id:this.properties.street_id, name: this.properties.name}, geometry:this.geometry, type:this.type, count: 1});
	};
	
	var reduceFunction = function(id, values) {
		var result = {count: 0};
		values.forEach(function(value) {
      result.count += value.count;
      result.type = value.type;
      result.geometry = value.geometry;
			result.properties = value.properties;
    });
    return result;
	};

	var options = {
		out: { replace : resultSetCollection},
		query: {
      "properties.lasttime": {
          $gte: from,
          $lt: to
      },
			"properties.ssid": {$regex:provider, $options: 'i'}
		}
	}
	var count = 0;
	var len = 0;
	mydb["coverage"+radiusMeters].mapReduce(mapFunction, reduceFunction, options, function(err, res){
		if(err) console.log(err);
		mydb[resultSetCollection].count({}, function(err, num){
			len = num;
			mydb[resultSetCollection].find({}, function(err, obj){
				obj.forEach(function(item) {
				
			    mydb[resultSetCollection].update({_id: item._id}, item.value, function(err){
				    if(err) console.log(err);
						count++;
						if(count==len){
							mydb.close();
							deferred.resolve();
						}
			    });
				
				});
			});
			
		});
	});
  return deferred.promise;
}

//

exports.createMatrix = function(databaseUrl, cellWidthKm){
	var deferred = q.defer();
	
	var mydb = mongojs(databaseUrl, ["matrix"]);
	
	mydb.matrix.remove({},function(){
		
		var extent = [7.5760,45.0060, 7.7750, 45.1405];
		var cellWidth = cellWidthKm;
		var units = 'kilometers';

		var squareGrid = turf.squareGrid(extent, cellWidth, units);
	
		var count = 0;
		var len = squareGrid.features.length;
	
		squareGrid.features.forEach(function(feature){
			mydb.matrix.insert(feature, function(err, res){
				if(err) console.log(err);
				count++;
				if(count==len){
					mydb.close();
					deferred.resolve();
				}
			});
		});
		
	});
	
	return deferred.promise;
}

exports.createMatrixRecursive = function(databaseUrl,wifidb,wifiCollection,cellWidthKm,radiusMeters,providers,year,to,index,callback){
	createMatrixProvider(databaseUrl,wifidb,wifiCollection,cellWidthKm,radiusMeters,year,to,providers[index],function(){
		index++;
		if(index>providers.length-1) return callback();
		createMatrixRecursive(databaseUrl,wifidb,wifiCollection,cellWidthKm,radiusMeters,providers,year,to,index,callback);
	});
}

function createMatrixProvider(databaseUrl,wifidb,wifiCollection,cellWidthKm,radiusMeters,year,to,provider,callback){
	createMatrixYearProvider(databaseUrl, wifidb, wifiCollection, year,provider, cellWidthKm, radiusMeters).then(function(){
		console.log("Matrix "+provider+"-"+year+" created");
		year--;
		if(year<to) return callback(); 
		createMatrixProvider(databaseUrl,wifidb,wifiCollection,cellWidthKm,radiusMeters,year,to,provider,callback);
	});
}

function createMatrixYearProvider(databaseUrl, wifidb, wifiCollection, year, provider, cellWidthKm, radiusMeters){
	var deferred = q.defer();
	
	var matrixCollection = "matrix_"+cellWidthKm+"_"+provider+"_"+year+"_"+radiusMeters;
	var resultSetCollection = "resultset_"+cellWidthKm+"_"+provider+"_"+year+"_"+radiusMeters;
	var mydb = mongojs(databaseUrl, [matrixCollection, resultSetCollection, "matrix", "turinBBOXComplex"]);
	var mydb2 = mongojs(wifidb, [wifiCollection]);
	
	mydb[matrixCollection].remove({}, function(){
		
	  mydb.matrix.find({}, function(err, features) {
			var count = 0;
			var len = features.length;
			for(var i=0; i<features.length; i++){
				var feature = features[i];
		
				(function(feature){
					
					getWifiCountProvider(mydb2, wifiCollection, feature.geometry, year, provider).then(function(countW){
						feature.properties.wifiCount = countW;
						
						getStreetsLength(mydb, feature.geometry).then(function(lenS){
							feature.properties.streetsLength = lenS;
							
							getCoveragesLength(feature.geometry, year, mydb, resultSetCollection).then(function(lenC){
								feature.properties.coveragesLength = lenC;
							
								mydb[matrixCollection].insert(feature, function(err, res){
									if(err) console.log(err);
									count++;
									if(count==len){
										mydb.close();
										mydb2.close();
										deferred.resolve();
									}
								});
							});
						});
					});
				})(feature);
			}
		});
		
	});
	
	return deferred.promise;
}

function getWifiCountProvider(mydb2, wifiCollection, geometry, year, provider){
	var deferred = q.defer();

	var from = moment(year+"-01-01 00:00:00").toDate();
	var to = moment(year+"-12-31 23:59:59").toDate();
		
  mydb2[wifiCollection].find({"properties.ssid": {$regex:provider, $options: 'i'}, "properties.lasttime": {$gte: from, $lt: to}, geometry:{$geoWithin:{$geometry:geometry}}}, {_id:false}, function(err, features) {
		if(features)
			deferred.resolve(features.length);
		else
			deferred.resolve(0);
	});
	
	return deferred.promise;
}

function getStreetsLength(mydb, geometry){
	var deferred = q.defer();
	
  mydb.turinBBOXComplex.find({geometry:{$geoWithin:{$geometry:geometry}}}, {_id:false}, function(err, features) {
		var streetLength = 0;
		for(var i=0; i<features.length; i++){
			streetLength += turf.lineDistance(features[i], 'kilometers');
		}
		deferred.resolve(streetLength);
	});
	
	return deferred.promise;
}

function getCoveragesLength(geometry, year, mydb, resultSetCollection){
	var deferred = q.defer();
	
  mydb[resultSetCollection].find({geometry:{$geoWithin:{$geometry:geometry}}}, {_id:false}, function(err, features) {
    if(err) console.log(err);
		var coverageLength = 0;
		for(var i=0; i<features.length; i++){
			coverageLength += turf.lineDistance(features[i], 'kilometers');
		}
		deferred.resolve(coverageLength);
	});
	
	return deferred.promise;
}

//

exports.createProviderCSV = function(filename, databaseUrl, year, provider, cellWidthKm, radiusMeters){
	
	var matrixCollection = "matrix_"+cellWidthKm+"_"+provider+"_"+year+"_"+radiusMeters;
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
		
					var fields = ['_id','properties.posX', 'properties.posY', 'properties.wifiCount', 'properties.coveragesLength', 'properties.streetsLength'];
			 
					json2csv({ data: features, fields: fields }, function(err, csv) {
						if (err) console.log(err);
						mkdirp(getDirName(filename), function (err) {
							if (err) return console.log(err);
							fs.writeFile(filename, csv, function(err) {
								if (err) throw err;
								console.log(filename+' saved');
								mydb.close();
							});
						});
					});
				});
			});
		});
		
  });
	
}
