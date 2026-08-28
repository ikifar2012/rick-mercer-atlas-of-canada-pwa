# The Unofficial Rick Mercer Atlas of Canada

A fast, installable fan archive of 486 Rick Mercer adventures across Canada. It preserves the original Atlas data locally and rebuilds the experience for modern phones, desktops, assistive technology, and unreliable networks.

> [!IMPORTANT]
> This is an independent, unofficial fan archive. It is not affiliated with, authorized by, or endorsed by Rick Mercer, CBC, or the programme's rights holders.

## Features

- Keyless MapLibre/OpenFreeMap map with all locations and shared-location result sheets
- Search plus season, province/territory, and broadcast-year filters
- Static, shareable pages for all 486 POIs
- Explicit, transient “Near me” support
- Click-to-load privacy-enhanced YouTube embeds
- Installable PWA with an offline catalogue
- Graceful catalogue fallback when external services are unavailable
- Canonical local data with repeatable migration and validation

## Stack

- Astro static output with React islands
- MapLibre GL with the open-source OpenFreeMap basemap
- Bun for dependencies and scripts
- Cloudflare Workers Static Assets

## Local development

Install [Bun](https://bun.sh/), then:

```bash
bun install
cp .env.example .env
bun run dev
```

No map account or API key is required. Search runs locally across the archived titles, descriptions, and location labels.

## Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the development server |
| `bun run check` | Run Astro and TypeScript checks |
| `bun run data:audit` | Validate all POIs and the source checksum |
| `bun run data:migrate` | Re-fetch and normalize the legacy data |
| `bun run build` | Audit, check, and build the production PWA |
| `bun run preview:worker` | Preview the build with Wrangler |
| `bun run deploy` | Deploy to Cloudflare Workers |

Rebuild deterministically from the archived source without contacting the legacy host:

```bash
node scripts/migrate-atlas-data.mjs --input data/source/rmr.atlas.data.js
```

## Data provenance

The immutable legacy source is archived at `data/source/rmr.atlas.data.js`. The application reads normalized `data/pois.json`.

- Records: **486**
- Seasons: **15**
- Source SHA-256: `f20e47647cf60e7dd4c631d7f22c2e219eff4d2f3ff8108a3515580f4bef52d4`

Run `bun run data:audit` after every correction. Do not edit the archived source.

## Cloudflare deployment

1. Authenticate with `bunx wrangler login`.
2. Configure `PUBLIC_SITE_URL` and `PUBLIC_ISSUES_URL` in the build environment.
3. Run `bun run deploy`, or connect the private repository to Workers Builds.

The generated `dist` directory is served as static assets. No runtime API or database is required.

## Privacy and accessibility

There are no analytics, ads, accounts, or saved location history. YouTube connects only after Play is pressed. Location is requested only through “Near me” and is not retained. WCAG 2.2 AA is the target, with the catalogue serving as the semantic alternative to map interaction.

## Corrections, rights, and licensing

Set `PUBLIC_ISSUES_URL` to the separate public issue tracker before launch. Rights and removal requests should receive priority.

Application source licensing does not grant rights to third-party programme metadata, names, descriptions, videos, or imagery. Add the chosen source-code license before public distribution.
