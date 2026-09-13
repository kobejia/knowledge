---
title: 前端主题系统全面练习：状态、Token、首屏与渲染边界
domain: frontend
depth: deep-dive
created: 2026-09-08
updated: 2026-09-08
---

# 前端主题系统全面练习：状态、Token、首屏与渲染边界

本练习与[《前端主题系统：从换肤、深浅模式到 Design Token 架构》](./theme-systems.md)及 [`theme-systems-demo/`](./theme-systems-demo/) 使用同一套术语和状态模型。目标不是做一套更漂亮的配色，而是能够沿以下链路定位问题：

```text
输入偏好
  → requested mode
  → resolved scheme
  → 根节点主题载体
  → CSS Token 与层叠
  → 原生控件、SVG、Canvas 等渲染边界
```

每组练习都要求完成“运行 → 观察 → 推理 → 修改 → 验证”。先记录预测，再执行操作；只阅读参考答案不构成完成。

## 准备环境

从仓库根目录先运行：

```bash
node learn/frontend/theming/theme-systems-demo/verify.mjs
node learn/frontend/theming/theme-systems-demo/browser-verify.mjs
```

然后启动页面：

```bash
node learn/frontend/theming/theme-systems-demo/serve.mjs
```

访问 `http://127.0.0.1:4173`，打开浏览器开发者工具。若 4173 端口被占用，可使用任务专用环境变量：

```bash
THEME_DEMO_PORT=4174 node learn/frontend/theming/theme-systems-demo/serve.mjs
```

修改前记录 `git diff -- learn/frontend/theming/`；每组练习结束后保留有价值的修改或手动还原本组变更，不要使用会覆盖仓库其他工作的重置命令。

## 练习一：证明 `system` 不是第三套配色

### 运行

1. 清除持久化设置，刷新页面。
2. 依次选择 `system`、`light`、`dark`。
3. 在开发者工具中观察 `<html>` 上的 `data-theme`、`data-scheme` 和内联 `color-scheme`。
4. 记录状态面板中的 requested、system 和 resolved。

### 观察

填写实际结果：

| requested mode | system preference | 预测的 resolved scheme | 实际 resolved scheme |
| --- | --- | --- | --- |
| system | light |  |  |
| system | dark |  |  |
| light | dark |  |  |
| dark | light |  |  |

### 推理

回答：

1. 为什么 `data-theme="system"` 不能直接被当作一套 CSS 色值？
2. 为什么应用 Store 应保存 requested mode，而图表通常需要消费 resolved scheme？
3. 如果只保留一个 `isDark` 布尔值，会丢失什么信息？

### 修改

在 [`app.js`](./theme-systems-demo/app.js) 中把 `resolveScheme()` 暂时改成无论输入为何都返回系统偏好。再次选择显式 light/dark。

### 验证

- 说明修改破坏了哪一条优先级规则。
- 恢复 `resolveScheme()`。
- 重新运行 `verify.mjs` 与 `browser-verify.mjs`，确认显式选择重新生效。

<details>
<summary>参考答案与评价标准</summary>

`system` 表达的是“持续跟随系统”的请求策略，最终仍必须解析成 light 或 dark。Store 保存 requested mode 才能区分“用户明确选择 dark”和“系统当前恰好是 dark”；Canvas 等命令式消费者需要的是当前应绘制的 resolved scheme。

只保存 `isDark` 会丢失用户是否选择 system。系统从 dark 变成 light 时，应用无法判断应该跟随还是保持显式 dark。把 `resolveScheme()` 强制绑定系统偏好则直接取消了用户覆盖，违反“显式用户选择优先于系统偏好”。

完成标准：四种组合预测正确；能说清 requested 与 resolved 的消费者不同；恢复后两条验证命令通过。

</details>

## 练习二：验证系统变化只在正确状态下生效

### 运行

1. 在开发者工具的 Rendering 面板中找到 CSS media feature 模拟，依次模拟浅色和深色；也可以使用操作系统外观设置。
2. requested mode 为 `system` 时切换系统偏好。
3. requested mode 为 `light` 时再次切换系统偏好。

### 观察

记录：

- `system` 状态下 resolved scheme 是否立即更新；
- `light` 状态下 system preference 是否更新；
- `light` 状态下 resolved scheme 是否保持；
- `last source` 分别显示什么。

