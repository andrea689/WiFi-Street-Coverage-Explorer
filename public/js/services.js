'use strict';

/* Services */

var wifiMapsServices = angular.module('wifiMaps.services', []);

wifiMapsServices.factory('ValueService', ['Constants',
	function(Constants){

		var values = [
			{
				count: "> 5",
				colour: "#00ff00"
			},
			{
				count: 5,
				colour: "#ffff00"
			},
			{
				count: 4,
				colour: "#ff9400"
			},
			{
				count: 3,
				colour: "#ff5a00"
			},
			{
				count: 2,
				colour: "#ff0000"
			},
			{
				count: 1,
				colour: "black"
			}
		];

		return {
			getRows: function(){
				var rows = [];
				for (var i = 0; i < values.length; ++i) {
					rows.push(
						{
							count: values[i].count,
							color: values[i].colour
						}
					)
				}
				return rows;
			}
		}
	}
]);