$(document).ready(function() {
    console.log('--------Go!!!!!');
    /*
    //TODO: Add cluster pluster
    //https://github.com/Leaflet/Leaflet.markercluster
    //Add full screen support 
    //https://github.com/brunob/leaflet.fullscreen
    */

    /*
    var popup = L.popup();

    function onMapClick(e) {
        console.log('You clicked the map at ' + e.latlng);
        popup
            .setLatLng(e.latlng)
            .setContent('You clicked the map at ' + e.latlng.toString())
            .openOn(D.map);
    }

    D.map.on('click', onMapClick);
    
*/
    C.initialize();

    D.initialize();
    //We could prob. just use socket instead of
    //direct request.
    D.doAPIRequest();

    D.initializeSocket();

    //TODO: Find the right events.
    D.activityOn();

    // D.subscribe('onActive',   C.proxy(C.onMapActive));
    // D.subscribe('onInactive', C.proxy(C.onMapInactive));
    //
   /*************************************/
   // Cache selectors
    var lastId,
        topMenu = $('#top-menu'),
        topMenuHeight = topMenu.outerHeight()+15,
        // All list items
        menuItems = topMenu.find('a'),
        // Anchors corresponding to menu items
        scrollItems = menuItems.map(function(){
            var item = $($(this).attr('href'));
            if (item.length) { return item; }
        });

    // Bind click handler to menu items
    // so we can get a fancy scroll animation
    menuItems.click(function(e){
      var href = $(this).attr('href'),
          offsetTop = href === '#' ? 0 : $(href).offset().top-topMenuHeight+1;
      $('html, body').stop().animate({ 
          scrollTop: offsetTop
      }, 300);
      e.preventDefault();
    });

    // Bind to scroll
    $(window).scroll(function(){
       // Get container scroll position
       var fromTop = $(this).scrollTop()+topMenuHeight;
       
       // Get id of current scroll item
       var cur = scrollItems.map(function(){
         if ($(this).offset().top < fromTop)
           return this;
       });
       // Get the id of the current element
       cur = cur[cur.length-1];
       var id = cur && cur.length ? cur[0].id : '';
       
       if (lastId !== id) {
           lastId = id;
           // Set/remove active class
           menuItems
             .parent().removeClass('active')
             .end().filter('[href=#'+id+']').parent().addClass('active');
        }
    });
   /*************************************/
});
 
 //D.map = L.map('map').setView([37.78089, -122.41443], 13);

//TODO: Load config file.
var config = {
    apiDomain:'178.79.145.84:8080',
    apiUrl:'http://{{apiDomain}}/api/darkness',
    tileDomain:'darknessmap.com/tiles/sf',
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
            maxBounds:[[37.6694, -122.5882],[37.9498, -122.0814]]
        },
        initZoom:15,
        initPos:[37.78089, -122.41443]
        // initPos:[37.887335736305,-122.26300486363]
    }
};

var DarknessMap = function DarknessMap(config){
    this.config   = config;
    this.appName  = 'DarknessMap';
};



DarknessMap.prototype.initialize = function(){
    this.log('Initialize');

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

    this.map.on('enterFullscreen', function(){
        if(window.console) window.console.log('enterFullscreen');
        C.onMapActive();
    });

    this.map.on('exitFullscreen', function(){
        if(window.console) window.console.log('exitFullscreen');
        C.onMapInactive();
    });

    L.tileLayer(this.tileUrl, config.layer).addTo(this.map);
};

DarknessMap.prototype.initializeSocket = function(){

    //Let create our socket connection.
    this.socket = io.connect( this.socketUrl );

    this.addSocketListener('sign', this.onSign);

    this.addSocketListener('darkness', this.onDarkness );

    this.addSocketListener('darknessUpdate',this.onDarknessUpdate);

    this.addSocketListener('userUpdate', this.onUserUpdate);

    //Notify that we are connected!
    this.socket.emit('adduser',this.generateUsername());
};

DarknessMap.prototype.addSocketListener = function(topic, method){
    this.socket.on(topic, this.proxy(method));
};
///////////
//SOCKET.IO
///////////
DarknessMap.prototype.onSign = function(state){
    this.log('signed data, ', state);
    this.connected = state;
};
DarknessMap.prototype.onDarkness = function(data){
    console.log('on darkness: ');
    // D.onData(data);
};


