const Z=14,N=2**Z;
const map=L.map('map',{zoomControl:true}).setView([56.95,24.1],13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
  maxZoom:19, attribution:'© OpenStreetMap contributors'
}).addTo(map);

let marker=null, accuracyCircle=null, gridLayer=L.layerGroup().addTo(map);
let currentTileLayer=null;
let gpsStarted=false;
let autoCenter=true;
let firstFix=true;

function lonFromX(x){return x/N*360-180}
function latFromY(y){
  return 180/Math.PI*Math.atan(Math.sinh(Math.PI*(1-2*y/N)));
}
function xy(lat,lon){
  const x=Math.floor((lon+180)/360*N);
  const r=lat*Math.PI/180;
  const y=Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*N);
  return {x,y};
}
function tileBounds(t){
  return [
    [latFromY(t.y+1), lonFromX(t.x)],
    [latFromY(t.y),   lonFromX(t.x+1)]
  ];
}
function drawGrid(){
  gridLayer.clearLayers();
  const b=map.getBounds();
  const a=xy(b.getNorth(),b.getWest()), c=xy(b.getSouth(),b.getEast());
  for(let x=a.x-1;x<=c.x+1;x++){
    const lon=lonFromX(x);
    L.polyline([[b.getSouth(),lon],[b.getNorth(),lon]],{color:'#e53935',weight:1,opacity:.65,interactive:false}).addTo(gridLayer);
  }
  for(let y=a.y-1;y<=c.y+1;y++){
    const lat=latFromY(y);
    L.polyline([[lat,b.getWest()],[lat,b.getEast()]],{color:'#e53935',weight:1,opacity:.65,interactive:false}).addTo(gridLayer);
  }
}
map.on('moveend zoomend',drawGrid); drawGrid();

function highlightTile(t){
  if(currentTileLayer) map.removeLayer(currentTileLayer);
  currentTileLayer=L.rectangle(tileBounds(t),{
    color:'#1565c0',weight:3,fillOpacity:.16,interactive:false
  }).addTo(map);
  currentTileLayer.bringToFront();
}

function showPosition(pos){
  const {latitude,longitude,accuracy:acc}=pos.coords;
  const latlng=[latitude,longitude];

  if(!marker) marker=L.circleMarker(latlng,{radius:7,weight:3,fillOpacity:.95}).addTo(map);
  else marker.setLatLng(latlng);

  if(acc){
    if(!accuracyCircle) accuracyCircle=L.circle(latlng,{radius:acc,weight:1,fillOpacity:.05}).addTo(map);
    else accuracyCircle.setLatLng(latlng).setRadius(acc);
  }

  const t=xy(latitude,longitude);
  highlightTile(t);

  document.getElementById('status').textContent =
    `GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} ±${Math.round(acc||0)} m`;
  document.getElementById('tile').textContent=`Current z14 tile: ${t.x}/${t.y}`;

  // Keep the user's position centered automatically while GPS is active.
  // If the user manually pans/zooms, stop following until GPS is pressed again.
  if(autoCenter){
    if(firstFix){
      map.setView(latlng, Math.max(map.getZoom(),15), {animate:false});
      firstFix=false;
    } else {
      map.panTo(latlng,{animate:false});
    }
  }
}

function startGPS(){
  if(gpsStarted) {
    autoCenter=true;
    if(marker) map.panTo(marker.getLatLng(),{animate:false});
    return;
  }
  if(!navigator.geolocation){
    document.getElementById('status').textContent='GPS unavailable';
    return;
  }
  gpsStarted=true;
  autoCenter=true;
  navigator.geolocation.watchPosition(
    showPosition,
    e=>document.getElementById('status').textContent='GPS error: '+e.message,
    {enableHighAccuracy:true,maximumAge:3000,timeout:15000}
  );
}

map.on('dragstart',()=>{ if(!firstFix) autoCenter=false; });
document.getElementById('locate').onclick=()=>{
  autoCenter=true;
  if(marker) map.panTo(marker.getLatLng(),{animate:false});
  else startGPS();
};
startGPS();

if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
