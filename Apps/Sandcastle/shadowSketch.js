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

var options = {
    camera : viewer.scene.camera,
    canvas : viewer.scene.canvas
};

viewer.dataSources.add(Cesium.KmlDataSource.load('../../SampleData/kml/bikeRide.kml', options)).then(function(dataSource){
    "use strict";
    viewer.clock.shouldAnimate = false;
    var rider = dataSource.entities.getById('tour');
    viewer.flyTo(rider).then(function(){
        viewer.trackedEntity = rider;
        viewer.selectedEntity = viewer.trackedEntity;
        viewer.clock.multiplier = 30;
        viewer.clock.shouldAnimate = true;

        viewer.shadowMap.trackedEntity = rider;
    });
});
