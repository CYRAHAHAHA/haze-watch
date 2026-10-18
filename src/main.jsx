import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { ArrowDownRight, ArrowRight, ArrowUpRight, RefreshCw, Satellite } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './style.css';

const SINGAPORE = { lat: 1.35, lon: 103.82 };
const HISTORY_URL = `${import.meta.env.BASE_URL}hotspot-history.json`;
const WIND_URL = `https://api.open-meteo.com/v1/forecast?latitude=${SINGAPORE.lat}&longitude=${SINGAPORE.lon}&daily=wind_speed_10m_max,wind_direction_10m_dominant&forecast_days=3&timezone=Asia%2FSingapore`;
const AGE = [
  { label: 'Today', color: '#f5865e', opacity: 0.7 },
  { label: 'Yesterday', color: '#e8b77a', opacity: 0.34 },
  { label: '2 days ago', color: '#cad0b1', opacity: 0.2 },
];

function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function regionOf(point) {
  if (point.lon >= 102 && point.lon <= 105 && point.lat >= 1.5 && point.lat <= 7) return 'Peninsular Malaysia';
  if (point.lon < 108 && point.lat > -6 && point.lat < 7) return 'Sumatra';
  if (point.lon >= 108 && point.lon < 119 && point.lat > -6 && point.lat < 8) return 'Borneo';
  return 'Nearby region';
}

