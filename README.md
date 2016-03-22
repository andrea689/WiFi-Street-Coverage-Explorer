# WiFi Street Coverage Explorer

Tool for analyzing the WiFi street coverage from in house access points.

## Table of contents

  * [Installation](#installation)
  * [Usage](#usage)
    * [Configuration file](#configuration-file)
    * [Load streets from GeoJson file](#load-streets-from-geojson-file)
    * [Convert WiFis data to coverage segments](#convert-wifis-data-to-coverage-segments)
    * [Aggregate coverage segments](#aggregate-coverage-segments)
    * [Export results to CSV file](#export-results-to-csv-file)
    * [Run the server](#run-the-server)
  * [About us](#about-us)
  * [License](#license)

## Installation

Download the project and execute:

```bash
npm install
```

## Usage

### Configuration file

The configuration is expressed by a Json file with the following attributes:

| Attribute | Type | Description |
| --------- | ---- | ----------- |
| streets | String | Path to GeoJson file |
| db | String | Url of database containing streets data, coverage and aggregated data |
| wifidb | String | Url of database where WiFis measures are stored |
| wificollection | String | Collection where WiFis are stored |
| isp | Array of String | Array of SSID filters |
| radius | Number | The radius of WiFis in meters |
| cell | Number | The cell width in kilometers |
| year | Number | Year considered |
| port | Number | Port where the server listens |

Example of configuration file:

```javascript
{
	"streets": "TurinGeoJson.json",
	"db": "localhost:27017/Database1",
	"wifidb": "localhost:27017/Database2",
	"wificollection": "wifi",
	"isp": ["", "Alice", "Telecom"],
	"radius": 50,
	"cell": 1,
	"year": 2015,
	"port": 8443
}
```

### Load streets from GeoJson file

The first step is the loading of streets in our MongoDB.

You can obtain a GeoJson file of desidered streets from [Overpass Turbo](https://overpass-turbo.eu). 

To load the streets:

```
node app.js --load --config config.json
```

### Convert WiFis data to coverage segments

The WiFis data must be stored in a MongoDB with the following document structure:

```javascript
{ 
    "_id" : "A4:52:6F:CA:C5:EF", 
    "type" : "Feature", 
    "geometry" : {
        "type" : "Point", 
        "coordinates" : [
            7.57858753, 
            45.01055527
        ]
    }, 
    "properties" : {
        "lasttime" : ISODate("2015-08-03T07:37:07.000+0000"), 
        "netid" : "A4:52:6F:CA:C5:EF", 
        "ssid" : "Telecom-64947177"
    }
}
```

To start the convertion:

```
node app.js --convert --config config.json
```

### Aggregate coverage segments

The data must be aggregated to be shown in a web application.

```
node app.js --aggregate --config config.json
```

### Export results to CSV file

To get the statistics:

```
node app.js --export --config config.json
```

### Run the server

To run the server:

```
node app.js --server --config config.json
```

You can configure what you want to show in web application by editing the file [public/js/app.js](public/js/app.js).

## About us

Research and code reported in this software project was supported by [Swarm Joint Open Lab](http://jol.telecomitalia.com/jolswarm/) which is part of TIM (Telecom Italia Mobile) Open Innovation Area.

## License

Copyright 2016 Politecnico di Torino

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.