### 推理

阅读 [`app.js`](./theme-systems-demo/app.js) 中 `handleSystemSchemeChange()`，解释为什么显式模式下仍然更新 system preference 的显示，却不调用完整主题解析。

### 修改

删除 `state.mode === "system"` 条件，让每次系统变化都调用 `applyTheme()`，并在修改前预测显式 light 会发生什么。

### 验证

实际切换系统偏好，比较预测与结果。然后恢复条件并运行浏览器验证。浏览器验证脚本会通过 Chrome DevTools Protocol 模拟媒体变化，分别检查 system 和显式模式。

<details>
<summary>参考答案与评价标准</summary>

在 system 模式中，系统变化是 resolved scheme 的输入；显式模式中，系统变化只是可观察环境信息，不拥有覆盖用户请求的权限。当前 `applyTheme()` 仍使用 `resolveScheme(state.mode)`，所以单纯删除条件未必立即破坏显式模式的最终颜色，但会触发不必要的完整应用、Canvas 重绘和 `themechange` 事件。这是一个很重要的区别：错误不一定表现为颜色错，也可能表现为多余工作和错误的事件语义。

完成标准：能区分“状态值错误”和“不必要副作用”；恢复后 `browser-verify.mjs` 通过。

</details>

## 练习三：让持久化失败可恢复

### 运行

在控制台执行：

```js
localStorage.setItem("theme-systems-demo.mode", "sepia");
localStorage.setItem("theme-systems-demo.skin", "unknown-brand");
location.reload();
```

### 观察

确认页面回退到 `system` 和 `ocean`，而不是把未知字符串写到 `<html>`。检查控制台是否存在由 Demo 引起的错误。

### 推理

回答：

1. 为什么存储里的字符串不能被视为可信枚举？
2. 为什么早期启动脚本和应用运行时都必须校验？
3. `storage` 事件收到 `newValue === null` 时代表什么，当前实现如何回退？

### 修改

暂时移除 [`index.html`](./theme-systems-demo/index.html) 早期脚本中的 `allowedModes` 校验，保留非法值并刷新。比较首屏根属性、应用接管后的状态和最终画面。

### 验证

- 解释为什么“应用最终修正了”仍不代表早期脚本可以不校验。
- 恢复校验。
- 在两个标签页中分别切换 Skin，确认只有另一个标签页接收 `storage` 事件，并且没有循环写入。
- 运行两条验证命令。

<details>
<summary>参考答案与评价标准</summary>

Web Storage 是字符串存储，不提供业务枚举约束。旧版本、其他脚本、开发者工具或异常迁移都可能写入未知值。启动脚本决定首次绘制，应用运行时决定后续状态；任一处放过非法值，都可能产生错误首帧、无匹配 Token 或状态不一致。

`newValue === null` 表示对应键被删除。当前实现对 mode 回退到 `system`，对 skin 回退到 `ocean`。执行写入的窗口不会收到自己的 `storage` 事件；其他共享该存储区的文档会收到。处理器只应用值、不再次持久化，因此不会形成回写循环。

完成标准：非法值不会进入最终根属性；双标签页同步正确；控制台无错误；验证通过。

</details>

## 练习四：新增 Skin，但不复制深浅模式

目标是新增 `ember` 品牌皮肤，同时复用现有 light/dark 语义层。

### 运行

切换现有 Ocean/Orchid，记录哪些属性随 Skin 变化、哪些只随 Scheme 变化。重点检查：

- `--brand-accent-light`；
- `--brand-accent-dark`；
- `--color-accent`；
- `--color-surface`；
- `--color-text`。

### 观察

确认 Skin 主要改变品牌相关值，而画布、文本和基础表面由 Scheme 决定。

### 推理

预测以下两种实现的维护差异：

1. 新增 `.ember-light` 和 `.ember-dark`，复制所有语义 Token；
2. 新增 `[data-skin="ember"]`，只提供 brand 的 light/dark 基础值。

### 修改

完整加入 Ember：

