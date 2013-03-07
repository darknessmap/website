/*
 * G namespace.
 * g.components holds classes that should be initialized on
 * DOM ready.
 *
 * TODO: Build DI in here!
 */
var g = {};
g.configs = {};
g.components = {};

//TODO: Load config file.
var dConfig = {
    apiDomain:'178.79.145.84:8080',
    apiUrl:'http://{{apiDomain}}/api/darkness',
    // tileDomain:'tiles.mapbox.com/v3/goliatone.map-tf2bflzw',
    tileDomain:'tiles.mapbox.com/v3/veev.OSMBright',
    // tileDomain:'darknessmap.com/tiles/sf',
    tileUrl:'http://{{tileDomain}}/{z}/{x}/{y}.png',
    socketUrl:'http://{{apiDomain}}',
    throttle:30,
    fillColor:'0x0',
    baseUserName:'darko_',
    map:{
        id:'map',
        layer:{
            maxZoom:17,
            minZoom:14,
            // maxBounds:[[37.6694, -122.5882],[37.9498, -122.0814]]
            maxBounds:[[33.8658, -83.5737],[34.0162, -83.2434]]
        },
        initZoom:15,
        // initPos:[37.78089, -122.41443]
        initPos:[33.9509, -83.3965]
        // initPos:[37.887335736305,-122.26300486363]
    }
};

/**
 * MapController handles all interaction with the map.
 * It also takes care of the interaction with the node 
 * service.
 * 
 */
var MapController = function MapController(config){
    this.config   = config;
    this.appName  = 'MapController';
};

MapController.prototype.initialize = function(){
    this.log('Initialize');
    this.initializeMap();

    this.doAPIRequest();

    this.initializeSocket();

    //TODO: Find the right events.
    this.activityOn();
}

MapController.prototype.initializeMap = function(){
    this.log('Initialize Map!!!');

    var config = this.config;

    this.apiUrl    = this.stringReplace(config.apiUrl, config);
    this.tileUrl   = this.stringReplace(config.tileUrl, config);
    this.socketUrl = this.stringReplace(config.socketUrl, config);

    this.log('API URL: ', this.apiUrl);
    this.log('TILE URL: ', this.tileUrl);
    this.log('SOCKET URL: ', this.socketUrl);

    //Initialize map
    config   = config.map;
    this.map = L.map(config.id).setView(config.initPos, config.initZoom);

    //Add extra controls
    var fullScreen = new L.Control.FullScreen(); 
    this.map.addControl(fullScreen);

    // this.map.on('enterFullscreen', function(){
    //     if(window.console) window.console.log('enterFullscreen');
    //     C.onMapActive();
    // });

    // this.map.on('exitFullscreen', function(){
    //     if(window.console) window.console.log('exitFullscreen');
    //     C.onMapInactive();
    // });

    L.tileLayer(this.tileUrl, config.layer).addTo(this.map);
};

MapController.prototype.initializeSocket = function(){
    this.log('Initialize Socket');
    //Let create our socket connection.
    this.socket = io.connect( this.socketUrl );

    this.addSocketListener('sign', this.onSign);

    this.addSocketListener('darkness', this.onDarkness );

    this.addSocketListener('darknessUpdate',this.onDarknessUpdate);

    this.addSocketListener('userUpdate', this.onUserUpdate);

    //Notify that we are connected!
    this.socket.emit('adduser',this.generateUsername());
};

MapController.prototype.addSocketListener = function(topic, method){

    this.socket.on(topic, this.proxy(method));
};
///////////
//SOCKET.IO
///////////
MapController.prototype.onSign = function(state){
    this.log('signed data, ', state);
    this.connected = state;
};
MapController.prototype.onDarkness = function(data){
    console.log('on darkness: ');
    // D.onData(data);
};


MapController.prototype.onDarknessUpdate = function(data){
    console.log('on darkness update',data);
    var item = $.parseJSON(data);
    // D.addItem(item);
};

MapController.prototype.onUserUpdate = function (data) {
    console.log('on connected ',data);
    //this.socket.emit('my other event', { my: 'data' });
};

//TODO: Include pagination to data pull. Also, feed in a loc, and
//      query near items, so we don't get all the mdb.
MapController.prototype.doAPIRequest = function doAPIRequest(page, size){
    this.log(' make api request');
    var ajax = {
        url:this.apiUrl,
        type:'GET',
        error:this.proxy(this.onError),
        success:this.proxy(this.onAPIData)
    };
    $.ajax(ajax);
};

MapController.prototype.onAPIData = function onAPIData(data){
    //Make object from server's response.
    if(!data) return this.onError();
    
    //FF returns str, webkitlings obj.
    if(typeof data === 'string')
        data = $.parseJSON(data);

    this.log('We have data, total: ', data.length);
    this.log('------');
    this.log(data[3]);
    this.log('------');
    //Throttle data rendering, dont choke the browser:
    MapController.throttle(data, this.addItem, this, this.config.throttle);
};

