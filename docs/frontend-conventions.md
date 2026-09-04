# 前端分层约定

本文档约定 `src/` 下的文件职责与规模边界。目的不是「让文件变小」，而是让
每个文件只有一个改动理由——改布局不必读业务逻辑，改业务逻辑不必读 JSX。

## 文件规模

| 类型 | 目标 | 硬上限 |
| --- | --- | --- |
| React 组件（`.tsx`） | ≤ 200 行 | 400 行 |
| 自定义 hook | ≤ 200 行 | 300 行 |
| 纯逻辑模块（`.ts`） | ≤ 250 行 | 400 行 |
| 翻译表 / 常量表等纯数据 | 不限 | 不限 |

超过目标值不必立刻拆，但要能说出「这个文件为什么只有一个改动理由」。
超过硬上限必须拆。`src/i18n.ts` 是明确豁免项：它是数据表，行数增长不代表
复杂度增长。

## 四层职责

```
App.tsx                     容器层：本地 UI 状态 + 装配三块区域，不含布局细节
features/app/use*.ts        hook 层：副作用、异步编排、跨组件业务状态
features/app/useReviewState 派生层：由会话状态与筛选条件推导视图数据（纯 useMemo）
features/app/*Panel.tsx     区域层：整块区域的布局与组装（自身不含业务副作用）
features/*/*.tsx            组件层：展示与交互，props in / callback out
features/*/*.ts             纯逻辑层：无副作用纯函数，全部可单测
lib/*.ts                    边界层：Tauri invoke、格式化、通用工具
```

判断一段代码属于哪层，问三个问题：

1. 换掉整套 UI 后还需要吗？→ 需要则属 hook 层或纯逻辑层
2. 它在做算术、过滤、排序、拼接吗？→ 是则属派生层或纯逻辑层
3. 它只是把数据摆到屏幕上吗？→ 是则属区域层或组件层

`features/app/` 放的是「只服务于 App 组装」的东西：跨 feature 的 hook、
共享 UI 类型（`uiTypes.ts`）、以及像 `SidePanel` 这样把多个 feature 面板
拼在一起的容器级组件。单个 feature 内部的组件仍留在自己的目录。

### 容器层：`App.tsx`

容器层的验收标准是**一眼可读**：打开文件应当在一屏内看清「有哪些状态、
调了哪些 hook、页面由哪几块组成」，不需要滚动阅读布局细节。

**只允许**：
- 本地 UI 状态（弹窗开关、筛选/排序选择、主题、语言、缩放）
- 调用 hook 并把结果分发给子组件
- 事件回调的组装（`useCallback` 包装后下发）
- 顶层骨架 JSX：只有 `<main>`、栅格容器与区域组件，不含具体元素

**禁止**：
- 直接调用 `invoke`、`lib/cameraApi` 或 `lib/appApi`
- 承载相机会话、更新检查、日志导出、诊断动作等业务副作用
- 定义会被其它文件引用的展示组件
- 内联具体布局元素（`<header>` / `<figure>` / `<aside>` 的内部结构）
- 内联派生计算（过滤、排序、计数、`findIndex`、条件文案拼接）

后两条是这一版重构的重点。`App.tsx` 曾把工作区的标题栏、照片舞台、详情面板、
胶片条共约 130 行 JSX 直接内联，同时在函数体里散落 `selectedIndex`、
`ratedCount`、`isReviewReady`、`connectionLabel` 等派生计算——文件只有 342 行，
但结构不可一眼看清，因为「装配」和「实现」混在同一层。

拆分后：派生计算收进 `useReviewState`，工作区 JSX 收进 `WorkspacePanel`，
两个弹窗收进 `AppDialogs`，`App.tsx` 的 JSX 只剩三个区域组件。

**可验证的约束**：

```bash
# 不得直接依赖边界层
rg '^import.*from "./lib' src/App.tsx        # 应无输出

# 顶层 JSX 只允许骨架标签，不出现具体布局元素
rg '<(header|figure|aside|nav|h2|h3)\b' src/App.tsx   # 应无输出
```

判定标准：如果一段代码在换掉整套 UI 后仍然需要，它就不属于 `App.tsx`；
如果一段 JSX 描述的是「某块区域长什么样」而非「页面由哪几块组成」，
它也不属于 `App.tsx`。

### hook 层

把「一件完整的事」封成一个 hook：相机会话、应用更新、快捷键绑定。

现有 hook 及其职责：