1. 在 [`index.html`](./theme-systems-demo/index.html) 的早期允许列表和控件中加入 `ember`。
2. 在 [`app.js`](./theme-systems-demo/app.js) 的 `allowedSkins` 中加入 `ember`。
3. 在 [`styles.css`](./theme-systems-demo/styles.css) 新增 `[data-skin="ember"]`，只定义六个品牌基础值。
4. 在 [`verify.mjs`](./theme-systems-demo/verify.mjs) 的 Skin 契约列表中加入 `ember`。
5. 在 [`browser-verify.mjs`](./theme-systems-demo/browser-verify.mjs) 中把一次 Skin 交互扩展为 Ember，检查持久化和跨标签页同步。

### 验证

- Ember 必须与 light、dark 和 system 三种请求模式组合。
- 表面和文本仍由 Scheme 决定，组件规则没有新增 Ember 分支。
- 刷新后保留 Ember；第二标签页同步。
- 静态、HTTP 和真实浏览器验证通过。

<details>
<summary>参考答案与评价标准</summary>

第二种方式把品牌轴和环境亮度轴正交组合。Ember 只需提供 light/dark 环境下可被语义层引用的品牌基础值；`--color-surface` 与 `--color-text` 不属于品牌所有权，不应复制。

只改控件会被运行时允许列表拒绝；只改运行时会在刷新时被早期脚本回退；只改 CSS 则没有可达状态。练习刻意要求同时更新输入、首次解析、运行时解析、样式映射和验证契约，以暴露主题系统的完整责任链。

完成标准：没有 `.ember-light`/`.ember-dark` 组件复制；所有组合可用；验证脚本覆盖新状态。

</details>

## 练习五：比较局部 CSS 继承与 Portal 边界

### 运行

把“局部主题作用域”设为固定浅色或深色，检查该卡片自身与内部 select 的 computed style。

### 观察

确认全局 `<html>` 的 `data-scheme` 没有改变，局部卡片却可以使用另一组 Token 和 `color-scheme`。

### 推理

预测：如果用 JavaScript 创建一个元素并直接 append 到 `document.body`，它能否继承局部卡片的 Token？为什么？

### 修改

在 `app.js` 中临时创建一个“浮层”：

```js
const portal = document.createElement("div");
portal.className = "demo-card";
portal.textContent = "Portal preview";
document.body.append(portal);
```

先观察它继承谁的 Token，再实现一种明确传递方案：

- 把浮层挂到局部主题容器；或
- 给浮层增加主题包装器并复制局部 Scheme；或
- 由统一 Theme Provider/Portal API 传递作用域信息。

### 验证

- 全局主题切换不应意外覆盖固定局部主题。
- 切回“继承全局”后，局部卡片和浮层行为符合你选择的所有权模型。
- 解释同样的问题如何出现在 Shadow DOM 或框架 Portal 中，以及哪些部分不能直接类比。

<details>
<summary>参考答案与评价标准</summary>

append 到 `body` 的元素不是局部卡片的 DOM 后代，因此沿根节点继承全局 Token。普通 DOM 局部主题依赖祖先链；Portal 改变了这条链。把浮层挂回局部容器最直接，但可能受 overflow、stacking context 和生命周期限制；复制主题属性需要定义同步机制；Theme Provider 则把传播责任移到框架层。

Shadow DOM 与 Portal 不相同：Shadow DOM 隔离选择器，但宿主上的可继承自定义属性仍可成为组件契约；Portal 是节点实际挂载位置改变。iframe 又是独立文档，不能靠普通继承。

完成标准：能以 DOM 所有权解释现象，而不是归因于“框架 bug”；传递方案有明确同步责任。

</details>

## 练习六：制造并定位错误主题首帧

### 运行

保持 requested mode 为 `dark`，刷新页面。使用浏览器性能面板或降低 CPU/网络速度，观察首次绘制前后 `<html>` 属性。

### 观察

当前 [`index.html`](./theme-systems-demo/index.html) 的 `bootTheme` 位于样式表之前。记录第一次可见绘制是否已经使用 dark。

### 推理

预测把早期脚本移动到页面末尾后，加载时序会变成什么。区分：

- CSS 未加载导致的无样式内容；
- CSS 已加载但使用默认浅色导致的错误主题闪烁；
- 应用 hydration 状态与 DOM 不一致。

### 修改

