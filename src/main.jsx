import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Activity, ArrowDown, ArrowUpRight, Cloud, Compass, ExternalLink, Flame, Layers, LocateFixed, Menu, Radio, RefreshCw, Satellite, Wind, X } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './style.css';

const PLACES = [
  { name: 'Singapore', region: 'Singapore', lat: 1.35, lon: 103.82 },
  { name: 'Kuala Lumpur', region: 'Malaysia', lat: 3.14, lon: 101.69 },
  { name: 'Johor Bahru', region: 'Malaysia', lat: 1.49, lon: 103.74 },
  { name: 'Kuching', region: 'Malaysia', lat: 1.55, lon: 110.36 },
  { name: 'Pontianak', region: 'Indonesia', lat: -0.03, lon: 109.34 },
  { name: 'Palembang', region: 'Indonesia', lat: -2.99, lon: 104.76 },
  { name: 'Pekanbaru', region: 'Indonesia', lat: 0.51, lon: 101.45 },
  { name: 'Jambi', region: 'Indonesia', lat: -1.61, lon: 103.61 },
  { name: 'Medan', region: 'Indonesia', lat: 3.59, lon: 98.67 },
  { name: 'Jakarta', region: 'Indonesia', lat: -6.21, lon: 106.85 },
];
const ASMC_ITEM = 'https://api.wis2.asmc.asean.org/collections/regional_haze/items/REGIONAL_HAZE_MAP';
const PSI_URL = 'https://api-open.data.gov.sg/v2/real-time/api/psi';
const PM25_URL = 'https://api-open.data.gov.sg/v2/real-time/api/pm25';
const dateLabel = (value) => value ? new Date(value).toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Singapore' }) : '—';
const dirLabel = (deg) => ['N','NE','E','SE','S','SW','W','NW'][Math.round((deg ?? 0) / 45) % 8];
const arrowIcon = (deg, speed) => L.divIcon({ className: 'wind-marker', html: `<div class="wind-arrow" style="transform:rotate(${(deg + 180) % 360}deg)">➤</div><small>${Math.round(speed)} km/h</small>`, iconSize: [54, 38], iconAnchor: [27, 19] });

