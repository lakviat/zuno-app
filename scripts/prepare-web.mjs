import { copyFile, mkdir } from 'node:fs/promises';
// Metro cannot resolve MapLibre 6's import.meta worker URL. Serve matching modules locally.
await mkdir('public/maplibre', { recursive: true });
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  await copyFile(`node_modules/maplibre-gl/dist/${file}`, `public/maplibre/${file}`);
}
