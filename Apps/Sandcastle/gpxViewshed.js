var viewer = new Cesium.Viewer('cesiumContainer', {
    shadows: true,
    terrainShadows: Cesium.ShadowMode.ENABLED
});

viewer.terrainProvider = Cesium.createWorldTerrain({
    requestWaterMask: true,
    requestVertexNormals: true
});

viewer.scene.globe.depthTestAgainstTerrain = true;
viewer.scene.globe.enableLighting = true;

//borrowing from https://github.com/trustyoo86/gpx2czml/blob/master/src/pure/gpx2czml.js
//and https://willgeary.github.io/GPXto3D/
function parseGPX(dataString, globalEle) {
    "use strict";
    globalEle = globalEle || 5;
    var xml = new DOMParser().parseFromString(dataString, 'text/xml');
    var gpxNode = xml.getElementsByTagName('gpx')[0];

    var minLat, minLon;
    minLat = minLon =  Number.MAX_VALUE;
    var maxLat, maxLon;
    maxLat = maxLon = -Number.MAX_VALUE;

    try {
        var metadata = gpxNode.getElementsByTagName('metadata')[0],
            trkContent = gpxNode.getElementsByTagName('trk')[0],
            trkSeg = gpxNode.getElementsByTagName('trkseg')[0], //what if there's more than one seg?
            //elePts = trkSeg.childNodes, //surely this will include both 'trkpt's & 'ele's? unused in gpx2czml
            trkPoints = trkSeg.getElementsByTagName('trkpt');

        var startTime, startSeconds;

        var czmlData = [{
            id: 'document',
            name: gpxNode.getAttribute('creator'),
            version: gpxNode.getAttribute('version'), //err, do GPX version & CZML version really correspond??
            clock: {
                interval: null,
                //currentTime: startTime,
                multiplier: 1000,
                range: 'CLAMPED'
            }
        }, {
            id: 'path',
            position: {
                //epoch: startTime,
                cartographicDegrees: []
            },
            path: {
                width: 4,
                material: {
                    polyLineOutline: {
                        color: {
                            rgba: [255, 255, 255, 150]
                        },
                        outlineWidth: 15,
                        outlineColor: {
                            rgba: [0, 173, 253, 200]
                        }
                    }
                    // ,
                    // polyLineGlow: {
                    //     glowPower: 11,
                    //     color: { rgba: [0, 255, 255, 100] }
                    // }
                },
                resolution: 5,
                leadTime: 0,
                heightReference: 'RELATIVE_TO_GROUND',
                trailTime: 100000
            }
        }, {
            id: 'point',
            position: {
                //epoch: startTime,
                cartographicDegrees: []
            },
            point: {
                color: {
                    rgba: [ 255, 255, 255, 255 ]
                },
                outlineWidth: 6,
                heightReference: 'RELATIVE_TO_GROUND',
                pixelSize: 8,
                outlineColor: {
                    rgba: [ 0, 173, 253, 255 ]
                }
            },
        }];

        var currentEle;

        for (var i=0; i<trkPoints.length; i++) {
            var p = trkPoints[i];
            var lat = parseFloat(p.getAttribute('lat'));
            var lon = parseFloat(p.getAttribute('lon'));
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
            minLon = Math.min(minLon, lon);
            maxLon = Math.max(maxLon, lon);
            var ele = parseFloat(p.getElementsByTagName('ele')[0].textContent); //watch out, might not be there?
            var time = p.getElementsByTagName('time')[0].textContent;
            var targetSeconds = new Date(time).getTime();
            var dt = i === 0 ? 0 : (targetSeconds - startSeconds) / 1000;

            if (i === 0) {
                startTime = time;
                startSeconds = targetSeconds;
            }

            czmlData[1].position.cartographicDegrees.push(dt);
            czmlData[1].position.cartographicDegrees.push(lon);
            czmlData[1].position.cartographicDegrees.push(lat);
            // czmlData[1].position.cartographicDegrees.push(ele);
            czmlData[1].position.cartographicDegrees.push(globalEle);

            czmlData[2].position.cartographicDegrees.push(dt);
            czmlData[2].position.cartographicDegrees.push(lon);
            czmlData[2].position.cartographicDegrees.push(lat);
            czmlData[2].position.cartographicDegrees.push(globalEle);

            if (i === trkPoints.length-1) {
                czmlData[0].clock.interval = startTime + '/' + time;
                czmlData[0].clock.currentTime = startTime;
                czmlData[1].availability = startTime + '/' + time;
                czmlData[1].position.epoch = startTime;
                czmlData[2].availability = startTime + '/' + time;
                czmlData[2].position.epoch = startTime;
            }
        }

        var midLat = minLat + (maxLat-minLat)/2;
        var midLon = minLon + (maxLon-minLon)/2;
        var bounds = {
            minLat: minLat, minLon: minLon, maxLat: maxLat, maxLon: maxLon,
            midLat: midLat, midLon: midLon
        };
        return {czml: czmlData, bounds: bounds};

    } catch (e) {
        console.error(e);
    }
}

function loadGPXFile(callback, url) {
    var req = new XMLHttpRequest();
    req.onreadystatechange = function() {
        if (req.readyState === 4) {
            if (req.status === 200) {
                var result = parseGPX(req.responseText);
                var czmlData = result.czml, bounds = result.bounds;
                //console.log(`parsed ${url}...`);
                callback(czmlData, bounds);
            } else {
                console.log('HTTP request error');
            }
        }
    };
    req.open('GET', url);
    req.send();
}

//let p = Cesium.Cartesian3.fromDegrees(-2.4081539, 51.4228152, 1000);
//let p = Cesium.Cartesian3.fromDegrees(-4.11874119, 53.11475145, 1000);
//let p2 = {x: 3827163.5271484912, y: -275592.80233841133, z: 5079018.533676268};

var p;

//TODO: make this a promise?
loadGPXFile(function (czmlData, bounds) {
    viewer.dataSources.add(Cesium.CzmlDataSource.load(czmlData)).then(setupScene);
    p = Cesium.Cartesian3.fromDegrees(bounds.midLon, bounds.midLat, 1000);
    viewer.scene.camera.setView({
        destination: p,
        //position: p2,
        orientation: {
            heading: 0.7198026979306276, //Cesium.Math.toRadians(0),
            pitch: -0.4706159729820105//Cesium.Math.toRadians(-20)
        }
    });
}, 'tracklogs/winchbath.gpx');

function setupScene(d) {
    var lightCamera = new Cesium.Camera(viewer.scene);
    lightCamera.position = p;
    lightCamera.aaFlag = 'hello';

    var shadowMap = viewer.shadowMap;
    //shadowMap.camera = lightCamera;
    //shadowMap.isPoint = true;
    shadowMap.darkness = 0;
    shadowMap.enabled = true;

    //TODO: investigate multiple shadows further.
    // try {
    //     var shadowMap = new Cesium.ShadowMap({
    //         lightCamera: lightCamera,
    //         isPointLight: true,
    //         size: 4096,
    //         darkness: 0.1
    //     });
    //     shadowMap.enabled = true; //this is the default anyway.
    //     shadowMap.debugShow = true;
    //     viewer.scene.shadowMap = shadowMap;
    // } catch (e) {
    //     console.log("shadow map error..." + e.message);
    // }
}
