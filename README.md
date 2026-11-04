<div align="center">

<img src="design/app-icon-v2.png" width="112" height="112" alt="满版疲惫牛马脸应用图标" />

# 牛马计时器 · 2.0

**钱在变多，班在变少。**

一块午夜蓝玻璃，一只灵魂离线的牛马，把每一秒忍耐换成喜欢的生活。

[下载安装](https://github.com/fu379410-cell/niuma-timer/releases) · [提交问题](https://github.com/fu379410-cell/niuma-timer/issues) · [参与开发](docs/CONTRIBUTING.md) · [MIT 开源](LICENSE)

</div>

![牛马计时器 2.0：整屏玻璃、实时收入与快乐目标](docs/screenshot-desktop-v2.png)

午夜蓝与紫色的通透玻璃、青柠黄的微光，再配一张快要下班的疲惫牛马脸。macOS 桌面版启用系统原生磨砂材质；支持的 Windows 11 使用 Acrylic，其他环境保留玻璃层视觉。

## 今天也要为自己赚一点快乐

- **收入看得见**：今日已赚、每秒收入、时薪身价、工时进度与下班倒计时，每秒刷新。支持午休、休息日与跨夜班次。
- **趋势是真的**：同一计薪引擎生成「实时 60 秒」和「今日累计」曲线，休息不计薪、下班后封顶；鼠标悬停或键盘查看采样点。
- **快乐有盼头**：36 个内置目标、5 个分类，涵盖吃喝、生活、兴趣、旅行与犒劳自己。轮播可暂停，也能手动切换。
- **目标自己定**：自定义名称、金额、单位与 Emoji，随时编辑、删除；内置目标也可按自己的价格另存。选择与自定义内容保存在本机。
- **搬砖有分寸**：自定义工资、计薪天数与排班，查看月度估算账本并导出 CSV。保留迷你悬浮窗、窗口置顶和一键隐藏金额。

![快乐兑兑所：选择目标、查看进度与自定义快乐](docs/screenshot-goals-v2.png)

<details>
<summary>查看迷你悬浮窗</summary>

<img src="docs/screenshot-mini-v2.png" width="360" alt="牛马计时器 2.0 迷你窗" />

</details>

## 下载安装

前往 [GitHub Releases](https://github.com/fu379410-cell/niuma-timer/releases) 选择对应平台：

| 平台 | 文件 |
| --- | --- |
| Windows x64 | `*-setup.exe` 安装版，或 `*-portable.exe` 免安装版 |
| macOS Apple Silicon | `*arm64.dmg` 或 `*arm64.zip` |
| macOS Intel | `*x64.dmg` 或 `*x64.zip` |

macOS 下载后将完整的 `牛马计时器.app` 拖到桌面即可双击打开；Windows 的 NSIS 安装版会创建桌面快捷方式。

社区安装包未签名，macOS 构建也未经过 Apple 公证，首次打开可能遇到系统安全提示。各平台的实际验证范围见 [验证记录](docs/VERIFICATION-v2.md)。

## 从源码运行

需要 Node.js **22.12+**，推荐 Node.js 24。

```bash
git clone https://github.com/fu379410-cell/niuma-timer.git
cd niuma-timer
npm ci
npm run dev
```

浏览器打开终端显示的本地地址即可体验网页版。桌面开发保留上述服务，在另一个终端运行：

```bash
npm run desktop:dev
```

验证生产界面：

```bash
npm run build
# macOS / Linux
NIUMA_USE_DIST=1 npm run desktop:dev
```

Windows PowerShell 对应为 `$env:NIUMA_USE_DIST = '1'`，再执行 `npm run desktop:dev`。

macOS 构建后安装到自己的桌面：

```bash
npm run desktop:pack
npm run desktop:install
```

安装的是完整应用，无需开发服务，也不依赖原项目目录。安装脚本仅复制已构建的应用，不会自动下载或重新构建。目标已存在时默认拒绝覆盖；更新时使用：

```bash
npm run desktop:install -- --replace
```

旧应用会先保留为带时间戳的 `牛马计时器.backup-*.app`。可追加 `--target "/自定义/目标目录"` 更改安装位置。

| 命令 | 用途 |
| --- | --- |
| `npm test` | 验证薪资、工时、收入趋势与目标状态 |
| `npm run build` / `npm run preview` | 构建 / 预览浏览器界面 |
| `npm run desktop:pack` | 生成当前平台的完整桌面应用目录 |
| `npm run desktop:install` | macOS 将已构建应用复制到桌面 |
| `npm run desktop:dist` | 生成当前平台安装包到 `release/` |
| `npm run icons` | 从 `design/app-icon-v2.png` 生成应用 PNG 图标 |
| `npm run icons:mac` | 在 macOS 生成 `build/icon.icns` |

## 每一分，都有个说法

```text
日薪 = 月薪 ÷ 月计薪天数
有效工时 = 班次时长 − 不计薪休息时长
今日估算收入 = 日薪 × 已完成有效工时 ÷ 有效工时
```

默认月薪 **8000 元**、计薪 **21.75 天**、周一至周五 **09:00–18:00**、休息 **12:00–13:30**，都是可修改的试用示例。目标库中的价格同样只是示例，由你按实际需要调整。

计算使用本机时间与时区，跨夜班次归属于**开始上班的日期**。月度账本将过往排班日按满勤估算，当班按实时进度计算；修改配置会重新估算历史金额。这是排班估算工具，不记录真实出勤，也未计算法定节假日、加班、请假、奖金、税费或社保。

工资配置、选中的目标和自定义目标分别保存在本机 `localStorage`，无需账号，不上传工资。网页版与桌面版使用各自的本地存储；清除应用数据会移除保存的内容。演示模式使用示例时间，界面会明确标记演示状态。

## 设计与实现

原生 JavaScript + Vite 构建界面，Electron 提供桌面窗口；薪资、趋势与目标状态采用独立模块。桌面渲染器启用上下文隔离与沙箱，通过受限接口使用迷你窗、置顶与窗口状态。

视觉原型、角色和图标使用内置 imagegen 生成。2.0 的[设计提示词](design/image-prompts-v2.md)、[角色原图](public/mascot-v2.png)和[满版图标原图](design/app-icon-v2.png)随项目保存；初版概念见 [design/prototype.png](design/prototype.png)。

欢迎修 bug、改善可访问性，或给牛马写一句好笑又温柔的话。开始前请读 [贡献指南](docs/CONTRIBUTING.md)。

代码按 [MIT License](LICENSE) 开源。© 2026 fu379410-cell。