| Hook | 职责 |
| --- | --- |
| `useCameraSession` | 扫描连接、枚举照片、预览缓存、写评级、导出原图 |
| `useAppUpdates` | 读取应用信息、检查/安装更新、导出诊断日志 |
| `useDiagnosticActions` | 打开图像捕捉、跳转 macOS 隐私设置、重新扫描 |
| `useReviewKeyboard` | 审阅快捷键绑定 |
| `useGlobalErrorLog` | 未捕获错误与 promise rejection 落日志 |
| `usePerformanceMetrics` | 帧率与内存采样 |
| `useReviewState` | 由目录与筛选条件推导审阅视图数据（纯派生，无副作用） |

**返回对象的稳定性约定**：hook 返回对象字面量时，每次渲染都是新引用。
调用方**不得**把整个 hook 返回值放进 `useEffect` / `useCallback` 的依赖数组——
那会让依赖每渲染都失效。正确做法是先解构出需要的成员：

```ts
// ✅ 依赖 useCallback 包过的稳定函数
const { rebuildPreviewQueue } = camera;
useEffect(() => {
  rebuildPreviewQueue(photos, selectedId);
}, [photos, selectedId, rebuildPreviewQueue]);

// ❌ camera 每渲染都是新对象，effect 每渲染都重跑
useEffect(() => {
  camera.rebuildPreviewQueue(photos, selectedId);
}, [camera, photos, selectedId]);
```

对应地，hook 内部导出的每个函数都要用 `useCallback` 包好，`useState` 的
setter 可直接透出（React 保证其身份稳定）。

### 派生层：`useReviewState`

容器层不做算术。凡是「由现有状态算出来的值」——过滤后的列表、选中项序号、
已评级张数、是否可进入审阅态、状态文案——一律收进派生 hook。

**约定**：

- 只用 `useMemo` 与纯函数，不含 `useEffect`、不发请求、不写状态
- 输入是原始状态与筛选条件，输出是一个扁平对象，字段名即语义
- 昂贵计算（排序、诊断构造、导出选区）必须 `useMemo`；`findIndex`、
  `filter().length` 这类 O(n) 直算可以不包，但要与派生 hook 放在一起，
  不要散落回容器层
- 导出 `ReviewState` 接口，让消费方能按字段引用而不是解构一堆散变量

这样做的收益是：判断「为什么这张照片没显示」时只需读一个文件，
而不是在容器层的 JSX 与函数体之间来回跳。

### 区域层：`*Panel.tsx`

页面的每一块可独立描述的区域各占一个文件，与 `SidePanel` 并列：

| 组件 | 覆盖区域 |
| --- | --- |
| `SidePanel` | 左栏：设备状态、连接检查、筛选排序、导出、复盘、性能 |
| `WorkspacePanel` | 右侧工作区：标题栏、照片舞台、详情面板、胶片条 |
| `AppDialogs` | 覆盖层：设置面板与连接检查弹窗 |

**约定**：

- 只接收 props、只回调，不发起异步请求、不持有业务副作用
- 可以持有「只服务于本区域展示」的局部推导（如把 `isReviewReady` 与
  `selectedPhoto` 合成一个 `reviewPhoto`，避免同一判空在本文件重复四次）
- 弹窗开关状态留在容器层，区域组件只接收布尔值与关闭回调
- 超过 200 行就按内部区块继续拆到 `features/*/` 下的组件层

### 组件层

- props in、callback out，不自己发起异步请求
- `locale` 通过 props 传入并给 `defaultLocale` 默认值，便于单独渲染测试
- 单个组件文件可以包含只在本文件使用的私有子组件（如 `SettingsPanel` 内的
  `LanguageSection`），但一旦被第二个文件引用就要独立成文件

### Props 数量上限

**单个组件的 props 不超过 15 个。** 超过说明这个组件承担了过多职责，
或在替下游组件做纯粹的透传。

超限时按顺序考虑三条出路：

1. **拆成多个组件** —— 该组件其实包含两块independent的区域
2. **按「同一件事」分组** —— 字段与其回调收成一个对象一起传
3. **下沉到组件内部** —— 该值只有这个组件用，且能自己算出来或自己持有

其中第 2 条最常用于容器级组件。判断能否成组的标准是**内聚性**：这些字段是否
总是一起变化、一起被读取。导出目的地、导出模式、导出选区、导出状态和三个导出
回调总是同进同出，就该是一个 `ExportControls`；而 `locale` 与 `status` 各自独立，
硬凑成 `misc` 只会让参数更难读。

已定义的分组类型放在 `features/app/uiTypes.ts`：

| 分组 | 含义 |
| --- | --- |
| `ExportControls` | 导出目的地、模式、选区、状态与三个回调 |
| `CatalogControls` | 筛选、排序及其回调 |
| `LibraryStats` | 照片总数、已评级数、可见数 |
| `WorkspaceSelection` | 可见列表、选中照片及其序号 |