暂时把早期脚本移动到 `app.js` 之后，保持 CSS 中的默认 Scheme 为 light。刷新多次并记录时间线。

然后选择一种修复：

1. 恢复最小早期脚本；
2. 若你有 SSR 环境，改为服务端根据 Cookie 输出初始属性，并让客户端以 DOM 状态 hydration；
3. 移除显式覆盖需求，退回纯媒体查询方案。

### 验证

- `verify.mjs` 应在脚本移到样式表之后时失败，说明静态契约捕获了时序退化。
- 恢复后静态检查通过。
- 解释为什么在 Demo 中恢复早期脚本，并不能证明真实生产 CSP、CDN 和流式 SSR 已解决。

<details>
<summary>参考答案与评价标准</summary>

错误主题闪烁的核心是首次绘制采用了错误的 resolved scheme。早期脚本在样式表发现之前设置根属性，使随后计算的 CSS 直接使用正确值。移到末尾后，浏览器可能先以默认 light 完成绘制，再被应用改成 dark。

静态检查只能证明源码顺序满足约定；浏览器测试才能观察该环境中的运行行为；真实 SSR/CDN/CSP 仍需部署环境验证。三种证据不能互相替代。

完成标准：能够画出两条时序，恢复后验证通过，并明确 Demo 验证边界。

</details>

## 练习七：证明 SVG 与 Canvas 处于不同渲染模型

### 运行

在 Ocean/Orchid 和 light/dark 之间切换，分别观察内联 SVG 与 Canvas。

### 观察

- SVG 的圆形与矩形如何取得颜色？
- Canvas 的 render count 在何时增加？
- 切换局部卡片 Scheme 是否需要重绘全局 Canvas？

### 推理

解释为什么 SVG 中的 `currentColor` 与 `var(--color-accent)` 会自动重新求值，而 Canvas 已绘制像素不会保留这些引用。

### 修改

暂时从 `applyTheme()` 中移除 `scheduleCanvasRender()`：

1. 切换主题，观察 SVG 已更新而 Canvas 保留旧颜色。
2. 设计一个第三方图表适配接口，例如 `updateChartTheme(resolvedTokens)`。
3. 恢复 Canvas 调度，并保证多次快速切换只保留一个待执行 animation frame。

### 验证

- 恢复后，Canvas 数据 URL 在 light/dark 之间不同。
- `browser-verify.mjs` 通过；该脚本会实际比较主题切换前后的 Canvas 像素编码。
- 说明为什么这仍不等于任意第三方图表库都已适配。

<details>
<summary>参考答案与评价标准</summary>

内联 SVG 仍在 CSS 样式与绘制模型中，`currentColor` 和 CSS 变量会随 computed style 更新。Canvas API 把当时的颜色转换成位图像素；后续 CSS 变化不会追溯修改已绘制内容。

`scheduleCanvasRender()` 先取消上一个 animation frame，再安排新帧，避免同一事件循环中快速切换产生多次无意义重绘。第三方库可能缓存主题对象、拥有动画队列或需要销毁实例，因此必须通过适配层和其官方 API 验证。

完成标准：能用保留引用与写入像素的差别解释现象；恢复后浏览器验证通过。

</details>

## 练习八：把每套主题当作独立可访问性状态

### 运行

分别选择 Ocean/Orchid 与 light/dark，使用浏览器 Accessibility/Elements 工具检查：

- 正文文本与背景；
- 次要文本与背景；
- accent 文本与 soft 背景；
- focus ring 与相邻颜色；
- 卡片边界；
- 原生表单控件。

随后模拟 `forced-colors: active` 和 `prefers-reduced-motion: reduce`。

### 观察

建立检查表：

| Skin | Scheme | 文本对比 | focus 可见 | 原生控件一致 | forced-colors 可理解 |
| --- | --- | --- | --- | --- | --- |
| Ocean | light |  |  |  |  |
| Ocean | dark |  |  |  |  |
| Orchid | light |  |  |  |  |
| Orchid | dark |  |  |  |  |

### 推理

1. 为什么只验证 `--color-text` 与 `--color-surface` 两个十六进制值不够？
2. 为什么 `forced-colors` 不是第三种由产品控制的 Skin？
3. 为什么不应对所有元素使用 `transition: all`？

### 修改