DarknessMap.prototype.onDarknessUpdate = function(data){
    console.log('on darkness update',data);
    var item = $.parseJSON(data);
    // D.addItem(item);
};

DarknessMap.prototype.onUserUpdate = function (data) {
    console.log('on connected ',data);
    //this.socket.emit('my other event', { my: 'data' });
};

//TODO: Include pagination to data pull. Also, feed in a loc, and
//      query near items, so we don't get all the mdb.
DarknessMap.prototype.doAPIRequest = function doAPIRequest(page, size){
    this.log(' make api request');
    var ajax = {
        url:this.apiUrl,
        type:'GET',
        error:this.proxy(this.onError),
        success:this.proxy(this.onAPIData)
    };
    $.ajax(ajax);
};

DarknessMap.prototype.onAPIData = function onAPIData(data){
    //Make object from server's response.
    if(!data) return this.onError();
    
    //FF returns str, webkitlings obj.
    if(typeof data === 'string')
        data = $.parseJSON(data);

    this.log('We have data, total: ', data.length);

    //Throttle data rendering, dont choke the browser:
    DarknessMap.throttle(data, this.addItem, this, this.config.throttle);
};

DarknessMap.prototype.addItem = function(item){
    //TODO: Merge config object.
    this.color || (this.color = this.config.fillColor);
    var loc = item.loc;
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

DarknessMap.prototype.onError = function(e){
    //TODO: Implement log error system.
    this.log(e);
};

////////////////
//VIEW HANDLING
////////////////
DarknessMap.prototype.activityOn = function(){
    this.log('on activity on');

    var activityHandler = function(){
        D.log('onActivityHandler');
        D.map.on('blur', registerHandler);
        D.map.off('mousedown', activityHandler);
        D.publish('onActive');
    };

    var registerHandler = function(){
        D.log('onRegisterHandler');
        D.map.off('blur', registerHandler);
        D.map.on('mousedown', activityHandler);
        D.publish('onInactive');
    };
    // D.map.on('mousedown', activityHandler);
    registerHandler();
};


DarknessMap.prototype.log = function(){
    console.log.apply(console, [this.appName+':'+arguments.callee.caller.name].concat(Array.prototype.slice.call(arguments,0)));
};

DarknessMap.throttle = function(array, process, context, index){
    var buffer = DarknessMap.throttle.buffer;
    setTimeout(function(){
        var item, i = index;
        while( i-- ) {
            item = array.shift();
            item && process.call(context, item);
        }
        
        if(array.length > 0){
            DarknessMap.throttle.call(this, array, process, context, index);
        }
        
    }, buffer);
};
DarknessMap.throttle.buffer = 40;

DarknessMap.prototype.simpleInterpolation = function(value, rangeStr, rangeEnd, targetStr, targetEnd)
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
             
 
DarknessMap.prototype.adjustBrightness = function(rgb, brite) {
    var r = Math.max(Math.min(((rgb >> 16) & 0xFF) + brite, 255), 0);
    var g = Math.max(Math.min(((rgb >> 8) & 0xFF) + brite, 255), 0);
    var b = Math.max(Math.min((rgb & 0xFF) + brite, 255), 0);
    
    return (r << 16) | (g << 8) | b;
};

DarknessMap.prototype.stringReplace =function(template, data){
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
DarknessMap.prototype.proxy = function(func){
    var self = this;
    return(function(){
        return func.apply(self, arguments);
    });
};

DarknessMap.prototype.generateUsername = function(){
    return this.config.baseUserName + new Date().valueOf();
};

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





//App should initialize Map, then hookup controller and
//views. We take one step at a time, and refactor.
//The goal is there, just follow through.
var D = new DarknessMap(config);

//
var SiteController = function(){
    this.className = 'SiteController';
};

SiteController.prototype.initialize = function()
{
    //we initialize the content.
    var headerHeight = $('.top-bar', 'nav').height();
    $('.dM .fixed-ghost').height(headerHeight);
};

SiteController.prototype.onMapActive = function onMapActive(){
    this.log(' make map full size');
    //
    $('#map').css({height:'100%', 'z-index':99999});
    D.map.invalidateSize(false);//.panTo(e.latlng);
};

SiteController.prototype.onMapInactive = function onMapInactive(){
    this.log(' make map regular size');
    $('#map').css({height:'490px','z-index':0});
    D.map.invalidateSize(false);
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
var C = new SiteController();

//Make classes dispatchers.
pubSub(DarknessMap);
pubSub(SiteController);