function angleDifference(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

function bearing(from, to) {
  const rad = Math.PI / 180;
  const lat1 = from.lat * rad;
  const lat2 = to.lat * rad;
  const dLon = (to.lon - from.lon) * rad;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

function compass(degrees) {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8];
}

function shortDate(date) {
  return new Date(`${date}T12:00:00+08:00`).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
}

function groupPoints(points) {
  const cells = new Map();
  for (const point of points) {
    const latKey = Math.floor(point.lat / 0.35);
    const lonKey = Math.floor(point.lon / 0.35);
    const key = `${latKey}:${lonKey}`;
    const cell = cells.get(key) || { latTotal: 0, lonTotal: 0, count: 0 };
    cell.latTotal += point.lat;
    cell.lonTotal += point.lon;
    cell.count += 1;
    cells.set(key, cell);
  }
  return [...cells.values()].map((cell) => ({
    lat: cell.latTotal / cell.count,
    lon: cell.lonTotal / cell.count,
    count: cell.count,
  }));
}

function MapCenter() {
  const map = useMap();
  useEffect(() => { map.setView([1.25, 105.2], 5.2); }, [map]);
  return null;
}

function CircleLegend({ snapshots }) {
  const lastThree = snapshots.slice(-3).reverse();
  return <div className="map-legend">
    {lastThree.map((snapshot, index) => <span key={snapshot.date}><i style={{ background: AGE[index].color }} />{AGE[index].label}</span>)}
    <small>VIIRS active fire detections</small>
  </div>;
}

function Outlook({ snapshots, wind }) {
  const samples = snapshots.slice(-3);
  if (samples.length < 3) {
    return <div className="outlook-copy">
      <strong>Building a 3-day trend</strong>
      <p>Today’s first satellite pass is recorded. Daily hotspot history will fill in over the next two days.</p>
      {samples.length > 0 && <>
        <div className="range-label">Hotspots within 750 km</div>
        <div className="trend-row">
          {samples.map((day) => <span key={day.date}><b>{day.hotspots.filter((point) => distanceKm(SINGAPORE, point) <= 750).length}</b><small>{shortDate(day.date)}</small></span>)}
        </div>
      </>}
    </div>;
  }

  const nearby = samples.map((day) => day.hotspots.filter((point) => distanceKm(SINGAPORE, point) <= 750));
  const recent = nearby.at(-1);
  const previous = nearby.slice(0, 2).flat();
  const currentByRegion = new Map();
  for (const point of recent) currentByRegion.set(regionOf(point), (currentByRegion.get(regionOf(point)) || 0) + 1);
  const source = [...currentByRegion.entries()].sort((a, b) => b[1] - a[1])[0];
  const previousCount = previous.length / 2;
  const changing = recent.length > previousCount * 1.2 ? 'rising' : recent.length < previousCount * 0.8 ? 'easing' : 'steady';
  const sourcePoints = source ? recent.filter((point) => regionOf(point) === source[0]) : [];
  const center = sourcePoints.length ? sourcePoints.reduce((sum, point) => ({ lat: sum.lat + point.lat / sourcePoints.length, lon: sum.lon + point.lon / sourcePoints.length }), { lat: 0, lon: 0 }) : null;
  const windDays = wind?.daily?.time?.slice(0, 3).map((date, index) => ({
    date,
    speed: wind.daily.wind_speed_10m_max[index],
    direction: wind.daily.wind_direction_10m_dominant[index],
  })) || [];
  const carriesFromSource = center && windDays.some((day) => angleDifference(day.direction, bearing(SINGAPORE, center)) < 70);

  let title = 'No nearby hotspots in the latest pass';
  let detail = 'No fire detections were recorded within about 750 km of Singapore today.';
  let Icon = ArrowRight;
  if (source) {
    const trendText = changing === 'rising' ? 'increased' : changing === 'easing' ? 'decreased' : 'held steady';
    title = `Nearby fire activity ${trendText}`;
    Icon = changing === 'rising' ? ArrowUpRight : changing === 'easing' ? ArrowDownRight : ArrowRight;
    detail = carriesFromSource
      ? `Most detections are in ${source[0]}. Forecast winds may carry smoke from that direction toward Singapore.`
      : `Most detections are in ${source[0]}. Forecast winds do not consistently point from that area toward Singapore.`;
  } else if (recent.length) {
    title = `Nearby fire activity ${changing}`;
    detail = `${recent.length} hotspot${recent.length === 1 ? '' : 's'} within about 750 km today. Winds and fire activity can shift quickly.`;
  }

  return <div className="outlook-copy">
    <div className="outlook-title"><Icon size={19} strokeWidth={1.8} /><strong>{title}</strong></div>
    <p>{detail}</p>
    <div className="range-label">Hotspots within 750 km</div>
    <div className="trend-row" aria-label="Hotspots within 750 kilometres of Singapore over the past three days">
      {samples.map((day, index) => <span key={day.date}><b>{nearby[index].length}</b><small>{shortDate(day.date)}</small></span>)}
    </div>
    {windDays.length > 0 && <p className="wind-note">Next 3 days: {windDays.map((day) => compass(day.direction)).join(' · ')} winds, {Math.round(windDays[0].speed)} km/h today.</p>}
  </div>;
}

function App() {
  const [history, setHistory] = useState({ snapshots: [] });
  const [wind, setWind] = useState(null);
  const [mapType, setMapType] = useState('satellite');
  const [updated, setUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [historyResponse, windResponse] = await Promise.all([
        fetch(`${HISTORY_URL}?v=${Date.now()}`),
        fetch(WIND_URL),
      ]);
      if (!historyResponse.ok) throw new Error('Hotspot history is not available yet.');
      if (!windResponse.ok) throw new Error('Wind forecast is temporarily unavailable.');
      const [historyData, windData] = await Promise.all([historyResponse.json(), windResponse.json()]);
      setHistory(historyData);
      setUpdated(historyData.updatedAt || null);
      setWind(windData);
    } catch (cause) {
      setError(cause.message || 'Could not load the latest haze context.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const snapshots = useMemo(() => history.snapshots?.slice(-3) || [], [history]);
  const totalToday = snapshots.length ? snapshots.at(-1)?.hotspots?.length || 0 : '—';

  return <main className="watch-page">
    <header className="topbar">
      <a className="wordmark" href="#top" aria-label="Singapore Haze Watch home"><Satellite size={17} /> HAZE WATCH <span>· SINGAPORE</span></a>
      <div className="header-meta"><span>{updated ? `Updated ${new Date(updated).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Singapore' })} SGT` : 'Regional satellite watch'}</span><button className="refresh" onClick={loadData} aria-label="Refresh data"><RefreshCw size={15} className={loading ? 'spin' : ''}/></button></div>
    </header>

    <section className="intro" id="top">
      <div><h1>Is haze moving<br/><em>towards Singapore?</em></h1><p>Recent fire hotspots and wind direction, in one view.</p></div>
      <div className="today-count"><b>{totalToday}</b><span>hotspots today<br/>within the map area</span></div>
    </section>

    {error && <p className="error-message" role="status">{error} <button onClick={loadData}>Retry</button></p>}

    <section className="watch-layout" aria-label="Regional hotspot map and outlook">
      <div className="map-wrap">
        <div className="map-head"><h2>Fire hotspots near Singapore</h2><button className="map-style" onClick={() => setMapType(mapType === 'satellite' ? 'street' : 'satellite')}>{mapType === 'satellite' ? 'Satellite' : 'Map'}</button></div>
        <div className="map-frame">
          <MapContainer center={[1.25, 105.2]} zoom={5.2} minZoom={3} maxZoom={11} scrollWheelZoom zoomControl>
            <TileLayer
              attribution={mapType === 'satellite' ? 'Tiles &copy; Esri' : '&copy; OpenStreetMap contributors'}
              url={mapType === 'satellite'
                ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
            />
            <MapCenter />
            {snapshots.map((snapshot) => {
              const ageIndex = snapshots.length - 1 - snapshots.indexOf(snapshot);
              const dots = groupPoints(snapshot.hotspots || []);
              return dots.map((dot, pointIndex) => <CircleMarker
                key={`${snapshot.date}-${pointIndex}`}
                center={[dot.lat, dot.lon]}
                radius={Math.min(15, 4 + Math.sqrt(dot.count) * 1.8)}
                pathOptions={{ color: AGE[ageIndex].color, weight: 1.5, fillColor: AGE[ageIndex].color, fillOpacity: AGE[ageIndex].opacity }}
              ><Tooltip>{dot.count} hotspot{dot.count === 1 ? '' : 's'} · {shortDate(snapshot.date)}</Tooltip></CircleMarker>);
            })}
            <CircleMarker center={[SINGAPORE.lat, SINGAPORE.lon]} radius={5} pathOptions={{ color: '#fff8e9', fillColor: '#1c2825', fillOpacity: 1, weight: 2 }}>
              <Tooltip permanent direction="right" offset={[7, 0]}>Singapore</Tooltip>
            </CircleMarker>
          </MapContainer>
          <div className="map-tag"><i/> RECENT SATELLITE PASSES</div>
          <div className="map-legend-overlay"><CircleLegend snapshots={snapshots}/></div>
        </div>
        <p className="map-caption">A circle marks detected fire activity, not confirmed haze. Older detections fade.</p>
      </div>

      <aside className="outlook-panel">
        <div className="outlook-head"><span>THE NEXT FEW DAYS</span><span className="status-dot"/></div>
        <Outlook snapshots={snapshots} wind={wind}/>
        <a className="official-link" href="https://wis2.asmc.asean.org/smoke-haze-dispersion-model/" target="_blank" rel="noreferrer">ASMC official 24-hour haze model <ArrowUpRight size={14}/></a>
      </aside>
    </section>

    <footer className="footnote"><span>Satellite fire detections are possible smoke sources, not proof of haze at ground level.</span><a href="https://wis2.asmc.asean.org/hotspot-reports-jpss-1-noaa-20/" target="_blank" rel="noreferrer">ASMC VIIRS data ↗</a></footer>
  </main>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
