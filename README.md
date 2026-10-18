# Haze Watch · Singapore

A compact map of recent ASMC VIIRS active-fire detections around Singapore, with a simple three-day hotspot trend and surface-wind context.

## Run locally

```sh
npm install
npm run dev
```

## What the map means

- Circles group fire pixels detected by Suomi-NPP and NOAA-20 over recent daily passes. Newer detections are brighter.
- A hotspot is a possible smoke source. It does not confirm that haze reached the ground or Singapore.
- The outlook compares detections within roughly 750 km of Singapore over the latest three daily snapshots, then checks the next three days of Open-Meteo surface-wind direction. It is an indicative signal, not an air-quality forecast.
- ASMC separately publishes an official 24-hour smoke-dispersion model, linked in the outlook.
- The app starts a daily history as snapshots are collected. It needs three daily records before it can describe a trend.

The capture script reads public ASMC WIS 2.0 hotspot ZIP reports and stores the latest seven daily snapshots in `public/hotspot-history.json`. The Pages workflow runs it daily, saves new snapshots to the repository, builds the app, and deploys it.

Sources: [ASMC VIIRS hotspots](https://wis2.asmc.asean.org/hotspot-reports-jpss-1-noaa-20/), [ASMC smoke-dispersion model](https://wis2.asmc.asean.org/smoke-haze-dispersion-model/), [Open-Meteo](https://open-meteo.com/en/docs).

## GitHub Pages

The `main` branch deploys to [https://cyrahahaha.github.io/haze-watch/](https://cyrahahaha.github.io/haze-watch/).
