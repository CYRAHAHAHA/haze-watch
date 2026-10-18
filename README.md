# Haze Watch SEA

A public-data regional haze situational-awareness dashboard for Singapore, Malaysia, and Indonesia. It combines the ASEAN Specialised Meteorological Centre (ASMC) daily haze map (NOAA satellite hotspot observations and model-analysis winds) with short-range Open-Meteo wind forecasts and Singapore NEA air-quality readings.

## Run locally

```sh
npm install
npm run dev
```

The browser requests Open-Meteo, NEA, and ASMC directly; no API key is required for the configured feeds. Current data can fail to load in networks that restrict external requests, and the ASMC map item may not expose an image asset.

## Data and interpretation

- **ASMC regional haze map:** official daily graphic; hotspots indicate possible active fires and can be missed under cloud or between satellite passes. Its arrows are model-analysis winds at 2,500 ft. The product updates daily, nominally 08:30–10:30 UTC.
- **Open-Meteo:** forecast wind speed and direction at selected regional locations for the next 24 hours. Wind can suggest transport direction; it is not a smoke-dispersion or air-quality forecast.
- **Singapore NEA / data.gov.sg:** current PSI and PM2.5 observations, for local context only. It does not represent air quality across Malaysia or Indonesia.
- The interface shows the latest source products only. It does **not** claim to provide a 30-day image archive: that requires scheduled collection and storage of ASMC daily maps and metadata.

Sources: [ASMC Regional Haze Situation](https://wis2.asmc.asean.org/regional-haze-situation/), [ASMC WIS 2.0 API item](https://api.wis2.asmc.asean.org/collections/regional_haze/items/REGIONAL_HAZE_MAP), [Open-Meteo Forecast API](https://open-meteo.com/en/docs), [Singapore NEA PSI API](https://api-open.data.gov.sg/v2/real-time/api/psi).

## Repository

This folder is a standalone Git repository (`haze-watch`, branch `main`). Add a GitHub remote and push when ready:

```sh
git remote add origin <your-github-repository-url>
git push -u origin main
```

## Next steps

1. Persist timestamped ASMC images and source metadata once daily to build a genuine 30-day archive.
2. Add satellite aerosol optical depth from NASA GIBS and regional air-quality products where access and reuse terms allow.
3. Add a backend ingestion and forecast layer with transparent validation before describing any output as a haze forecast.

## GitHub Pages

The `main` branch is built and deployed automatically with GitHub Actions. The project is configured for the repository URL path `/haze-watch/`.
