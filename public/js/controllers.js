'use strict';

/* Controllers */

var wifiMapsControllers = angular.module('wifiMaps.controllers', []);

wifiMapsControllers.controller('AppController', ['$scope', 'leafletData', 'Constants', 'ValueService', 'GeoUtils',
	function($scope, leafletData, Constants, ValueService, GeoUtils) {

		var startConf = Constants.startConf;

		angular.extend($scope, {
			turin: {
				lat: startConf.lat,
				lng: startConf.lng,
				zoom: startConf.zoom
			},
			defaults: {
				tileLayer: Constants.tileLayer,
				minZoom: 11,
				maxZoom: 18,
				path: {
					weight: 10,
					color: '#800000',
					opacity: 1
				}
			},
			events: {
				map: {
					enable: ['viewreset'],
					logic: 'emit'
				}
			}
		});

		$scope.legendRows = ValueService.getRows();

		var svgCoverages, gCoverages, svgMeasures, gMeasures, svgStreets, gStreets;

		leafletData.getMap().then(function(map) {
			$scope.map=map;

			//var bounds = [[45.0060, 7.5760], [45.1405, 7.7750]];
			var bounds = [[45.0060, 7.5760], [45.140855906589735, 7.779450746433247]];
			//L.rectangle(bounds, {color: "#ff7800", weight: 1, fill: false}).addTo($scope.map);
			$scope.map.fitBounds(bounds);
						
			var MyButton = L.Control.extend({
			    options: {
			        position: 'topright'
			    },
					
			    initialize: function (myOptions, options) {
						L.Util.setOptions(this, options);
							this._myOptions = myOptions;
			    },

			    onAdd: function (map) {
						var name = this._myOptions.name;
						var selector = this._myOptions.selector;
						
						var self = this;
						
		        var container = L.DomUtil.create('div', 'my-custom-control leaflet-bar');
						

						var button = L.DomUtil.create('a', 'myControl', container);
						button.textContent = name;
						button.setAttribute("href", "#");
											
						L.DomEvent.addListener(button, 'click', function(e){
							
							$(selector).toggle();
							
						});
							
			      return container;
			    }
			});

			$scope.map.addControl(new MyButton({name: "wifi", selector:".measures"}));
			$scope.map.addControl(new MyButton({name: "cover", selector:".coverages"}));
			$scope.map.addControl(new MyButton({name: "tile", selector:".leaflet-tile-container"}));
			$scope.map.addControl(new MyButton({name: "grid", selector:".grid"}));
			
			
			getMatrix();
			getRectWifi(45.0060, 7.5760, 45.140855906589735, 7.779450746433247);
			getRectCoverage(45.0060, 7.5760, 45.140855906589735, 7.779450746433247);
			//getRectStreet(45.0060, 7.5760, 45.140855906589735, 7.779450746433247);
						
			svgCoverages = d3.select(".leaflet-overlay-pane")
				.insert("svg", ":first-child")
				.attr("class", "coverages");
			gCoverages = svgCoverages.append("g")
				.attr("class", "leaflet-zoom-hide");

			svgMeasures = d3.select(".leaflet-overlay-pane")
				.insert("svg", ":first-child")
				.attr("class", "measures");
			gMeasures = svgMeasures.append("g")
				.attr("class", "leaflet-zoom-hide");

			svgStreets = d3.select(".leaflet-overlay-pane")
				.insert("svg")
				.attr("class", "streets");
			gStreets = svgStreets.append("g")
				.attr("class", "leaflet-zoom-hide");

		});

		function getMatrix(){
			var url = "/matrix/"+Constants.year+"/"+Constants.cellWidth+"/"+Constants.radius+"/"+Constants.provider;
			console.log(url);
			d3.json(url, function(collection){
				if(collection==null){
					console.log("collection is null");
				}else{
					printMatrix(collection);
				}
				$scope.$apply();
			});
		}
		function printMatrix(collection){
			if($scope.matrixLayer){
				$scope.map.removeLayer($scope.matrixLayer);
			}
			$scope.matrixLayer = L.geoJson(collection, {
				style: {color: "#ff7800", weight: 1, fill: "white", fillOpacity: 0.01, className: "grid"},
				onEachFeature: function (feature, layer) {
					layer.bindPopup(
						"<p><b>Wifi count: </b>"+feature.properties.wifiCount+"</br> \
						<b>Streets length: </b>"+feature.properties.streetsLength+"</br> \
						<b>posX: </b>"+feature.properties.posX+"</br> \
						<b>posY: </b>"+feature.properties.posY+"</br> \
						<b>Coverages length: </b>"+feature.properties.coveragesLength+"</p>"
					);
				}
			}).addTo($scope.map);
		}

		function getRectWifi(lat,lng,lat2,lng2){
			var url = "/wifi/rect/"+lng+"/"+lat+"/"+lng2+"/"+lat2+"/"+Constants.year+"/"+Constants.provider;
			console.log(url);
			d3.json(url, function(collection){
				if(collection==null){
					console.log("collection is null");
				}else{
					console.log("getRectWifi:"+collection.features.length);
					printWiFi(collection.features);
				}
				$scope.$apply();
			});
		}
		function printWiFi(features) {

			if(!features || features.length==0){
			  console.log("No wifi");
			  return;
			}

			for (var i = 0; i < features.length; ++i) {
				features[i].properties.radius = Constants.radius;
			}

			var transform = d3.geo.transform({point: projectPoint}),
				path = d3.geo.path().projection(transform);
			var featurePaths = gMeasures.selectAll("path")
				.data(features)
				.enter().append("path")
				.attr("class", "measure")
				.attr("ssid",function(d) {return d.properties.ssid} )
				.attr("d", path.pointRadius(function(d) {
					return GeoUtils.convertMetersInPixels(d.properties.radius, d.geometry.coordinates[1], $scope.map.getZoom()); }));

			reset();
			$scope.$on('leafletDirectiveMap.viewreset', function () {
				reset();
			});

			function reset() {
				var collection = { "type": "FeatureCollection",
					"features":features};
				var maxRadius = d3.max(features, function(d){return GeoUtils.convertMetersInPixels(d.properties.radius, d.geometry.coordinates[1], $scope.map.getZoom())});
				var bounds = path.bounds(collection),
					topLeft = bounds[0],
					bottomRight = bounds[1];
				topLeft[0] -= maxRadius;
				topLeft[1] -= maxRadius;
				bottomRight[0] += maxRadius;
				bottomRight[1] += maxRadius;
				svgMeasures.attr("width", bottomRight[0] - topLeft[0])
					.attr("height", bottomRight[1] - topLeft[1])
					.style("left", topLeft[0] + "px")
					.style("top", topLeft[1] + "px");
				gMeasures.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");
				featurePaths.attr("d", path.pointRadius(function(d) {
					return GeoUtils.convertMetersInPixels(d.properties.radius, d.geometry.coordinates[1], $scope.map.getZoom()); 
				}));
			}
		}

		function getRectCoverage(lat,lng,lat2,lng2){
			var url = "/coverage/rect/"+lng+"/"+lat+"/"+lng2+"/"+lat2+"/"+Constants.year+"/"+Constants.cellWidth+"/"+Constants.radius+"/"+Constants.provider;
			console.log(url);
			d3.json(url, function(collection){
				if(collection==null){
					console.log("collection is null");
				}else{
					console.log("getRectCoverage:"+collection.length);
					printCoverage(collection.features);
				}
				$scope.$apply();
			});
		}
		function printCoverage(coverages) {

			if(!coverages || coverages.length==0){
				console.log("No coverage");
				return;
			}
			var transform = d3.geo.transform({point: projectPoint}),
				path = d3.geo.path().projection(transform);
			var feature = gCoverages.selectAll("path")
				.data(coverages)
				.enter().append("path")
				.attr("streetid", function (d) {return d["properties.street_id"];})
				.attr("count", function (d) {return d["count"];})
				.attr("streetname", function (d) {return d["properties.name"];});

			reset();
			$scope.$on('leafletDirectiveMap.viewreset', function () {
				reset();
			});

			function reset() {
				var collection = { "type": "FeatureCollection",
					"features":coverages};
				var bounds = path.bounds(collection),
					topLeft = bounds[0],
					bottomRight = bounds[1];
				svgCoverages.attr("width", bottomRight[0] - topLeft[0])
					.attr("height", bottomRight[1] - topLeft[1])
					.style("left", topLeft[0] + "px")
					.style("top", topLeft[1] + "px");
				gCoverages.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");
				feature.attr("d", path);
			}
		}

		function getRectStreet(lat,lng,lat2,lng2){
			var url = "/turinBBOXComplex/rect/"+lng+"/"+lat+"/"+lng2+"/"+lat2;
			console.log(url);
			d3.json(url, function(collection){
				if(collection==null){
					console.log("collection is null");
				}else{
					console.log("getRectStreet:"+collection.length);
					printStreet(collection);
				}
				$scope.$apply();
			});
		}
		function printStreet(collection) {
			$scope.lengthStreetsInnerCircle = collection.lengthStreetsInnerCircle;

			gStreets.selectAll("path").remove();
			var transform = d3.geo.transform({point: projectPoint}),
				path = d3.geo.path().projection(transform);
			var feature = gStreets.selectAll("path")
				.data(collection.features)
				.enter().append("path")
				.attr("name", function(d){return d.properties.name});

			reset();
			$scope.$on('leafletDirectiveMap.viewreset', function () {
				reset();
			});

			function reset() {
				var bounds = path.bounds(collection),
					topLeft = bounds[0],
					bottomRight = bounds[1];
				svgStreets.attr("width", bottomRight[0] - topLeft[0])
					.attr("height", bottomRight[1] - topLeft[1])
					.style("left", topLeft[0] + "px")
					.style("top", topLeft[1] + "px");
				gStreets.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");
				feature.attr("d", path);
			}
		}
		
		function projectPoint(x, y) {
			var point = $scope.map.latLngToLayerPoint(new L.LatLng(y, x));
			this.stream.point(point.x, point.y);
		}

	}
]);
