import { readFile, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
const source = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const icon = new Resvg(source, { fitTo: { mode: 'width', value: 1024 } }).render().asPng();
await writeFile(new URL('../public/app-icon.png', import.meta.url), icon);
console.log('App icon created: public/app-icon.png');
