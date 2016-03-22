"use strict";

var mongojs = require("mongojs");
var geoJsonTools = require("geojson-tools");
var q = require("q");
var _ = require("underscore");
var fs = require("fs");

exports.loadGeoJsonComplexInDB = function(file, databaseUrl, collection) {
	var deferred = q.defer();

	var db = mongojs(databaseUrl, [collection]);

	db[collection].remove({},function(){
		db[collection].ensureIndex({geometry: "2dsphere"});

		fs.readFile(file, 'utf8', function (err, featureCollection) {
			if (err) throw err;
			var featureCollection = JSON.parse(featureCollection);
			var elem = featureCollection.features[0];
			saveElem(db, collection, featureCollection.features, 0, function(){
				deferred.resolve();
			});
		});
	});
	
	return deferred.promise;
};

function saveElem(db, collection, array, i, callback){
	var elem = array[i];
	if(!elem)
		return callback();
	
  elem.properties = {
	  '@id': elem.id,
	  name: elem.properties.name
  };
	
	if(elem.geometry.type == "LineString"){
		var jwndsak = geoJsonTools.complexify(elem.geometry, 0.011);
		elem.geometry.coordinates = jwndsak.coordinates;
		var coordinates =  [];
		for(var z=0; z<elem.geometry.coordinates.length-1; z++){
			coordinates.push([elem.geometry.coordinates[z],elem.geometry.coordinates[z+1]]);
		}
		saveSingleElem(db, collection, elem, 0, array, i, coordinates, callback);
		
	}else{
		saveElem(db, collection, array, ++i, callback);
	}
	return;
}

function saveSingleElem(db, collection, elem, j, array, i, coordinates, callback){
	var asd = _.clone(elem);
	
	if(!coordinates[j])
		return saveElem(db, collection, array, ++i, callback);
		
	asd.geometry.coordinates = coordinates[j];
	db[collection].insert(asd, function(err){
		saveSingleElem(db, collection, elem, ++j, array, i, coordinates, callback);
	});
	
}
