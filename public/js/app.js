'use strict';

var local = true;

var startConf = {
	lat: 45.0658,
	lng: 7.6519,
	zoom: 17
};

var wifiMaps = angular.module('wifiMaps', [
	'leaflet-directive',
	'geometryUtils',
	'wifiMaps.services',
	'wifiMaps.controllers'
]);


wifiMaps.constant('Constants', {
	cellWidth: 1,
	radius: 50,
	provider: "",
	year: 2015,

	tileLayer: "http://tile.openstreetmap.org/{z}/{x}/{y}.png",

	startConf: startConf
});