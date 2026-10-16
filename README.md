# 蓝河围棋

vivo 蓝河操作系统（BlueOS）手表上的围棋人机对弈应用。

纯本地单机应用，不联网，无账号、无广告、无内购。

## 功能

| 功能 | 说明 |
|---|---|
| 棋盘规格 | 7 路极简 / 9 路标准 / 13 路进阶 |
| 人机对弈 | 三档难度：入门 / 业余 / 高手 |
| 执子选择 | 执黑（先手）/ 执白（后手） |
| 落子模式 | 预选确认（防误触，两步走子）/ 单触即落 |
| 悔棋 | 回退至任意可悔手数 |
| 停一手 | Pass（中国规则「双方连续停一手终局」） |
| 数子 | 中国规则数子，自动判胜负与分差 |
| 战绩 | 总局数、胜、负、胜率，本地持久化 |
| 规则简述 | 应用内可查阅四条核心规则 |

## 适配机型

以 **vivo WATCH GT 2 / iQOO WATCH GT 2** 为基线机型。

| 项 | 值 |
|---|---|
| 屏幕 | 方屏 432 × 514，60Hz |
| `deviceTypeList` | `["watch", "watch-square"]` |
| `config.designWidth` | `432` |
| 应用包名 | `com.jen.jweiqi` |

布局按「设计稿宽 432 + 弹性高度」组织：根容器 `column`、中部棋盘区 `flex: 1`、底部操作栏固定高度。棋盘边长**不写死**，由纵向可用高度反推（见下文「实现说明」）。

## 技术栈

- **蓝河 `.ux` 单文件**：`template` / `script` / `style` 三段式，改 `data` 视图自动更新
- **MVVM 数据绑定**，`data` 为页面数据模型
- **JS API**：
  - `@blueos.storage.storage` — KV 持久化（设置项、战绩）
  - `@blueos.window.prompt` — `showToast` 轻提示
  - `@blueos.app.appmanager.router` — 页面路由
- **无网络**：GT2 官方参数页无 Wi-Fi，本应用也不含任何请求

## 目录结构

```
src/
├── app.ux                 # 应用入口，含 /**manifest**/ 关联标记（不可删除）
├── manifest.json          # 应用配置：路由 / features / appCategory / deviceTypeList
├── assets/
│   └── images/logo.png    # 应用图标，114×114
├── common/
│   ├── engine.js          # 规则引擎：落子、提子、打劫、禁着点、数子、星位
│   ├── ai.js              # AI 选点，三档启发式
│   └── storage.js         # KV 存储封装，模块不可用时降级到内存
└── pages/
    ├── Weiqi/index.ux     # 主对局页（router.entry）
    └── Demo/index.ux      # 路由跳转示例，当前未被 entry 使用
```

规则与 AI 逻辑全部放在 `common/`，页面只负责交互与渲染。

## 开发

```bash
# 安装依赖（官方推荐 pnpm）
pnpm i
```

然后用 **BlueOS Studio** 打开项目根目录：

1. 点「安装依赖」
2. 点「重新启动编译」
3. 保存代码即实时预览

> **别在 Studio 开着 watch 的时候手动跑 `pnpm install`。**
> pnpm 是增量建立 junction 的，中间态会让 Studio 编译到半成品依赖，
> 报 `Cannot find module` 之类的假故障。要装依赖就走 Studio 的「安装依赖」按钮。

### 打包

Studio 顶部「打包」→ 选 `debug` / `release` 与环境变量 → 产物 rpk 输出到 `dist/`。

`release` 包需先准备 `sign/certificate.pem` 与 `sign/private.pem`。

### 真机调试

**模拟器和云真机只能预览，DevTools 调试必须 USB 真机。**

链路：Android 手机装 vivo 健康 App → 蓝河手表 + USB 数据线 → 手机开 USB 调试 → Studio 右上角「USB 调试」。

表冠、传感器、蓝牙、AOD、功耗**只能**在实体设备上验证，模拟器结果不作数。

## 实现说明

几处不明显的取舍，改动前请先读：

### 1. `build.config.js` 不覆盖 `css.postcss`

工程级 `postcss.config.js` 会让 blueos-pack 改为从工程 `node_modules` 解析 `tailwindcss`，
该解析在 Studio 扩展宿主进程中会失败，导致编译中断（错误码 `4013`），
进而使产出的 rpk 缺少可用 manifest，设备侧报 `AppThread load manifest failed`。

因此 `build.config.js` 留空，回退到 Studio 内置管线。内置配置的 tailwind
`content` glob 与本工程 `src` 一致，且额外包含 `dpTextRescue()` 插件（工程级原配置缺失）。

本工程未使用任何 Tailwind 工具类，切换无影响。

### 2. 棋盘尺寸由可用高度反推

GT2 纵向预算：

```
514 - padding(6+10) - header(48) - status(~34) - action-bar(54) = 362
```

`board-container` 另有 `border: 2px × 2`，故棋盘内容区上限取 `MAX_BOARD = 344`。
`step` 强制取偶数，保证 `step / 2` 为整数，网格线交叉点与格子中心精确重合、左右留白对称。

| 规格 | step | 棋盘 | 含边框 | 余量 |
|---|---|---|---|---|
| 7×7 | 48 | 336 | 340 | 22px |
| 9×9 | 38 | 342 | 346 | 16px |
| 13×13 | 26 | 338 | 342 | 20px |

### 3. 网格线与星位点使用独立图层

二者都不放进 `for="{{cells}}"` 的 81 项长列表里靠 `show` 控制显示。

长列表每走一步都会整体重建，节点回收会让 `show` 状态串位——表现为线段接缝、
棋子或星位漂移到其他格子。改为独立图层、坐标直接算到棋盘坐标系：

- 网格线：横 N 条 + 竖 N 条，每条整条绘制。节点数从 `4N²` 降到 `2N`
- 星位点：仅在该交叉点为空时入列，坐标 = `r * step + starDotOffset`

### 4. 存储失败降级

`common/storage.js` 对 `@blueos.storage.storage` 做 `try/catch` 包裹，
模块不可用时自动降级到内存存储，不阻断对局。上架前需在真机确认持久化生效。

## 待办

- [ ] 真机全量验证：深色模式、大字体、权限拒绝、表冠翻页、握拳误触
- [ ] AOD 24 小时耗电实测
- [ ] 确认棋子（`.stone`）与高亮圈（`.cursor-ring`）是否存在同类节点漂移，
      若是则一并改为独立图层
- [ ] 上架材料：隐私政策、截图、权限用途说明（本应用暂未申请敏感权限）
- [ ] 清理：`postcss.config.js` / `tailwind.config.js` 已无引用，可删

## License

[Apache License 2.0](LICENSE)