**反例**：`SidePanel` 曾有 26 个 props，其中 10 个仅仅是为了透传给
`ExportPanel`。分组后降到 15 个，且新增导出相关字段时不再需要修改
`SidePanel` 的签名——只改 `ExportControls` 类型即可。

**注意**：分组是为了内聚，不是为了压数字。把无关字段塞进一个 `props` 大对象
只会把问题从「参数太多」变成「参数不可读」，同时丢掉 TypeScript 的逐字段检查。

**测量命令**：

```bash
for f in $(fd -e tsx . src --exclude '*.test.tsx'); do
  python3 - "$f" <<'EOF'
import re, sys, pathlib
p = pathlib.Path(sys.argv[1])
for m in re.finditer(r'export function (\w+)\(\{(.*?)\n\}: \{',
                     p.read_text(encoding="utf-8"), re.S):
    props = [l.strip() for l in m.group(2).split('\n')
             if l.strip() and not l.strip().startswith('//')]
    if len(props) > 15:
        print(f"{len(props)}  {m.group(1)}  {p}")
EOF
done
```

### 纯逻辑层

- 无副作用、不 import React
- 不可变更新：`{ ...obj, key }`，不做原地 mutation
- 必须有同目录 `*.test.ts`

### 边界层：`lib/`

- `cameraApi.ts` / `appApi.ts`：Tauri command 封装，含浏览器 mock 回退
- `format.ts`：跨 feature 复用的格式化（`imageSource`、`formatBytes`）
- `singleFlight.ts`：并发去重

只服务单个 feature 的格式化放在该 feature 目录内（如
`features/photos/labels.ts`），不要堆进 `lib/`。

## 测试放置

测试与被测模块**同目录同名**：`ExportPanel.tsx` → `ExportPanel.test.tsx`。

组件测试用 `renderToStaticMarkup` 断言渲染结果，不引入浏览器环境。这要求
组件不依赖 `useEffect` 里的副作用就能渲染出可断言的内容。

不要建立跨模块的聚合测试文件（如把 7 个组件的测试塞进一个
`App.connection-ui.test.tsx`）——组件搬家时它会成为唯一需要改的地方。

## 禁止转发层

拆分文件时不要为了兼容旧 import 路径而保留 re-export：

```ts
// ❌ App.tsx 里没有真实消费者的转发
export { ExportPanel } from "./features/photos/ExportPanel";
```

直接改调用方的 import。转发层会让「谁在用这个组件」变得不可追踪。

## 反面案例

`App.tsx` 曾达到 1748 行，含 23 个 `useState` 与 8 个 `useEffect`，同时承载：

- 相机扫描与照片枚举
- 预览批量缓存队列
- 评级乐观更新与回滚
- 导出编排
- 更新检查与安装
- 日志导出
- 12 个展示组件的实现
- 全部布局 JSX

后果是任何一处改动都要在近 1800 行里定位上下文，且 7 个组件因为测试需要
被迫从 `App.tsx` 导出——容器层反过来成了组件的事实归属地。

第一轮拆分后 `App.tsx` 降到 342 行，业务副作用进入 5 个 hook，展示组件按
feature 归位。但**行数达标不等于结构清晰**：此时容器层仍内联了工作区约 130 行
布局 JSX 和 8 处派生计算，打开文件依然看不清页面由哪几块组成。

第二轮按「装配 / 实现分离」继续拆：

| 去向 | 内容 |
| --- | --- |
| `useReviewState` | 8 处派生计算 |
| `WorkspacePanel` | 工作区四块布局 JSX |
| `AppDialogs` | 两个弹窗 |

结果 `App.tsx` 193 行，JSX 部分只剩三个区域组件。

**教训**：文件规模是结果指标，不是目标。真正的判据是「装配」与「实现」有没有
混在同一层——混在一起时，即便只有 300 行也读不出结构。

## 完成前自检

改动涉及 `App.tsx` 或新增区域组件时，逐项确认：

- [ ] `App.tsx` 的 JSX 只有骨架标签与区域组件，无具体布局元素
- [ ] 没有在容器层做过滤、排序、计数、条件文案拼接
- [ ] 新增的派生值放进了 `useReviewState` 而非容器层函数体
- [ ] hook 返回值先解构再进依赖数组，没有整个对象进 deps
- [ ] 单个组件文件 ≤ 200 行（硬上限 400）
- [ ] 单个组件 props ≤ 15 个，超限时已按内聚性分组或拆分
- [ ] 没有为兼容旧路径保留 re-export 转发层
- [ ] scoped 校验通过：`bunx tsc --noEmit`（需 `ALLOW_HEAVY=1`）、
      `bunx eslint <改动文件>`、`bunx vitest run src/features`
