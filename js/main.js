$(document).ready(function() {
    console.log('--------Go');
    D.map = L.map('map').setView([40.78678, -73.96957], 15);

    L.tileLayer('http://localhost:2323/{z}/{x}/{y}.png', {
        maxZoom: 17,
        minZoom: 14
    }).addTo(D.map);

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
    });

    socket.on('darknessUpdate',function(data){
        console.log('on darkness update',data);
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

DarknessMap.prototype.stringReplace =function(template, data){
    function replaceFn() {
        var prop = arguments[1];
        return (prop in data) ? data[prop] : '';
    }
    return template.replace(/\{(\w+)\}/g, replaceFn);
};

DarknessMap.prototype.initialize = function(){
	this.map = L.map('map').setView([40.78678, -73.96957], 15);

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
	L.circle([item.loc.lat, item.loc.lon], 10, {
        color: 'none',
        fillColor: '#B2B200',
        fillOpacity: (item.payload / 255)
    }).addTo(D.map);
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
    
    data = $.parseJSON(data);

    item = data[100];

    D.throttle(data, D.addItem, D, 30);

    D.map.setView([item.loc.lat, item.loc.lon],15);
};

D.addItem = function(item){
	L.circle([item.loc.lat, item.loc.lon], 10, {
        color: 'none',
        fillColor: '#B2B200',
        fillOpacity: (item.payload / 255)
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