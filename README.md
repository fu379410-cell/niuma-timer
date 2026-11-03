<div align="center">

# 牛马计时器

**每一秒，都没有白忍。**

给努力生活的打工人，一块看得见收入、等得到下班的磨砂玻璃小面板。

[下载安装](https://github.com/fu379410-cell/niuma-timer/releases) · [提交问题](https://github.com/fu379410-cell/niuma-timer/issues) · [参与开发](docs/CONTRIBUTING.md) · [MIT 开源](LICENSE)

</div>

![牛马计时器桌面界面](docs/screenshot-desktop.png)

奶油白、酸橙绿、磨砂玻璃，再配一只咖啡续命的小牛马。上班可以，上头不行。

## 能做什么

- **看收入慢慢上涨**：今日估算收入、每秒收入、时薪与工时进度，按本机时间实时更新。
- **等一个准点下班**：自动区分上班前、工作中、休息、下班与休息日；支持跨夜班次。
- **算清自己的身价**：自定义月薪、计薪天数、上下班时间、休息时段和每周工作日。
- **翻翻牛马账本**：查看本月排班估算、周收入分布，并导出本月 CSV。
- **安静陪你搬砖**：桌面版支持迷你窗与窗口置顶；金额可一键隐藏，还有一口电子咖啡。

## 下载安装

前往 [GitHub Releases](https://github.com/fu379410-cell/niuma-timer/releases) 选择对应平台：

| 平台 | 文件 |
| --- | --- |
| Windows x64 | `*-setup.exe` 安装版，或 `*-portable.exe` 免安装版 |
| macOS Apple Silicon | `*arm64.dmg` 或 `*arm64.zip` |
| macOS Intel | `*x64.dmg` 或 `*x64.zip` |

社区构建尚未进行代码签名；macOS 构建也未经过 Apple 公证，首次打开可能遇到系统安全提示。Windows 安装包同样未签名。发布产物由 GitHub Actions 构建，不能据此视为所有平台均已完成真人实机验收。

## 本地运行

需要 Node.js **22.12+**，推荐 Node.js 24。

```bash
git clone https://github.com/fu379410-cell/niuma-timer.git
cd niuma-timer
npm ci
npm run dev
```

浏览器打开终端显示的本地地址即可使用网页版。启动桌面版时保留上述服务，在另一个终端运行：

```bash
npm run desktop:dev
```

验证生产构建：

```bash
npm run build
# macOS / Linux
NIUMA_USE_DIST=1 npm run desktop:dev
```

Windows PowerShell 对应命令为：

```powershell
$env:NIUMA_USE_DIST = '1'
npm run desktop:dev
```

常用开发命令：

| 命令 | 用途 |
| --- | --- |
| `npm test` | 验证薪资、工时与日期边界的计算规则 |
| `npm run build` | 构建浏览器界面到 `dist/` |
| `npm run preview` | 预览已构建的浏览器界面 |
| `npm run desktop:pack` | 生成当前平台的未安装桌面应用目录 |
| `npm run desktop:dist` | 生成当前平台安装包，输出到 `release/` |

## 收入怎么算

```text
日薪 = 月薪 ÷ 月计薪天数
有效工时 = 班次时长 − 不计薪休息时长
今日估算收入 = 日薪 × 已完成有效工时 ÷ 有效工时
```

默认的月薪 **8000 元**、计薪天数 **21.75 天**、周一至周五 **09:00–18:00**、休息 **12:00–13:30**，只是方便试用的可修改示例。

计算使用本机时间与时区。跨夜班次归属于**开始上班的日期**。月度账本将过往排班日按满勤估算，当班按实时进度计算；修改配置会重新估算历史金额。这是排班估算工具，不是真实出勤记录，也未计算法定节假日、加班、请假、奖金、税费或社保。

配置仅保存在当前浏览器或桌面应用的 `localStorage`，无需账号，不上传工资。网页版与桌面版使用各自的本地存储；清除应用数据会移除配置。演示模式只用于预览界面效果，页面会明确显示演示状态。

## 设计与实现

原生 JavaScript + Vite 构建界面，Electron 提供桌面窗口。薪资计算是独立的无依赖模块，便于核对和测试。桌面渲染器启用上下文隔离与沙箱，仅通过受限接口使用迷你窗、置顶和窗口状态。

先用内置 imagegen 生成视觉原型，再实现可操作界面。原型与吉祥物的提示词保存在 [design/image-prompts.md](design/image-prompts.md)。

<details>
<summary>查看最初的视觉原型</summary>

![imagegen 视觉原型](design/prototype.png)

</details>

欢迎修 bug、改善可访问性、给小牛马写一句好笑又温柔的话。开始前请读 [贡献指南](docs/CONTRIBUTING.md)。

代码按 [MIT License](LICENSE) 开源。© 2026 fu379410-cell。
