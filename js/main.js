var D = {};

$(document).ready(function() {
    console.log('--------Go');
    D.map = L.map('map').setView([40.78678, -73.96957], 15);

    L.tileLayer('http://localhost:2323/{z}/{x}/{y}.png', {
        maxZoom: 17,
    }).addTo(D.map);

    //WANT TO LOAD API:
    var ajax = {
        url:'http://178.79.145.84:8080/api/darkness',
        type:'GET',
        success:function(data) {
            var item;
            //console.log('we got data: ',data);
            data = $.parseJSON(data);
            for(var i = 0; i < data.length; i++){
                item = data[i];
                
                L.circle([item.loc.lat, item.loc.lon], 10, {
                    color: 'none',
                    fillColor: '#B2B200',
                    fillOpacity: (item.payload / 255)
                }).addTo(D.map);//.bindPopup("I am a circle.");
            }

            D.map.setView([item.loc.lat, item.loc.lon],15);
        },
        error:function(){
            console.log('oh oh!');
        }
    };
    $.ajax(ajax); 
});
        // var popup = L.popup();

        // function onMapClick(e) {
        //  popup
        //      .setLatLng(e.latlng)
        //      .setContent("You clicked the map at " + e.latlng.toString())
        //      .openOn(map);
        // }

        // map.on('click', onMapClick);