MapController.prototype.addItem = function(item){
    //TODO Remove this.
    //HACK The iphone app logs location with lat/lon in the wrong
    //order :( a quick fix for now is to check for values and reorder.
    var loc = item.loc;
    // initPos:[lat:33.9509, lon:-83.3965]
    if(loc.lat < loc.lon){
        var lat = loc.lat;
        var lon = loc.lon;
        loc.lat = lon;
        loc.lon = lat;
    }

    //TODO: Merge config object.
    this.color || (this.color = this.config.fillColor);
    // var loc = item.loc;
    var radius  = this.simpleInterpolation(item.payload, 0, 255, 8, 32);
    var opacity = 1 - this.simpleInterpolation(item.payload, 0,255,0.2,1);
    L.circle([loc.lat, loc.lon], radius, {
        color: 'none',
        stroke:false,
        clickable:false,
        fillColor:'#'+this.adjustBrightness(this.color,item.payload).toString(16),
        fillOpacity: opacity
    }).addTo(this.map);
};

MapController.prototype.onError = function(e){
    //TODO: Implement log error system.
    this.log(e);
};

////////////////
//VIEW HANDLING
////////////////
MapController.prototype.activityOn = function(){
    this.log('on activity on');
    var self = this;
    var activityHandler = function(){
        self.log('onActivityHandler');
        self.map.on('blur', registerHandler);
        self.map.off('mousedown', activityHandler);
        self.publish('onActive');
    };

    var registerHandler = function(){
        self.log('onRegisterHandler');
        self.map.off('blur', registerHandler);
        self.map.on('mousedown', activityHandler);
        self.publish('onInactive');
    };
    // D.map.on('mousedown', activityHandler);
    registerHandler();
};


MapController.prototype.log = function(){
    console.log.apply(console, [this.appName+':'+arguments.callee.caller.name].concat(Array.prototype.slice.call(arguments,0)));
};

MapController.throttle = function(array, process, context, index){
    var buffer = MapController.throttle.buffer;
    setTimeout(function(){
        var item, i = index;
        while( i-- ) {
            item = array.shift();
            item && process.call(context, item);
        }
        
        if(array.length > 0){
            MapController.throttle.call(this, array, process, context, index);
        }
        
    }, buffer);
};
MapController.throttle.buffer = 40;

MapController.prototype.simpleInterpolation = function(value, rangeStr, rangeEnd, targetStr, targetEnd)
{
    var baseRangeFull = rangeEnd - rangeStr;
    var baseFinalValue, targetCurrentValue;
        
    if (baseRangeFull === 0) baseFinalValue = 1;
    else
    {
        baseFinalValue = (Math.min (Math.max ((value - rangeStr) / baseRangeFull, 0.0), 1.0));
    }
             
    targetCurrentValue = (targetStr + ((targetEnd - targetStr) * baseFinalValue));
    return targetCurrentValue;
};
             
 
MapController.prototype.adjustBrightness = function(rgb, brite) {
    var r = Math.max(Math.min(((rgb >> 16) & 0xFF) + brite, 255), 0);
    var g = Math.max(Math.min(((rgb >> 8) & 0xFF) + brite, 255), 0);
    var b = Math.max(Math.min((rgb & 0xFF) + brite, 255), 0);
    
    return (r << 16) | (g << 8) | b;
};

MapController.prototype.stringReplace =function(template, data){
    function replaceFn() {
        var prop = arguments[1];
        return (prop in data) ? data[prop] : '';
    }
    //TODO: Make marker chars optional.
    var  matcher = new RegExp('\\{\\{(\\w+)\\}\\}','g');
    return template.replace(matcher, replaceFn);
    // return template.replace(/\{\{(\w+)\}\}/g, replaceFn);
};

//TODO: Implement gClass inheritance, and mixin
//pub sub.
MapController.prototype.proxy = function(func){
    var self = this;
    return(function(){
        return func.apply(self, arguments);
    });
};

MapController.prototype.generateUsername = function(){
    return this.config.baseUserName + new Date().valueOf();
};


/*
 * Mixin. 
 * TODO: Move into utility package, 
 * make base Module and include there.
 * All Modules should have this func.
 */
var pubSub = function(Instance){
    var o = $({});
    o.subscribe = function() {
        o.on.apply(o, arguments);
    };

    o.unsubscribe = function() {
        o.off.apply(o, arguments);
    };

    o.publish = function() {
        o.trigger.apply(o, arguments);
    };

    Instance.pubsub = o;
    Instance.prototype.publish     = o.publish;
    Instance.prototype.subscribe   = o.subscribe;
    Instance.prototype.unsubscribe = o.unsubscribe;
};







/**
 * SiteController handles site specific
 * interaction and data.
 * 
 */
var SiteController = function(){
    this.className = 'SiteController';
};

SiteController.prototype.initialize = function()
{
    this.log('Initialize SiteController');
    //we initialize the content.
    var headerHeight = $('.top-bar', 'nav').height();
    $('.dM .fixed-ghost').height(headerHeight);
};

SiteController.prototype.onMapActive = function onMapActive(){
    this.log(' make map full size');
    //
    $('#map').css({height:'100%', 'z-index':99999});
    this.forceSizeInvalidation();
};

