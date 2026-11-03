import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

if (process.platform !== 'darwin') {
  console.error('macOS icon generation requires the macOS sips and iconutil tools.');
  process.exit(1);
}
const png = fileURLToPath(new URL('../public/app-icon.png', import.meta.url));
const output = fileURLToPath(new URL('../build/icon.icns', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'niuma-icon-'));
try {
  const iconset = join(temporary, 'niuma.iconset');
  await mkdir(iconset);
  await mkdir(fileURLToPath(new URL('../build/', import.meta.url)), { recursive: true });
  for (const size of [16, 32, 128, 256, 512]) {
    for (const scale of [1, 2]) {
      const name = `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`;
      execFileSync(
        '/usr/bin/sips',
        ['-z', String(size * scale), String(size * scale), png, '--out', join(iconset, name)],
        { stdio: 'ignore' }
      );
    }
  }
  execFileSync('/usr/bin/iconutil', ['--convert', 'icns', '--output', output, iconset]);
  console.log('macOS icon created: build/icon.icns');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
