
////////// AUTHOR & APPLICATION INFORMATION ////////////////////////////////////////
//
//   Author: Chris Sergent
//   Date:   January 6, 2014
//   Application: GIS Mobile
//
////////////////////////////////////////////////////////////////////////////////////
/// <reference path="jquery-1.9.1.js" />
/// <reference path="jquery.ui.touch-punch.js" />
/// <reference path="jquery-ui-1.10.3.custom.min.js" />


// Comments describing require statements are definition from https://developers.arcgis.com/javascript/jsapi/ 
// and http://dojotoolkit.org/reference-guide/1.9/
var map;
var editorWidget = null;
var featureLayerInfos;
var graphic;
var currLocation;
var watchId;
var pt;
var app = {};
// Get references to modules to be used
require(["esri/map",                                // mapSection
         "esri/config",                             // The default values for all JS API configuration options. 

         "esri/Color",  // measurementDiv

         "esri/dijit/editing/Editor",           // Editor
         "esri/dijit/Geocoder",                     // search
         "esri/dijit/HomeButton",                   // homeButton
         "esri/dijit/LocateButton",                 // locateButton
         "esri/dijit/Measurement", // measurementDiv
         "esri/dijit/OverviewMap", // Overview Map
         "esri/dijit/Scalebar",  // Scalebar

         "esri/geometry/Extent", // The minimum and maximum X- and Y- coordinates of a bounding box. Used to set custom extent
         "esri/geometry/Point",
         "esri/geometry/screenUtils", // search

         "esri/graphic", // search

         "esri/IdentityManager", // editor

         "esri/layers/ArcGISDynamicMapServiceLayer",
         "esri/layers/ArcGISTiledMapServiceLayer",
         "esri/layers/LayerDrawingOptions", // measurementDiv
         "esri/layers/FeatureLayer",

         "esri/renderers/SimpleRenderer", // measurementDiv

         "esri/SnappingManager", // measurementDiv    -add snapping capability

         "esri/sniff", // measurementDiv

         "esri/SpatialReference",  // editor

         "esri/symbols/SimpleFillSymbol", // measurementDiv
         "esri/symbols/SimpleLineSymbol", // measurementDiv
         "esri/symbols/SimpleMarkerSymbol", // search

         "esri/tasks/GeometryService",    // Represents a geometry service resource exposed by the ArcGIS Server REST API.
         "esri/tasks/PrintTask",          // printer
         "esri/tasks/PrintParameters",    // printer
         "esri/tasks/PrintTemplate",      // printer
         "esri/tasks/ProjectParameters",  // editor

         "esri/toolbars/draw",

         "dojo/_base/array",
         "dojo/_base/Color",                    // search
         "dojo/dom",                            // It is used for code like - dom.byId("someNode")
         "dojo/dom-construct",                  // search
         "dojo/keys",
         "dojo/on",                             // This module is used based on an even such as on("click")
         "dojo/parser",                         // The Dojo Parser is an optional module.
         "dojo/query",                      // search
         "dojo/i18n!esri/nls/jsapi",
         "dojo/dnd/Moveable",

         "dijit/layout/BorderContainer",
         "dijit/layout/ContentPane",
         "dijit/TitlePane",
         "dijit/form/CheckBox",
         "dojo/domReady!"],    // An AMD loaded plugin that will wait until the DOM has finished loading before returning.

// Set variables to be used with references (write variables and references in the same order and be careful of typos on your references)
         function (Map, esriConfig, Color,
                   Editor, Geocoder, HomeButton,
                   LocateButton, Measurement,
                   OverviewMap, Scalebar, Extent,
                   Point, screenUtils, Graphic,
                   IdentityManager, ArcGISDynamicMapServiceLayer, ArcGISTiledMapServiceLayer,
                   LayerDrawingOptions, FeatureLayer, SimpleRenderer,
                   SnappingManager, has, SpatialReference,
                   SimpleFillSymbol, SimpleLineSymbol, SimpleMarkerSymbol,
                   GeometryService, PrintTask, PrintParameters,
                   PrintTemplate, ProjectParameters, Draw,
                   arrayUtils, Color, dom,
                   domConstruct, keys, on,
                   parser, query, i18n,
                   Moveable) {

             parser.parse();

             //snapping is enabled for this sample - change the tooltip to reflect this
             i18n.toolbars.draw.start += "<br/>Press <b>CTRL</b> to enable snapping";
             i18n.toolbars.draw.addPoint += "<br/>Press <b>CTRL</b> to enable snapping";

             /* The proxy comes before all references to web services */
             /* Files required for security are proxy.config, web.config and proxy.ashx 
             - set security in Manager to Private, available to selected users and select 
             Allow access to all users who are logged in
             (Roles are not required)
             /*
             Information on the proxy can be found at: https://developers.arcgis.com/javascript/jshelp/ags_proxy.html
             */

             // Proxy Definition Begin 
             //identify proxy page to use if the toJson payload to the geometry service is greater than 2000 characters.
             //If this null or not available the project and lengths operation will not work. 
             // Otherwise it will do a http post to the proxy.
             esriConfig.defaults.io.proxyUrl = "proxy.ashx";
             esriConfig.defaults.io.alwaysUseProxy = false;

             // Proxy Definition End

             //-----------------------------------------------------------
             // Map Services Begin
             //-----------------------------------------------------------

             // declare geometry service
             esriConfig.defaults.geometryService =
             new GeometryService("http://maps.decaturil.gov/arcgis/rest/services/Utilities/Geometry/GeometryServer");

             // set custom extent
             var initialExtent = new Extent({
                 "xmin": 777229.03,
                 "ymin": 1133467.92,
                 "xmax": 848340.14,
                 "ymax": 1185634.58,
                 "spatialReference": {
                     "wkid": 3435
                 }
             });

             // create map and set slider style to small
             map = new Map("mapSection", {
                 showAttribution: false,
                 sliderStyle: "small",
                 extent: initialExtent,
                 logo: false
             });

             // Starts initEditing after the feature layer(s) have been added
             map.on("layers-add-result", initEditing);

             // add imagery
             var tiled = new ArcGISTiledMapServiceLayer("http://maps.decaturil.gov/arcgis/rest/services/Aerial_2014_Tiled/MapServer");
             map.addLayer(tiled);
             // set operational layers
             var operationalLayer = new ArcGISDynamicMapServiceLayer("http://maps.decaturil.gov/arcgis/rest/services/Public/InternetVector/MapServer", { "opacity": 0.5 });
             // add operational layers
             map.addLayer(operationalLayer);

             // add point feature layer for editing
             var pointFeatureLayer = new FeatureLayer("http://maps.decaturil.gov/arcgis/rest/services/testSecure/FeatureServer/0", {
                 mode: FeatureLayer.MODE_ONDEMAND,
                 outFields: ["*"]
             });
             map.addLayers([pointFeatureLayer]);

             //-----------------------------------------------------------
             // Map Services End
             //-----------------------------------------------------------

             // Editor Widget Begin 
             // settings for the editor widget
             function initEditing(event) {
                 // sizes the edit window
                 map.infoWindow.resize(400, 300);
                 featureLayerInfos = arrayUtils.map(event.layers, function (layer) {
                     return {
                         "featureLayer": layer.layer
                     };
                 });

                 createEditor();
                 var options = {
                     snapKey: keys.copyKey
                 };
                 map.enableSnapping(options);
             }


             function createEditor() {
                 if (editorWidget) {
                     return;
                 }
                 var settings = {
                     map: map,
                     layerInfos: featureLayerInfos,
                     toolbarVisible: true,
                     enableUndoRedo: true,
                     maxUndoOperations: 20
                 };
                 var params = {
                     settings: settings
                 };
                 editorWidget = new Editor(params, domConstruct.create("div"));
                 domConstruct.place(editorWidget.domNode, "editorDiv");

                 editorWidget.startup();



             }

             function destroyEditor() {
                 if (editorWidget) {
                     editorWidget.destroy();
                     editorWidget = null;
                 }
             }
             // Editor widget ends


             // add homeButton begin
             var home = new HomeButton({
                 map: map
             }, "homeButton");
             home.startup();
             // add homeButton end

             // Begin geolocate button - https://geonet.esri.com/message/440082#440082
             // add geolocate button to find the location of the current user
             map.on("load", function () {
                 geoLocate = new LocateButton({
                     map: map,
                     highlightLocation: true,
                     useTracking: true,
                     enableHighAccuracy: true
                 }, "locateButton");
                 geoLocate.clearOnTrackingStop = true;
                 geoLocate.startup();
                 geoLocate.locate();
             });
             // End geolocate button

             // overviewMap Begin
             var overviewMapDijit = new OverviewMap({
                 map: map,
                 visible: false
             });
             overviewMapDijit.startup();
             // overviewMap End

             // scalebar Begin
             var scalebar = new Scalebar({
                 map: map,
                 scalebarUnit: "dual"
             });
             // scalebar End

             // start measurement tool - the current layer we are measuring is the operational layer

             // defining the lines that will be drawn for measurement
             var layerDrawingOptions = [];
             var layerDrawingOption = new LayerDrawingOptions();
             var sfs = new SimpleFillSymbol(
                                    "solid",
                                    new SimpleLineSymbol("solid", new Color([195, 176, 23]), 2),
                                    null
                                    );


             layerDrawingOption.renderer = new SimpleRenderer(sfs);

             // change 1 to the layer index that you want to modify:
             layerDrawingOptions[1] = layerDrawingOption;


             //dojo.keys.copyKey maps to CTRL on windows and Cmd on Mac., but has wrong code for Chrome on Mac
             var snapManager = map.enableSnapping({
                 snapKey: has("mac") ? keys.META : keys.CTRL
             });

             // layer used for measuring tool. Your tool wont' show up without it.
             var layerInfos = [{
                 layer: operationalLayer
             }];

             // enables snapping
             snapManager.setLayerInfos(layerInfos);

             // looks for the domID of measurementDiv and starts the measurement tool there
             var measurement = new Measurement({
                 map: map
             }, dom.byId("measurementDiv"));
             measurement.startup();


             // end measurement tool

             // begin print Task
             app.printUrl = "http://maps.decaturil.gov/arcgis/rest/services/Utilities/PrintingTools/GPServer/Export%20Web%20Map%20Task";

             function createPrintTask(printTitle) {
                 var template = new PrintTemplate();
                 template.layout = document.getElementById("printLayoutId").value; // Assigns the layout
                 template.format = document.getElementById("printFormatId").value; // Assigns the format to printout to
                 template.layoutOptions = {
                     legendLayers: [], // empty array means no legend
                     scalebarUnit: "Miles",
                     titleText: printTitle // title to display
                 };

                 var params = new PrintParameters();
                 params.map = map;
                 params.template = template;

                 var printTask = new PrintTask(app.printUrl);
                 var printObj = {
                     printTask: printTask,
                     params: params
                 }
                 return printObj;
             }


             // Activates printer
             on(dom.byId("btnPrintReady"), "click", function () {
                 document.getElementById("btnPrintReady").innerHTML = "Printing..."
                 document.getElementById("btnPrintReady").disabled = true; // Button disable while printing
                 var printObj = createPrintTask(document.getElementById("printTitleId").value); // Gets titles displayed
                 var printTask = printObj.printTask;
                 printTask.execute(printObj.params, function (evt) {
                     document.getElementById("btnPrintReady").style.display = 'none';
                     document.getElementById("printResult").href = evt.url;
                     document.getElementById("printResult").style.display = 'block';
                     on(dom.byId("printResult"), "click", function () {
                         document.getElementById("btnPrintReady").innerHTML = "Print";
                         document.getElementById("btnPrintReady").style.display = 'block';
                         document.getElementById("btnPrintReady").disabled = false; // Button enabled to produce map print
                         document.getElementById("printResult").style.display = 'none';
                     });
                 }, function (evt) {
                     document.getElementById("btnPrintReady").disabled = false;
                     document.getElementById("btnPrintReady").innerHTML = "Print";
                 });
             });
             // end of print task

             // Hides print widget
             on(dom.byId("closePrint"), "click", function () {
                 document.getElementById("printer").style.visibility = 'hidden';
             });

             // Shows tools
             on(dom.byId("showTools"), "click", function () {
                 document.getElementById("showToolsButton").style.visibility = 'hidden';
                 document.getElementById("hideToolsButton").style.visibility = 'visible';
                 document.getElementById("showPrinter").style.visibility = 'visible';
                 document.getElementById("editor").style.visibility = 'visible';
             });

             // Hide tools
             on(dom.byId("hideTools"), "click", function () {
                 document.getElementById("showToolsButton").style.visibility = 'visible';
                 document.getElementById("hideToolsButton").style.visibility = 'hidden';
                 document.getElementById("showPrinter").style.visibility = 'hidden';
                 document.getElementById("printer").style.visibility = 'hidden';
                 document.getElementById("editor").style.visibility = 'hidden';
             });

             // Hide editor
             on(dom.byId("closeEditor"), "click", function () {
                 document.getElementById("templatePickerPane").style.visibility = 'hidden';
             });


             // Show Editor
             on(dom.byId("showEditorWidget"), "click", function () {
                 document.getElementById("templatePickerPane").style.visibility = 'visible';

             });


             // Allow editor to move with mouse or finger
             jQuery(function () {
                 jQuery("#templatePickerPane").draggable({ containment: "window" });
             });

             // Allow print widget to move with mouse or finger
             jQuery(function () {
                 jQuery("#printer").draggable({ containment: "window" });
             });

             // Show print widget
             on(dom.byId("showPrintWidget"), "click", function () {
                 document.getElementById("printer").style.visibility = 'visible';
             });


             // begin geocoder
             var geocoder = new Geocoder({
                 arcgisGeocoder: false,
                 geocoders: [{
                     url: "http://maps.decaturil.gov/arcgis/rest/services/Public/WebAddressLocator/GeocodeServer",
                     name: "Web Address Locator",
                     placeholder: "Find address",
                     outFields: "*"
                 }],
                 map: map,
                 autoComplete: true,
                 zoomScale: 600
             }, dom.byId("search"));
             geocoder.startup();

             geocoder.on("select", showGeocodeLocation);



             function showGeocodeLocation(evt) {
                 map.graphics.clear();
                 var point = evt.result.feature.geometry;
                 var symbol = new SimpleMarkerSymbol()
                                .setStyle("square")
                                .setColor([255, 0, 0, 0.5]);
                 var graphic = new Graphic(point, symbol);
                 map.graphics.add(graphic);

                 map.infoWindow.setTitle("Search Result");
                 map.infoWindow.setContent(evt.result.name);
                 map.infoWindow.show(evt.result.feature.geometry);
                 map.infoWindow.on('hide', function () {
                     map.graphics.remove(graphic);
                     destroyEditor();
                     createEditor();
                 });
             }
             // end geocoder



         });