选择一个状态，故意把次要文本颜色改到低对比度，再使用对比度工具确认失败。随后修复语义 Token，而不是在单个组件上写特例。

再暂时删除 `prefers-reduced-motion` 规则，比较主题切换；恢复后确认减少动态效果时过渡被压缩。

### 验证

- 四个 Skin/Scheme 组合的关键文本达到正文所述 WCAG 2.2 目标。
- focus、错误或选中状态不只依赖颜色。
- 强制颜色模式中边界和选中指示仍可理解。
- 说明自动对比度检查没有覆盖哪些人工判断。

<details>
<summary>参考答案与评价标准</summary>

半透明颜色需要与实际背景合成，文字可能位于不同局部主题中，hover/focus/disabled 等状态也会改变前景和背景，所以比较两个 Token 字面值不足以覆盖真实组合。`forced-colors` 的所有权属于用户和用户代理，页面应适应，而不是把它包装成品牌 Skin。

`transition: all` 可能动画布局、尺寸和不适合过渡的属性，增加无谓工作，也忽略减少动态效果偏好。修复应优先发生在语义 Token 层，使所有消费者获得一致改进；组件特例只在语义确实不同的情况下使用。

自动工具无法完全判断信息是否只靠颜色、focus 是否在所有背景上清晰、图表系列是否可区分，以及辅助技术和真实设备上的可用性。

完成标准：检查矩阵有实测数据；故障能由语义层修复；明确自动化边界。

</details>

## 综合任务：给三个产品选择架构

不要写“统一使用 CSS 变量”。分别为以下产品给出决策，并说明被排除方案的代价。

### 场景 A：文档站

- 只有 light/dark；
- 默认跟随系统；
- 不提供手动切换；
- 必须在 JavaScript 禁用时工作。

### 场景 B：账户型 SaaS

- 单品牌；
- system/light/dark 三态；
- SSR；
- 用户偏好跨设备同步；
- 使用 Canvas 图表和第三方代码编辑器。

### 场景 C：白标平台

- 数十个客户品牌；
- Web、iOS、Android 共享设计决策；
- 客户可以独立发布品牌包；
- 主应用和多个跨源子应用需要同步主题。

对每个场景覆盖：

1. 主题状态的事实源；
2. 首屏策略；
3. Token 分层和产物；
4. CSS/非 CSS 边界；
5. 缓存和资源加载；
6. 可访问性与浏览器验证；
7. 尚未由当前证据解决的风险。

<details>
<summary>参考决策与评价标准</summary>

场景 A 可优先使用 `prefers-color-scheme`、`color-scheme: light dark` 和带回退的 `light-dark()`/CSS Token，不需要建立 JavaScript 状态机。

场景 B 需要请求模式与 resolved scheme 分离。服务器账户偏好或 Cookie 可输出初始属性，客户端从同一状态 hydration，并监听 system 模式。跨设备同步属于业务账户数据，不只是 localStorage。Canvas 和编辑器通过适配层消费 resolved Token。

场景 C 适合把品牌源数据放进有版本的 Design Token 流水线，生成多端产物；Web 端再用运行时 CSS Token 组合 Scheme。品牌包若独立加载，需要签名/来源、失败回退、缓存和兼容版本策略。跨源子应用使用经过 origin 校验的消息协议，而不是假设 CSS 继承。

高质量答案不会把任一方案描述为无条件最佳，并会区分：标准能证明的机制、Demo 已复现的行为、特定框架或部署仍需验证的部分。

</details>

## 完成判据

完成练习后，应能够不依赖框架术语回答：

- 主题切换改变的是哪一层状态或样式输入？
- requested mode、system preference 与 resolved scheme 分别由谁拥有？
- CSS 自定义属性为何适合主题传播，在哪里会中断？
- `prefers-color-scheme`、`color-scheme` 与 `light-dark()` 各解决什么、不解决什么？
- 首次绘制为何会出现错误主题，修复方案有哪些代价？
- 何时应选择独立样式表、构建期 Token 或 Theme Provider？
- 如何验证原生控件、SVG、Canvas、Portal、iframe 和辅助功能模式？
- 为什么构建通过、静态检查通过和一台 Chrome 验证通过都不能单独证明生产完成？
