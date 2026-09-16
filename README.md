# 智能简历构建器

一款纯前端智能简历构建器，支持本地多版本简历管理、模块化编辑、模板切换、A4 预览和 PDF 导出。

## 功能列表

- 简历列表：创建、复制、删除多份简历版本。
- 岗位匹配中心：维护目标岗位要求，逐条绑定简历中的工作、项目、技能或教育证据，显示要求/岗位覆盖完成度并管理投递前检查。绑定按稳定 id 追踪（改名自动跟随、删除显式失联、同名条目不静默改绑）；复制简历时绑定随副本独立；JSON 备份恢复保持一致并兼容缺少匹配数据的旧备份。
- 简历编辑器：左侧模块拖拽排序，中间结构化编辑，右侧实时预览。
- 模板选择：内置 6 套简历模板，可应用到当前简历并作为新建默认模板。
- PDF 导出预览：A4 比例预览，支持页边距、字号调整和 PDF 导出。
- 个人资料：维护姓名、联系方式、头像、求职意向等全局资料。
- 本地持久化：简历、个人资料、主题偏好和模板偏好存储在 localStorage。
- JSON 导入导出：支持完整工作区备份和恢复。
- 主题切换：亮色/暗色主题，所有组件通过 CSS 变量消费主题色。

## 快速启动

```bash
cd frontend
npm install
npm run dev
```

开发服务器端口固定为 `28310`：

```text
http://localhost:28310
```

构建与预览：

```bash
npm run build
npm run preview
```

测试（统一入口）：

```bash
npm test          # Vitest + jsdom：真实 localStorage，模块重载模拟刷新/重开
npm run test:watch
npm run e2e       # Playwright + 真实 Chromium：关闭页面重开、整浏览器重启、真实文件导入导出
```

- 单元/集成测试 `src/test/job-matching.test.ts`（13 类场景）：真实 localStorage 持久化，通过清空数据 + 重新加载 store 模块自行隔离，覆盖首次写入/刷新/重开、完整 JSON 备份往返、旧备份（缺少岗位数据）恢复且不丢简历、证据改名追踪、条目/来源简历移除失联、同名新条目不自动接管、复制简历后绑定独立、重复绑定去重、条目换序、投递前检查与覆盖率。
- 端到端测试 `e2e/job-matching-persistence.spec.ts`：从真实页面入口写入岗位/要求/绑定/检查项，验证页面刷新、关闭页面重开、整浏览器重启（独立 BrowserContext + storageState）后覆盖率、失联状态与输入仍可回读；备份经真实「导出 JSON / 导入」文件往返；旧备份缺岗位数据时岗位为空、简历保留。首次运行执行 `npx playwright install chromium` 安装浏览器；`npm run e2e` 会通过 `scripts/ensure-browser.mjs` 自检启动条件——浏览器缺失自动安装，系统库缺失在 Debian/Ubuntu 无 root 时自动用 `apt-get download` 补齐到用户缓存，无法补齐时打印可直接执行的命令。

## 技术栈

| 分类 | 技术 |
| --- | --- |
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite |
| 样式 | Tailwind CSS + SCSS CSS Variables |
| 无障碍交互 | Headless UI |
| 状态管理 | Zustand |
| 拖拽排序 | react-beautiful-dnd |
| PDF 导出 | html2canvas + jsPDF |
| 日期工具 | dayjs |
| 数据持久化 | localStorage |

## 目录结构

```text
frontend/
├── public/
├── src/
│   ├── api/
│   ├── stores/
│   ├── types/
│   ├── components/
│   │   ├── common/
│   │   ├── editor/
│   │   ├── job/
│   │   └── preview/
│   ├── hooks/
│   ├── pages/
│   ├── router/
│   ├── styles/
│   └── utils/
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 功能截图占位

### 简历列表

> 待补充截图：多版本简历卡片、JSON 导入导出、新建入口。

### 简历编辑器

> 待补充截图：模块拖拽排序、结构化编辑、实时预览三栏布局。

### 模板选择

> 待补充截图：6 套模板缩略图和右侧实时预览。

### PDF 导出预览

> 待补充截图：A4 比例预览和导出设置面板。

## License

MIT

