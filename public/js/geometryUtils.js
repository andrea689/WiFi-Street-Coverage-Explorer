'use strict';

/* Geometry Utils */

var geometryUtils = angular.module('geometryUtils', []);

geometryUtils.factory('GeoUtils',
    function(){

        function pointIsInPath(point, path){

            for(var i=0; i<path.length-1; i++){
                var pointA = path[i];
                var pointB = path[i+1];
                var line = [pointA, pointB];
                if(pointIsInLine(point, line)) return true;
            }
            return false;
        }

        function pointIsInLine(point, line){
            /*
             y - yA     x - xA
             ------- - -------- = 0   &&   ( (yA <= y <= yB   &&   xA <= x <= xB) || (yB <= y <= yA   &&   xB <= x <= xA) )
             yB - yA    xB - xA
             */
            var epsilon = 0.1;

            var pointLineA = line[0];
            var pointLineB = line[1];

            var pointXInAB = pointLineA[1] <= point[1] && point[1] <= pointLineB[1] || pointLineB[1] <= point[1] && point[1] <= pointLineA[1] ;
            var pointYInBA = pointLineA[0] <= point[0] && point[0] <= pointLineB[0] || pointLineB[0] <= point[0] && point[0] <= pointLineA[0];

            if(pointLineA[1] == pointLineB[1]){ //yA == yB
                return point[1] == pointLineA[1] && pointYInBA;
            }

            if(pointLineA[0] == pointLineB[0]){ //xA == xB
                return point[0] == pointLineA[0] && pointXInAB;
            }

            var term = (((point[1]-pointLineA[1])/(pointLineB[1]-pointLineA[1])) -
                ((point[0]-pointLineA[0])/(pointLineB[0]-pointLineA[0])));

            //console.log("    "+JSON.stringify(point)+" in "+JSON.stringify(line));
            //console.log("    "+term);
            //console.log("    "+pointXInAB);
            //console.log("    "+pointYInBA);

            return (term < epsilon && term > -epsilon && pointXInAB && pointYInBA);
        }

        function convertMetersInPixels(meters, lat, currentZoom){//$scope.map.getZoom()
            var earthCircumference = 40075160;//meters
            var s = earthCircumference * Math.cos(lat*Math.PI/180) / Math.pow(2, currentZoom+8); // meters/pixel
            return meters/s;
        }

        function calculateDistance(point1, point2) {
            var R = 6372795;//m
            var φ1 = point1[1]*Math.PI/180,  λ1 = point1[0]*Math.PI/180;
            var φ2 = point2[1]*Math.PI/180, λ2 = point2[0]*Math.PI/180;
            var Δφ = φ2 - φ1;
            var Δλ = λ2 - λ1;

            var a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

            return R * c;
        }

        return {
            pointIsInPath: pointIsInPath,
            pointIsInLine: pointIsInLine,
            convertMetersInPixels: convertMetersInPixels,
            calculateDistance: calculateDistance
        }
    }
);