function FitRegion({ focus }) {
  const map = useMap();
  useEffect(() => { map.flyTo(focus || [1.2, 105.2], focus ? 7 : 5, { duration: 0.8 }); }, [focus, map]);
  return null;
}
function valueFor(obs, key, region = 'central') {
  const item = obs?.[key];
  if (!item) return null;
  if (Array.isArray(item)) return item.find((x) => x.region === region)?.value ?? item[0]?.value ?? null;
  if (typeof item === 'object') return item[region] ?? item.central ?? item.north ?? null;
  return item;
}
function App() {
  const [winds, setWinds] = useState([]);
  const [psi, setPsi] = useState(null);
  const [psiTime, setPsiTime] = useState(null);
  const [asmc, setAsmc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [layer, setLayer] = useState('street');
  const [selected, setSelected] = useState('Singapore');
  const [hours, setHours] = useState(0);
  const [error, setError] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const activePlace = PLACES.find((p) => p.name === selected) || PLACES[0];
  const activeWind = winds.find((x) => x.name === selected);

  async function loadData() {
    setLoading(true); setError('');
    const weatherRequests = PLACES.map(async (place) => {
      const query = new URLSearchParams({ latitude: place.lat, longitude: place.lon, hourly: 'wind_speed_10m,wind_direction_10m', forecast_days: '2', timezone: 'Asia/Singapore' });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`);
      if (!response.ok) throw new Error(`Wind feed: ${response.status}`);
      const data = await response.json();
      const index = Math.min(hours, data.hourly.time.length - 1);
      return { ...place, time: data.hourly.time[index], speed: data.hourly.wind_speed_10m[index], direction: data.hourly.wind_direction_10m[index] };
    });
    const [weatherResult, psiResult, pm25Result, asmcResult] = await Promise.allSettled([
      Promise.all(weatherRequests), fetch(PSI_URL).then((r) => { if (!r.ok) throw new Error('NEA feed unavailable'); return r.json(); }), fetch(PM25_URL).then((r) => { if (!r.ok) throw new Error('NEA PM2.5 feed unavailable'); return r.json(); }), fetch(ASMC_ITEM).then((r) => { if (!r.ok) throw new Error('ASMC feed unavailable'); return r.json(); }),
    ]);
    if (weatherResult.status === 'fulfilled') setWinds(weatherResult.value); else setError('Weather forecast could not be loaded. Check your connection and refresh.');
    if (psiResult.status === 'fulfilled') { setPsi(psiResult.value?.data?.items?.[0]?.readings || null); setPsiTime(psiResult.value?.data?.items?.[0]?.updatedTimestamp || null); }
    if (pm25Result.status === 'fulfilled') { setPsi((current) => ({ ...(current || {}), ...(pm25Result.value?.data?.items?.[0]?.readings || {}) })); }
    if (asmcResult.status === 'fulfilled') setAsmc(asmcResult.value?.properties || asmcResult.value);
    setLoading(false);
  }
  useEffect(() => { loadData(); }, [hours]);
  const pm25 = valueFor(psi, 'pm25_one_hourly', 'central');
  const psiValue = valueFor(psi, 'psi_twenty_four_hourly', 'national');
  const asmcAsset = useMemo(() => {
    if (!asmc) return null;
    const assets = asmc.assets || {};
    const candidate = Object.values(assets).find((asset) => /\.(png|jpg|jpeg|webp)(\?|$)/i.test(asset.href || ''));
    return candidate?.href || asmc.links?.find((link) => link.rel === 'enclosure')?.href || null;
  }, [asmc]);
  const focus = [activePlace.lat, activePlace.lon];

  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="brand"><span className="brand-mark"><Wind size={20}/></span><span>MONSOON<span className="brand-light"> / FIELDNOTES</span></span><button className="icon-btn close-mobile" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18}/></button></div>
      <div className="workspace-label">REGIONAL MONITOR <span className="online-dot"/></div>
      <div className="nav-group"><div className="nav-heading">MONITORING</div><button className="nav-item active"><Satellite size={17}/> Situation map <span className="nav-count">LIVE</span></button><button className="nav-item" onClick={() => document.getElementById('sources')?.scrollIntoView({ behavior: 'smooth' })}><Activity size={17}/> Data sources</button><button className="nav-item" onClick={() => document.getElementById('timeline')?.scrollIntoView({ behavior: 'smooth' })}><Layers size={17}/> Recent context</button></div>
      <div className="nav-group places-nav"><div className="nav-heading">REGION <button className="text-action" onClick={() => { setSelected('Singapore'); }}>RESET</button></div>{['Singapore','Malaysia','Indonesia'].map((region) => <button key={region} className="region-item" onClick={() => { const p = PLACES.find((x) => x.region === region); setSelected(p.name); setMobileOpen(false); }}><span className="region-dot"/>{region}<span className="region-chevron">↗</span></button>)}</div>
      <div className="sidebar-bottom"><div className="status-card"><span className="status-pulse"/><div><b>DATA CONNECTION</b><span>Public feeds · read only</span></div><span className="status-led"/></div><div className="sidebar-foot"><span>FIELDNOTES 01.24</span><span>v0.1.0</span></div></div>
    </aside>
    {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation"/>}
    <main className="main-content">
      <header className="topbar"><button className="icon-btn menu-mobile" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20}/></button><div className="breadcrumb">MONITORING <span>/</span> <b>REGIONAL SITUATION</b></div><div className="topbar-right"><span className="updated"><span className="live-dot"/> FEEDS {loading ? 'UPDATING' : 'CONNECTED'}</span><button className="refresh-btn" onClick={loadData}><RefreshCw size={14} className={loading ? 'spin' : ''}/> REFRESH</button></div></header>
      <div className="page-wrap">
        <section className="page-intro"><div><div className="eyebrow">SOUTHEAST ASIA <span>•</span> DAILY BRIEF</div><h1>Regional haze <i>watch.</i></h1><p>Fire detections, near-surface wind forecasts, and air quality context across the maritime region.</p></div><div className="intro-date"><span>LOCAL TIME · SGT (UTC+8)</span><b>{new Date().toLocaleDateString('en-SG',{weekday:'short',day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Singapore'}).toUpperCase()}</b></div></section>
        <section className="stats-grid">
          <article className="stat-card"><div className="stat-head"><span>24H PSI</span><span className="stat-icon violet"><Activity size={16}/></span></div><div className="stat-value">{psiValue ?? '—'}<small>{psiValue != null ? ' index' : ' no feed'}</small></div><div className="stat-foot"><span className="stat-neutral">{psiValue != null ? 'Singapore · national' : 'Singapore NEA feed'}</span><span>UPDATED {psiTime ? dateLabel(psiTime).split(',')[1] : '—'}</span></div></article>
          <article className="stat-card"><div className="stat-head"><span>PM₂.₅ · 1H</span><span className="stat-icon amber"><Cloud size={16}/></span></div><div className="stat-value">{pm25 ?? '—'}<small>{pm25 != null ? ' µg/m³' : ' no feed'}</small></div><div className="stat-foot"><span className="stat-neutral">{pm25 != null ? 'Singapore · latest reading' : 'NEA observation'}</span><span>OBSERVED</span></div></article>
          <article className="stat-card"><div className="stat-head"><span>WIND · {selected.toUpperCase()}</span><span className="stat-icon blue"><Wind size={16}/></span></div><div className="stat-value">{activeWind?.speed ?? '—'}<small> km/h</small></div><div className="stat-foot"><span className="stat-neutral">{activeWind ? `${dirLabel(activeWind.direction)} · from ${activeWind.direction}°` : 'Forecast wind'}</span><span>AT +{hours}H</span></div></article>
          <article className="stat-card source-stat"><div className="stat-head"><span>REGIONAL PRODUCT</span><span className="stat-icon green"><Satellite size={16}/></span></div><div className="stat-value source-value">{asmc ? 'ASMC' : '—'}<small>{asmc ? ' daily map' : ' feed unavailable'}</small></div><div className="stat-foot"><span className="stat-neutral">NOAA hotspots · 2,500 ft wind</span><span>DAILY</span></div></article>
        </section>
        {error && <div className="error-banner"><span>{error}</span><button onClick={loadData}>Retry</button></div>}
        <section className="map-panel"><div className="panel-head"><div><div className="panel-kicker">LIVE VIEW <span className="pulse-small"/></div><h2>Fire activity &amp; wind field</h2></div><div className="map-controls"><button onClick={() => setLayer(layer === 'street' ? 'satellite' : 'street')}><Layers size={15}/>{layer === 'street' ? 'SATELLITE' : 'STREET'} LAYER</button><button onClick={() => setSelected('Singapore')}><LocateFixed size={15}/> RESET VIEW</button></div></div>
          <div className="map-layout"><div className="map-frame"><MapContainer center={[1.2,105.2]} zoom={5} zoomControl={false} scrollWheelZoom minZoom={3} maxZoom={12}><TileLayer key={layer} attribution={layer === 'street' ? '&copy; OpenStreetMap contributors' : 'Tiles &copy; Esri'} url={layer === 'street' ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'}/>{winds.map((w) => <React.Fragment key={w.name}><Marker position={[w.lat,w.lon]} icon={arrowIcon(w.direction,w.speed)} eventHandlers={{click:()=>setSelected(w.name)}}><Popup><b>{w.name}</b><br/>{w.speed} km/h · {dirLabel(w.direction)} wind</Popup></Marker>{w.name === selected && <CircleMarker center={[w.lat,w.lon]} radius={9} pathOptions={{color:'#c45f39',weight:2,fillOpacity:0}}/>}</React.Fragment>)}<FitRegion focus={focus}/></MapContainer><div className="map-credit">BASEMAP · {layer.toUpperCase()}</div><div className="map-note"><b>MODEL WIND</b><span>10 m · hourly forecast</span></div></div>
            <aside className="map-rail"><div className="rail-block"><div className="rail-label"><span className="rail-number">01</span> LAYER KEY</div><div className="legend-row"><span className="legend-wind">➤</span><span><b>Surface wind</b><small>Direction of travel · km/h</small></span></div><div className="legend-row"><span className="legend-fire"><Flame size={14}/></span><span><b>Active fire hotspot</b><small>Shown in ASMC product</small></span></div><div className="legend-row"><span className="legend-ring"/><span><b>Selected location</b><small>{selected}</small></span></div></div><div className="rail-block selected-card"><div className="rail-label"><span className="rail-number">02</span> SELECTED AREA</div><h3>{selected}</h3><div className="coord">{activePlace.lat.toFixed(2)}° {activePlace.lat >= 0 ? 'N' : 'S'} · {activePlace.lon.toFixed(2)}° E</div><div className="wind-reading"><span className="wind-big"><Wind size={20}/></span><div><b>{activeWind ? `${activeWind.speed} km/h` : 'Loading…'}</b><small>{activeWind ? `${dirLabel(activeWind.direction)} wind · ${activeWind.direction}°` : 'Forecast wind'}</small></div></div><div className="forecast-time">FORECAST VALID <b>{activeWind ? dateLabel(activeWind.time) : '—'}</b></div><button className="rail-link" onClick={() => document.getElementById('wind-control')?.scrollIntoView({behavior:'smooth'})}>EXPLORE FORECAST <ArrowUpRight size={14}/></button></div><div className="rail-foot">Wind is an environmental context layer. It does not predict smoke concentration or health exposure.</div></aside></div>
        </section>
        <section className="lower-grid"><article className="timeline-panel" id="timeline"><div className="panel-head compact"><div><div className="panel-kicker">FORECAST CONTROL</div><h2>Wind outlook</h2></div><span className="forecast-badge"><Radio size={13}/> OPEN-METEO</span></div><div className="timeline-summary"><div><span>SELECTED LOCATION</span><b>{selected}</b></div><div><span>WIND AT +{hours} HOURS</span><b>{activeWind ? `${activeWind.speed} km/h ${dirLabel(activeWind.direction)}` : '—'}</b></div><div><span>VALID TIME (SGT)</span><b>{activeWind ? dateLabel(activeWind.time) : '—'}</b></div></div><div className="slider-row"><span>NOW</span><input id="wind-control" type="range" min="0" max="23" value={hours} onChange={(e) => setHours(Number(e.target.value))}/><span>+24H</span></div><div className="hours-label"><span>NOW</span><span>+6H</span><span>+12H</span><span>+18H</span><span>+24H</span></div><div className="outlook-note"><Compass size={15}/><span>Forecast guidance only. Use official advisories for safety decisions.</span></div></article>
          <article className="source-panel" id="sources"><div className="panel-head compact"><div><div className="panel-kicker">OBSERVATION PRODUCT</div><h2>Daily regional haze map</h2></div><span className="source-badge">ASMC · OFFICIAL</span></div>{asmcAsset ? <div className="asmc-preview"><img src={asmcAsset} alt="Latest ASMC daily regional haze map"/><a href={asmcAsset} target="_blank" rel="noreferrer" aria-label="Open ASMC map"><ExternalLink size={14}/></a></div> : <div className="asmc-placeholder"><Satellite size={23}/><span>{loading ? 'Connecting to ASMC WIS 2.0…' : 'Map image is available on the ASMC portal'}</span><a href="https://wis2.asmc.asean.org/regional-haze-situation/" target="_blank" rel="noreferrer">OPEN ASMC REGIONAL HAZE PAGE <ArrowUpRight size={13}/></a></div>}<div className="source-meta"><span>Hotspots: NOAA satellite</span><span>Winds: 2,500 ft model analysis</span></div></article></section>
        <footer className="page-footer"><span>MONSOON / FIELDNOTES <span className="footer-dot">•</span> PUBLIC DATA SITUATIONAL AWARENESS</span><span>NOT AN OFFICIAL FORECAST OR HEALTH ADVISORY</span></footer>
      </div>
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
