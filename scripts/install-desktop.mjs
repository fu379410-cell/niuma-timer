#!/usr/bin/env node
import { access, lstat, mkdir, mkdtemp, realpath, rename, rm, rmdir, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appName = '牛马计时器.app';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArguments(args) {
  const options = { target: path.join(homedir(), 'Desktop'), replace: false, help: false };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--replace') options.replace = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--target') {
      if (!args[i + 1] || args[i + 1].startsWith('--'))
        throw new Error('--target 后请填写目标目录。');
      options.target = args[++i];
    } else if (arg.startsWith('--target=')) {
      options.target = arg.slice('--target='.length);
      if (!options.target) throw new Error('--target 不能为空。');
    } else throw new Error(`未知参数：${arg}。使用 --help 查看用法。`);
  }
  return options;
}

async function exists(filename) {
  try {
    await lstat(filename);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function validateBundle(bundle) {
  if (!(await stat(bundle)).isDirectory()) throw new Error(`不是应用目录：${bundle}`);
  const plist = path.join(bundle, 'Contents', 'Info.plist');
  if (!(await stat(plist)).isFile()) throw new Error(`应用缺少 Contents/Info.plist：${bundle}`);
  let executable;
  try {
    executable = execFileSync(
      '/usr/libexec/PlistBuddy',
      ['-c', 'Print :CFBundleExecutable', plist],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    ).trim();
  } catch {
    throw new Error(`应用的 Info.plist 缺少有效 CFBundleExecutable：${bundle}`);
  }
  if (
    !executable ||
    executable === '.' ||
    executable === '..' ||
    executable.includes('/') ||
    executable.includes('\\')
  ) {
    throw new Error(`应用可执行文件名称无效：${bundle}`);
  }
  const binary = path.join(bundle, 'Contents', 'MacOS', executable);
  const [bundlePath, binaryPath] = await Promise.all([realpath(bundle), realpath(binary)]);
  if (!binaryPath.startsWith(`${bundlePath}${path.sep}`) || !(await stat(binary)).isFile()) {
    throw new Error(`应用可执行文件必须位于完整 bundle 内：${bundle}`);
  }
  await access(binary, constants.X_OK);
}

function timestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

async function install(options) {
  if (process.platform !== 'darwin') {
    throw new Error(
      '此安装命令仅用于 macOS。Windows 请使用 Release 中的 NSIS 安装包及桌面快捷方式。'
    );
  }
  if (!['arm64', 'x64'].includes(process.arch)) throw new Error(`暂不支持此架构：${process.arch}`);
  const candidates = [path.join(projectRoot, 'release', `mac-${process.arch}`, appName)];
  // electron-builder uses release/mac for its default Intel build directory.
  if (process.arch === 'x64') candidates.push(path.join(projectRoot, 'release', 'mac', appName));
  let source;
  for (const candidate of candidates) {
    if (await exists(candidate)) {
      source = candidate;
      break;
    }
  }
  if (!source) {
    throw new Error(
      `找不到当前架构的应用：${candidates[0]}\n请先执行 npm run desktop:pack，再运行本命令。`
    );
  }
  await validateBundle(source);
  source = await realpath(source);
  await mkdir(path.resolve(options.target), { recursive: true });
  const targetDirectory = await realpath(path.resolve(options.target));
  const destination = path.join(targetDirectory, appName);
  if (
    destination === source ||
    destination.startsWith(`${source}${path.sep}`) ||
    source.startsWith(`${destination}${path.sep}`)
  ) {
    throw new Error('目标应用与源应用路径重叠，请选择其他目标目录。');
  }
  const refuseExisting = async () => {
    if (!options.replace && (await exists(destination))) {
      throw new Error(
        `目标已存在，未覆盖：${destination}\n如需更新，请使用 --replace；旧应用会先备份。`
      );
    }
  };
  await refuseExisting();
  const stagingDirectory = await mkdtemp(path.join(targetDirectory, '.niuma-install-'));
  const stagedApp = path.join(stagingDirectory, appName);
  let backup;
  let reservedTarget = false;
  let installed = false;
  try {
    // Native bundle copy preserves permissions, symbolic links and metadata.
    execFileSync('/usr/bin/ditto', [source, stagedApp], { stdio: ['ignore', 'pipe', 'pipe'] });
    await validateBundle(stagedApp);
    await refuseExisting();
    if (await exists(destination)) {
      backup = path.join(
        targetDirectory,
        `牛马计时器.backup-${timestamp()}-${randomUUID().slice(0, 8)}.app`
      );
      await rename(destination, backup);
    }
    // An exclusive empty reservation avoids replacing a concurrently created target.
    await mkdir(destination);
    reservedTarget = true;
    await rename(stagedApp, destination);
    installed = true;
  } catch (error) {
    if (reservedTarget && !installed) {
      try {
        await rmdir(destination);
      } catch {
        /* Never remove a nonempty target. */
      }
    }
    if (backup) {
      if (!(await exists(destination))) {
        await rename(backup, destination);
        backup = undefined;
      } else {
        console.error(`旧应用备份保留在：${backup}`);
      }
    }
    throw error;
  } finally {
    // Only remove the private temporary directory created by this invocation.
    await rm(stagingDirectory, { recursive: true, force: true });
  }
  console.log(`已安装：${destination}`);
  if (backup) console.log(`旧版备份：${backup}`);
  console.log('复制的是完整应用，可直接双击打开，无需保留项目目录或启动开发服务。');
}

try {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(`用法：npm run desktop:install -- [--target <目标目录>] [--replace]
macOS 默认安装到 ~/Desktop/${appName}。
先执行 npm run desktop:pack 生成本机架构的完整应用。
默认拒绝覆盖；--replace 会先保留带时间戳的旧应用备份。`);
  } else await install(options);
} catch (error) {
  console.error(`安装失败：${error.message}`);
  process.exitCode = 1;
}
