# 职途雷达 Career Radar

面向 2027 届统计学硕士的数据岗位追踪工具，用于整理机器学习算法、时间序列、数据科学、数据挖掘和数据分析方向的实习与秋招机会。

## 已有功能

- 按推荐优先级展示岗位、地点、发布日期、技能要求与匹配原因
- 收藏岗位并标记已投递
- 标记“相关性低或不适用”，记录具体原因与备注
- 每日生成 3 道原创图形推理和 3 道资料计算题，保存当天作答进度与解析
- 按“秋招 / 实习”和数量一键拉取公开候选岗位，并按个人偏好排序
- 导入、导出岗位和个人标记数据
- 使用云端数据库按账号保存状态，支持多设备同步
- 在“已投递”页用气泡和时间线管理投递节点、下一步及截止日期，支持归档和恢复
- 从 `.xlsx`、CSV、JSON 预览并导入投递记录；同公司同岗位可合并时间线或保留另一次投递

一键更新的秋招候选来自牛客公开校招页面，实习候选来自实习僧公开列表及详情页。自动加入的岗位统一标记为“待复核”，投递前仍需在企业官网确认申请状态。每日训练题为同类题型原创内容，不抓取或复制北森商业题库。

## 本地运行

需要 Node.js 22.13 或更高版本。

```bash
npm ci
npm run dev
```

开发服务器默认运行在 `http://127.0.0.1:5173/`。

## 数据与身份

当前云端版本使用 ChatGPT Sites 的登录身份和 D1 数据库。岗位标记、投递记录和节点均按登录用户隔离。表结构由 `drizzle/` 中的追加迁移管理。离线版将投递池保存在当前浏览器的 `radarApplicationsV1`，可通过“导出 JSON 备份”与在线版手动交换；原始导入文件在浏览器内解析，不上传保存。

如需迁移到其他托管平台，需要替换 `app/chatgpt-auth.ts` 提供的身份来源，并为 `DB` 绑定配置兼容的数据库服务。

## 主要目录

- `app/catalog.json`：唯一的内置岗位数据源
- `app/catalog-core.mjs`：岗位目录校验、去重与批次元数据
- `app/board/template.html`：在线版与离线版共用的页面结构
- `app/board/styles.css`：看板样式
- `app/board/client.js`：在线与离线共用的交互逻辑
- `app/board/applications.js`：投递池、时间线编辑和文件导入预览
- `app/board/vendor/`：随单文件离线版内嵌的 Excel/CSV 解析库及许可证
- `app/board/render.mjs`：将目录和运行模式注入页面模板
- `app/api/state/route.ts`：读取和更新个人标记
- `app/api/applications/route.ts`：读取和保存个人投递线与节点
- `app/api/import/route.ts`：导入岗位及历史状态
- `app/api/jobs/refresh/route.ts`：按类型和数量更新公开岗位候选
- `app/job-refresh.mjs`：公开页面解析、去重和匹配排序
- `app/practice.html`：每日行测训练页
- `app/sync-core.mjs`：同步、校验与数据库操作
- `scripts/apply-job-update.mjs`：只向目录追加从未出现的岗位，并生成报告和离线版
- `scripts/make-offline.mjs`：从同一模板和目录生成单文件离线版
- `scripts/check-project.mjs`：检查目录重复项、模板占位符和两种运行模式
- `db/schema.ts`：数据库表结构
- `drizzle/`：数据库迁移文件

## 更新流程

把核验后的新岗位写入 `app/updates/*.json`，然后运行：

```bash
node scripts/apply-job-update.mjs app/updates/本次更新.json
```

脚本只追加目录中从未出现过的岗位 ID 和申请链接，不会覆盖历史岗位。在线版在请求时读取 `app/catalog.json`，离线版也从该目录生成，因此不再需要手工同步多份 HTML。

结构校验和离线版生成命令：

```bash
npm run check:project
npm run offline
```

此仓库为私人项目，岗位数据仅用于个人求职管理。
