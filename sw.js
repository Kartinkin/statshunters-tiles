const APP_CACHE='tile-grid-v4.2';
const TILE_CACHE='osm-tiles-v1';
const TILE_CACHE_LIMIT=3000;

const ASSETS=[
  './','./index.html','./style.css','./app.js','./manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(APP_CACHE).then(cache=>cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(k=>k!==APP_CACHE && k!==TILE_CACHE).map(k=>caches.delete(k))
  )));
  self.clients.claim();
});

async function trimCache(cache,limit){
  const keys=await cache.keys();
  if(keys.length>limit) await Promise.all(keys.slice(0,keys.length-limit).map(k=>cache.delete(k)));
}

async function cacheFirst(request,cacheName,trimLimit){
  const cache=await caches.open(cacheName);
  const cached=await cache.match(request);
  if(cached) return cached;
  const response=await fetch(request);
  cache.put(request,response.clone());
  if(trimLimit) trimCache(cache,trimLimit);
  return response;
}

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);

  if(url.origin===location.origin){
    event.respondWith(cacheFirst(req,APP_CACHE));
  } else if(url.hostname==='tile.openstreetmap.org'){
    // Tiles the user has already viewed stay available offline.
    event.respondWith(cacheFirst(req,TILE_CACHE,TILE_CACHE_LIMIT));
  } else if(url.hostname==='unpkg.com'){
    event.respondWith(cacheFirst(req,APP_CACHE));
  }
});
