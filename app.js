const Z=14,N=2**Z;
const map=L.map('map',{zoomControl:true}).setView([56.95,24.1],13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
  maxZoom:19, attribution:'© OpenStreetMap contributors'
}).addTo(map);

let marker=null, accuracy=null, gridLayer=L.layerGroup().addTo(map);

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
function drawGrid(){
  gridLayer.clearLayers();
  const b=map.getBounds();
  const a=xy(b.getNorth(),b.getWest()), c=xy(b.getSouth(),b.getEast());
  for(let x=a.x-1;x<=c.x+1;x++){
    const lon=lonFromX(x);
    L.polyline([[b.getSouth(),lon],[b.getNorth(),lon]],{className:'grid-line',color:'#e53935',weight:1,opacity:.65,interactive:false}).addTo(gridLayer);
  }
  for(let y=a.y-1;y<=c.y+1;y++){
    const lat=latFromY(y);
    L.polyline([[lat,b.getWest()],[lat,b.getEast()]],{className:'grid-line',color:'#e53935',weight:1,opacity:.65,interactive:false}).addTo(gridLayer);
  }
}
map.on('moveend zoomend',drawGrid); drawGrid();

function showPosition(pos){
  const {latitude,longitude,accuracy:acc}=pos.coords;
  if(!marker) marker=L.circleMarker([latitude,longitude],{radius:7,weight:3,fillOpacity:.9}).addTo(map);
  else marker.setLatLng([latitude,longitude]);
  if(accuracy){
    if(!accuracy) accuracy=L.circle([latitude,longitude],{radius:acc,weight:1,fillOpacity:.05}).addTo(map);
    else accuracy.setLatLng([latitude,longitude]).setRadius(acc);
  }
  const t=xy(latitude,longitude);
  document.getElementById('status').textContent=`GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} ±${Math.round(acc)} m`;
  document.getElementById('tile').textContent=`z14 tile: ${t.x}/${t.y}`;
}
function startGPS(){
  if(!navigator.geolocation){document.getElementById('status').textContent='GPS unavailable';return}
  navigator.geolocation.watchPosition(showPosition,
    e=>document.getElementById('status').textContent='GPS error: '+e.message,
    {enableHighAccuracy:true,maximumAge:3000,timeout:15000});
}
document.getElementById('locate').onclick=()=>{startGPS();};
startGPS();

if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