SiteController.prototype.onMapInactive = function onMapInactive(){
    this.log(' make map regular size');
    $('#map').css({height:'490px','z-index':0});
    this.forceSizeInvalidation();
};

SiteController.prototype.forceSizeInvalidation = function(){
    //TODO: How do we remove this depencency?! 
    //Right now the MapController instance is harcoded AND
    //accessed through the global scope :(
    this.map.invalidateSize(false);
    
    this.publish('SiteController:invalidateMap', false);
};

SiteController.prototype.setMap = function(map){
    this.map = map;
};

//Common methods, inherit!!
SiteController.prototype.log = function(){
    console.log.apply(console, [this.className+':'+arguments.callee.caller.name].concat(Array.prototype.slice.call(arguments,0)));
};
SiteController.prototype.proxy = function(func){
    var self = this;
    return(function(){
        return func.apply(self, arguments);
    });
};

var MenuController = function(){
    this.className = 'MenuController';
};

MenuController.prototype.initialize = function(){
    console.log('Initialize MenuController');
    this.lastId = null;
    this.topMenu = $('#top-menu');
    this.topMenuHeight = this.topMenu.outerHeight() + 15;

    // All list items
    this.menuItems = this.topMenu.find('a');

    // Anchors corresponding to menu items
    this.scrollItems = this.menuItems.map(function(){
        var item = $($(this).attr('href'));
        if (item.length) { return item; }
    });

    var self = this;
    // Bind click handler to menu items
    // so we can get a fancy scroll animation
    this.menuItems.click(function(e){
        var href = $(this).attr('href');
        var offsetTop = href === '#' ? 0 : $(href).offset().top - self.topMenuHeight + 1;

        $('html, body').stop().animate({
            scrollTop: offsetTop
        }, 300);

        e.preventDefault();
    });

    //Attach the window scroll handler!
    var scrollHandler = $.proxy(this.onWindowScroll, this);
    $(window).scroll(scrollHandler);
};

MenuController.prototype.onWindowScroll = function(){
    // Get container scroll position
    var fromTop = $(window).scrollTop() + this.topMenuHeight;
    
    //TODO: Check for boundaries.
    //Mac, chrome et all will allow you to scroll beyond
    //page boundaries, so we should check that we are in range.

    // Get id of current scroll item
    var cur = this.scrollItems.map(function(){
        if ($(this).offset().top < fromTop)
            return this;
    });
    // Get the id of the current element
    cur = cur[cur.length-1];
    var id = cur && cur.length ? cur[0].id : '';
   
    if (this.lastId !== id) {
        this.lastId = id;

        // Set/remove active class
        this.menuItems
            .parent().removeClass('active')
            .end().filter('[href=#'+id+']').parent().addClass('active');
    }
};



/**
 * Application instance
 */
var App = g.App = function(){
    App.instances = {};
};

App.prototype.mixPubsub = pubSub;


App.prototype.run = function(){
    console.log('App run');
    //Wire app components.
    $(document).ready( $.proxy(this.boostrap, this) );
};

App.prototype.boostrap = function(){
    console.log('App boostrap');
    this.wireComponents();
    this.injectDependencies();
}
/**
 * Here we wire all components. We should really 
 * do some sort of DI wiring. 
 * TODO: Implement low level DI...
 */
App.prototype.wireComponents = function(){
    console.log('ON DOCUMENT READY');
    var controller, ControllerClass, config;

    for( var ControllerId in g.components){
        if(! g.components.hasOwnProperty(ControllerId)) continue;
        console.log('Controller ID: ', ControllerId);
        ControllerClass = g.components[ControllerId];
        
        this.mixPubsub(ControllerClass);

        if(g.configs.hasOwnProperty(ControllerId)) config = g.configs[ControllerId];
        else config = {};

        controller = new ControllerClass(config);
        App.instances[ControllerId] = controller;
        
    }

    for(ControllerId in g.components){
        controller = App.instances[ControllerId];
        if('initialize' in controller &&
           typeof controller.initialize === 'function') controller.initialize();
    }
};

App.prototype.injectDependencies = function(){
    console.log('injectDependencies');
    var mapController  = App.instances['MapController'];
    var siteController = App.instances['SiteController'];
    
    mapController.map.on('enterFullscreen', function(){
        if(window.console) window.console.log('enterFullscreen');
        siteController.onMapActive();
    });

    mapController.map.on('exitFullscreen', function(){
        if(window.console) window.console.log('exitFullscreen');
        siteController.onMapInactive();
    });

    siteController.setMap(mapController.map);
};

/*
com.createSetter = function(name){
    name = name.charAt(0).toUpperCase() + name.slice(1);
    return 'set' + name.replace(/-([a-z])/g, function (g) { return g[1].toUpperCase() });

}
 */

/*
 * Map actual components.
 */
g.components.MapController  = MapController;
g.components.SiteController = SiteController;
g.components.MenuController = MenuController;

g.configs.MapController = dConfig;

var A = new g.App();
A.run();

