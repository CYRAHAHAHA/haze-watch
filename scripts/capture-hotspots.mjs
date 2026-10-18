import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';

const FEEDS = [
  ['Suomi-NPP', 'https://api.wis2.asmc.asean.org/collections/npp_afedr_750m_nrt/items/NPP_AFEDR_750M_NRT'],
  ['NOAA-20', 'https://api.wis2.asmc.asean.org/collections/jp1_afedr_750m_nrt/items/JP1_AFEDR_750M_NRT'],
];
const HISTORY_PATH = new URL('../public/hotspot-history.json', import.meta.url);
const REGION = { west: 90, south: -12, east: 130, north: 15 };

async function fetchFeed([sensor, url]) {
  const response = await fetch(url, {
    headers: { accept: 'application/zip, application/octet-stream' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${sensor} hotspot feed returned ${response.status}`);
  const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
  const [path, body] = Object.entries(archive).find(([name]) => name.endsWith('.txt')) ?? [];
  if (!body) throw new Error(`${sensor} hotspot archive did not contain a text report`);

  const report = new TextDecoder().decode(body);
  const fileTime = path.match(/(\d{14})\.txt$/)?.[1];
  const observedAt = fileTime
    ? `${fileTime.slice(0, 4)}-${fileTime.slice(4, 6)}-${fileTime.slice(6, 8)}T${fileTime.slice(8, 10)}:${fileTime.slice(10, 12)}:${fileTime.slice(12, 14)}Z`
    : new Date().toISOString();
  const hotspots = report
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('#') && line.includes(','))
    .map((line) => line.split(',').map((value) => Number(value.trim())))
    .filter((row) => row.length >= 7 && row.slice(0, 7).every(Number.isFinite))
    .filter(([lat, lon]) => lat >= REGION.south && lat <= REGION.north && lon >= REGION.west && lon <= REGION.east)
    .map(([lat, lon, , , , confidence, frp]) => ({
      lat: Number(lat.toFixed(3)),
      lon: Number(lon.toFixed(3)),
      confidence,
      frp: Number(frp.toFixed(1)),
      sensor,
    }));

  return { sensor, observedAt, hotspots };
}

const feeds = await Promise.allSettled(FEEDS.map(fetchFeed));
const available = feeds.filter((result) => result.status === 'fulfilled').map((result) => result.value);
if (available.length === 0) {
  console.warn(`No ASMC hotspot snapshot was saved: ${feeds.map((result) => result.reason?.message).filter(Boolean).join('; ')}`);
  process.exit(0);
}

const collectedAt = new Date().toISOString();
const date = collectedAt.slice(0, 10);
const combined = new Map();
for (const feed of available) {
  for (const point of feed.hotspots) {
    const key = `${point.lat},${point.lon}`;
    const existing = combined.get(key);
    if (!existing || point.confidence > existing.confidence) combined.set(key, point);
  }
}

let history = { updatedAt: collectedAt, snapshots: [] };
try {
  history = JSON.parse(await readFile(HISTORY_PATH, 'utf8'));
} catch {
  // The initial scheduled capture creates the history file.
}

const snapshot = {
  date,
  capturedAt: collectedAt,
  observedAt: available.map((feed) => feed.observedAt).sort().at(-1),
  sensors: available.map((feed) => feed.sensor),
  hotspots: [...combined.values()],
};
const snapshots = history.snapshots.filter((entry) => entry.date !== date);
snapshots.push(snapshot);
snapshots.sort((a, b) => a.date.localeCompare(b.date));
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await writeFile(HISTORY_PATH, `${JSON.stringify({ updatedAt: collectedAt, snapshots: snapshots.slice(-7) }, null, 2)}\n`);
console.log(`Captured ${snapshot.hotspots.length} hotspots for ${date} from ${available.map((feed) => feed.sensor).join(' + ')}`);
