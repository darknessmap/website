$(document).ready(function() {
    console.log('--------Go');
    D.map = L.map('map').setView([37.78089, -122.41443], 13);

    D.map.on('mousedown',function(e){
        // $('.logo').hide();
        $('#map').css({height:'100%', 'z-index':99999});
        D.map.invalidateSize(false)//.panTo(e.latlng);
        //we should remove this now.
    });

    D.map.on('blur', function(){
        // $('.logo').show();
    });

    /*
    var popup = L.popup();

	function onMapClick(e) {
		console.log("You clicked the map at " + e.latlng);
	    popup
	        .setLatLng(e.latlng)
	        .setContent("You clicked the map at " + e.latlng.toString())
	        .openOn(D.map);
	}

	D.map.on('click', onMapClick);
	*/
	//topleft:37.95276, -122.59631
    var maxBounds = [[37.6694, -122.5882],[37.9498, -122.0814]];
    // 1350617638000
    var mapConfig = {
    	maxZoom:17,
    	minZoom:14,
    	maxBounds:maxBounds
    };
    L.tileLayer('http://darknessmap.com/tiles/sf/{z}/{x}/{y}.png', mapConfig).addTo(D.map);


    //WANT TO LOAD API:
    var ajax = {
        url:'http://178.79.145.84:8080/api/darkness',
        type:'GET',
        success:D.onData,
        error:function(){
            console.log('oh oh!');
        }
    };
    $.ajax(ajax);

    //
    var socket = io.connect('http://178.79.145.84:8080');
    socket.on('sign', function(state){
        console.log('on sign udpate');
    });

    socket.on('darkness',function(data){
        console.log('on darkness: ', data);
        // D.onData(data);
    });

    socket.on('darknessUpdate',function(data){
        console.log('on darkness update',data);
        var item = $.parseJSON(data);
        D.addItem(item);
    });

    socket.on('userUpdate', function (data) {
        console.log('on connected ',data);
        socket.emit('my other event', { my: 'data' });
    });
    socket.emit('adduser','peperone_'+new Date().valueOf());
});
D = {};

var config = {
	apiDomain:"178.79.145.84:8080",
	apiUrl:'http://{apiDomain}/api/darkness',
	tileDomain:'localhost:2323',
	tileUrl:'http://{tileDomain}/{z}/{x}/{y}.png',
	socketUrl:'http://{apiDomain}'
};

var DarknessMap = function(config){
	this.config   = config;

	this.apiUrl  = this.stringReplace(config.apiUrl, config);
	this.tileUrl = this.stringReplace(config.tileUrl, config);
	this.socketUrl = this.stringReplace(config.socketUrl, config);
};

DarknessMap.prototype.simpleInterpolation = function(value, rangeStr, rangeEnd, targetStr, targetEnd)
{
    var baseRangeFull = rangeEnd - rangeStr;
    var baseFinalValue, targetCurrentValue;
        
    if (baseRangeFull === 0)
    {
        baseFinalValue = 1;
    }
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
    return template.replace(/\{(\w+)\}/g, replaceFn);
};

DarknessMap.prototype.initialize = function(){
	this.map = L.map('map').setView([37.78089, -122.41443], 15);

	L.tileLayer(this.tileUrl, {
        maxZoom: 17,
        minZoom: 15
    }).addTo(D.map);
};

DarknessMap.prototype.doAPIRequest = function(){
	var ajax = {
        url:this.apiUrl,
        type:'GET',
        success:this.onData,
        error:this.onError
    };
    $.ajax(ajax);
};

DarknessMap.prototype.onAPIData = function(data){
    //Make object from server's response.
    data = $.parseJSON(data);

    this.throttle(data, this.addItem, this, 30);
    //We should setup the map pos.
    //this.map.setView([item.loc.lat, item.loc.lon],15);
};
DarknessMap.prototype.addItem = function(item){
	var loc = item.loc;
	var radius = this.simpleInterpolation(item.payload, 0, 255, 8, 32);
	var opacity = 1 - this.simpleInterpolation(item.payload, 0,255,0.2,1);
	L.circle([loc.lat, loc.lon], radius, {
        color: 'none',
        stroke:false,
        clickable:false,
        fillColor:'#'+this.adjustBrightness('0x323232',item.payload).toString(16),
        fillOpacity: opacity
    }).addTo(this.map);
};

DarknessMap.prototype.onError = function(e){
	//TODO: Implement log error system.

};

DarknessMap.prototype.throttle = function(array, process, context, index){
    setTimeout(function(){
        var item, i = index;
        while( i-- ) {
            item = array.shift();
            item && process.call(context, item);
        }
        
        if(array.length > 0){
            arguments.callee.call(this, array, process, context, index);
        }
        
    }, 20);
};

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

DarknessMap.pubSub = o;

DarknessMap.prototype.publish = o.publish;
DarknessMap.prototype.subscribe = o.subscribe;
DarknessMap.prototype.unsubscribe = o.unsubscribe;

D.onData = function(data){
	var item;

	//FF will send string, while webkitters do a propper obj.
    if(typeof data === 'string') data = $.parseJSON(data);

    item = data[2];

    D.throttle(data, D.addItem, D, 30);

    //D.map.setView([37.78089, -122.41443],15);
     D.map.setView([37.887335736305,-122.26300486363],15);
};
function adjustBrightness(rgb, brite) {
    var r = Math.max(Math.min(((rgb >> 16) & 0xFF) + brite, 255), 0);
    var g = Math.max(Math.min(((rgb >> 8) & 0xFF) + brite, 255), 0);
    var b = Math.max(Math.min((rgb & 0xFF) + brite, 255), 0);
    
    return (r << 16) | (g << 8) | b;
}


function simpleInterpolation(value, rangeStr, rangeEnd, targetStr, targetEnd)
{
    var baseRangeFull = rangeEnd - rangeStr;
    var baseFinalValue, targetCurrentValue;
        
    if (baseRangeFull === 0)
    {
        baseFinalValue = 1;
    }
    else
    {
        baseFinalValue = (Math.min (Math.max ((value - rangeStr) / baseRangeFull, 0.0), 1.0));
    }
             
    targetCurrentValue = (targetStr + ((targetEnd - targetStr) * baseFinalValue));
    return targetCurrentValue;
}

D.addItem = function(item){
	var loc = item.loc;
	var radius = simpleInterpolation(item.payload, 0, 255, 8, 32);
	var opacity = 1 - simpleInterpolation(item.payload, 0,255,0.2,1);
	L.circle([loc.lat, loc.lon], radius, {
        color: 'none',
        stroke:false,
        clickable:false,
        fillColor:'#'+adjustBrightness('0x0',item.payload).toString(16),
        fillOpacity: opacity
    }).addTo(D.map);//.bindPopup("I am a circle.");
}

D.throttle = function(array, process, context, index){
    setTimeout(function(){
        var item, i = index;
        while( i-- ) {
            item = array.shift();
            item && process.call(context, item);
            //context[process].call(context,item);
        }
        
        if(array.length > 0){
            D.throttle.call(D, array, process, context, index);
        }
        
    }, 20);
};