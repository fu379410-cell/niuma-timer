import { readFile, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
// The generated character fills the complete square; no inset logo plate.
const artwork = await readFile(new URL('../design/app-icon-v2.png', import.meta.url));
const source = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1024" height="1024" viewBox="0 0 1024 1024"><image width="1024" height="1024" xlink:href="data:image/png;base64,${artwork.toString('base64')}"/></svg>`;
const icon = new Resvg(source).render().asPng();
await writeFile(new URL('../public/app-icon.png', import.meta.url), icon);
console.log('Full-bleed character icon created: public/app-icon.png');
