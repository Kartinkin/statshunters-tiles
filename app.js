const Z=14,N=2**Z;
const map=L.map('map',{zoomControl:true}).setView([56.95,24.1],13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
  maxZoom:19, attribution:'© OpenStreetMap contributors'
}).addTo(map);

let marker=null, accuracyCircle=null, visitedLayer=L.layerGroup().addTo(map), gridLayer=L.layerGroup().addTo(map);
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
let minZoom=parseInt(localStorage.getItem('sh_min_zoom'))||11;
const TILES_ZOOM_OFFSET=5; // tiles stay visible this many zoom steps below the grid's cutoff

function drawGrid(){
  gridLayer.clearLayers();
  if(map.getZoom()<minZoom) return;
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

const SH_API='https://www.statshunters.com/api';
const visitedTiles=new Map();

function updateVisitedVisibility(){
  const show=map.getZoom()>=minZoom-TILES_ZOOM_OFFSET;
  if(show && !map.hasLayer(visitedLayer)) visitedLayer.addTo(map);
  if(!show && map.hasLayer(visitedLayer)) map.removeLayer(visitedLayer);
}

function currentTileOpacity(){
  return map.getZoom()<minZoom ? 0.65 : 0.25;
}
function updateTilesOpacity(){
  const op=currentTileOpacity();
  visitedTiles.forEach(rect=>rect.setStyle({fillOpacity:op}));
}

map.on('zoomend',()=>{ updateVisitedVisibility(); updateTilesOpacity(); });
updateVisitedVisibility();

function tileKey(t){return t.x+','+t.y}

function addVisitedTile(t){
  const key=tileKey(t);
  if(visitedTiles.has(key)) return;
  const rect=L.rectangle(tileBounds(t),{
    color:'#ff0000',weight:0,fillColor:'#ff0000',fillOpacity:currentTileOpacity(),interactive:false
  }).addTo(visitedLayer);
  visitedTiles.set(key,rect);
}

function loadTilesFromCache(){
  try{
    const raw=localStorage.getItem('sh_tiles');
    if(!raw) return;
    JSON.parse(raw).forEach(([x,y])=>addVisitedTile({x,y}));
  }catch(e){}
}

function saveTilesToCache(){
  const arr=[...visitedTiles.keys()].map(k=>k.split(',').map(Number));
  localStorage.setItem('sh_tiles',JSON.stringify(arr));
}

async function fetchAllTiles(token){
  const res=await fetch(`${SH_API}/${encodeURIComponent(token)}/tiles`);
  if(!res.ok) throw new Error('HTTP '+res.status);
  const data=await res.json();
  for(const t of data.tiles||[]) addVisitedTile(t);
}

const tokenInput=document.getElementById('sh-token');
const syncBtn=document.getElementById('sh-sync');
const shStatus=document.getElementById('sh-status');
const shForm=document.getElementById('sh-form');
const shSaved=document.getElementById('sh-saved');
const shChangeBtn=document.getElementById('sh-change');
const reloadBtn=document.getElementById('reload-btn');

function showTokenForm(show){
  shForm.classList.toggle('hidden',!show);
  shSaved.classList.toggle('hidden',show);
}
function applySavedToken(token){
  tokenInput.value=token;
  showTokenForm(false);
}

async function syncTiles(){
  const token=tokenInput.value.trim();
  if(!token){ shStatus.textContent='Enter a StatsHunters API token first'; return; }
  syncBtn.disabled=true;
  shStatus.textContent='Loading tiles…';
  try{
    await fetchAllTiles(token);
    saveTilesToCache();
    localStorage.setItem('sh_token',token);
    applySavedToken(token);
    shStatus.textContent=`Tiles: ${visitedTiles.size} (synced)`;
  }catch(e){
    shStatus.textContent='Sync failed: '+e.message;
  }finally{
    syncBtn.disabled=false;
  }
}

const settingsBtn=document.getElementById('settings-btn');
const settingsOverlay=document.getElementById('settings-overlay');
const settingsClose=document.getElementById('settings-close');
const zoomInput=document.getElementById('zoom-setting');

function openSettings(){ settingsOverlay.classList.remove('hidden'); }
function closeSettings(){ settingsOverlay.classList.add('hidden'); }

zoomInput.value=minZoom;
zoomInput.onchange=()=>{
  minZoom=parseInt(zoomInput.value)||1;
  localStorage.setItem('sh_min_zoom',minZoom);
  drawGrid();
  updateVisitedVisibility();
  updateTilesOpacity();
};

settingsBtn.onclick=openSettings;
settingsClose.onclick=closeSettings;
settingsOverlay.onclick=e=>{ if(e.target===settingsOverlay) closeSettings(); };

const savedToken=localStorage.getItem('sh_token')||'';
if(savedToken) applySavedToken(savedToken);
else { showTokenForm(true); openSettings(); }
loadTilesFromCache();
if(visitedTiles.size) shStatus.textContent=`Tiles: ${visitedTiles.size} (cached)`;
syncBtn.onclick=syncTiles;
shChangeBtn.onclick=()=>showTokenForm(true);
reloadBtn.onclick=syncTiles;

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

  document.getElementById('status').textContent=`GPS: active ±${Math.round(acc||0)} m`;

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
  if(gpsStarted) return;
  if(!navigator.geolocation){
    document.getElementById('status').textContent='GPS unavailable';
    return;
  }
  gpsStarted=true;
  navigator.geolocation.watchPosition(
    showPosition,
    e=>document.getElementById('status').textContent='GPS error: '+e.message,
    {enableHighAccuracy:true,maximumAge:3000,timeout:15000}
  );
}

const followBtn=document.getElementById('follow');
function setFollow(on){
  autoCenter=on;
  followBtn.classList.toggle('active',on);
}

map.on('dragstart',()=>{ if(!firstFix) setFollow(false); });
followBtn.onclick=()=>{
  if(autoCenter){
    setFollow(false);
  } else {
    setFollow(true);
    if(marker) map.panTo(marker.getLatLng(),{animate:false});
  }
  startGPS();
};
startGPS();

if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
