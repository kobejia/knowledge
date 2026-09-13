---
title: Android、iOS 与 WebView Bridge 全面练习：调用、生命周期与信任边界
domain: frontend
depth: deep-dive
created: 2026-09-13
updated: 2026-09-13
---

# Android、iOS 与 WebView Bridge 全面练习：调用、生命周期与信任边界

本练习与[《Android、iOS 双原生与 WebView Bridge》](./android-ios-native-and-webview-bridge.md)及 [`android-ios-native-and-webview-bridge-demo/`](./android-ios-native-and-webview-bridge-demo/) 使用同一模型。目标不是背诵 Android 与 iOS API，而是完成一个闭环：

```text
运行 -> 观察 -> 推理 -> 修改 -> 验证
```

练习中的“Android transport”和“iOS transport”只模拟两种 JavaScript 入口形态。Demo 没有启动 Android Emulator、iOS Simulator 或真实 WebView，因此不能把结果解释为真机线程、权限、进程隔离或性能验证。

## 准备环境

在仓库根目录运行协议、资源和语法测试：

```bash
node learn/frontend/mobile/android-ios-native-and-webview-bridge-demo/verify.mjs
```

运行真实 Chrome 交互验证：

```bash
node learn/frontend/mobile/android-ios-native-and-webview-bridge-demo/browser-verify.mjs
```

然后启动实验页面：

```bash
node learn/frontend/mobile/android-ios-native-and-webview-bridge-demo/serve.mjs
```

访问 `http://127.0.0.1:4175`。如果端口被占用，可以使用任务专用环境变量：

```bash
BRIDGE_DEMO_PORT=4176 node learn/frontend/mobile/android-ios-native-and-webview-bridge-demo/serve.mjs
```

需要使用其他 Chrome/Chromium 可执行文件时：

```bash
BRIDGE_DEMO_CHROME=/absolute/path/to/chrome \
  node learn/frontend/mobile/android-ios-native-and-webview-bridge-demo/browser-verify.mjs
```

修改前先记录 `git diff -- learn/frontend/mobile/`。完成一组实验后保留有价值的修改或手动恢复本组改动，不要使用会覆盖仓库其他工作的重置命令。

## 练习一：追踪一次跨边界调用

### 运行

1. 保持宿主为 `Android injected object`，故障档位为“正常”。
2. 在 H5 页面点击“读取 App 信息”。
3. 同时观察 H5 的 Promise 日志、pending 数量和右侧宿主日志。
4. 切换为 `iOS message handler`，重复操作。

### 观察

填写实际顺序：

```text
H5 button
  -> ____________________
  -> Android: ____________________ / iOS: ____________________
  -> host capability router
  -> ____________________
  -> Promise resolve
```

回答：

1. H5 业务按钮是否包含 Android/iOS 判断？平台判断实际位于哪里？
2. 为什么宿主响应中仍需要 `id`，即使这次只有一个请求？
3. transport 入口不同，哪一部分协议没有变化？

### 修改

在 [`webview.js`](./android-ios-native-and-webview-bridge-demo/webview.js) 的 `diagnostic()` 中，让 `request-sent` 日志额外显示请求 ID。不要改宿主实现。

### 验证

- 两个平台都能返回自己的 `platform`。
- H5 的调用方法仍是 `bridge.getAppInfo`。
- `pending` 在发送后变成 1，响应后回到 0。
- 重新运行 `verify.mjs` 与 `browser-verify.mjs`。

<details>
<summary>参考答案与评价标准</summary>

完整路径是：按钮事件 → `callCapability()` → `createBridgeClient().call()` → `sendThroughPlatform()` → Android 的 `AndroidBridge.postMessage(serialized)` 或 iOS 的 `window.webkit.messageHandlers.bridge.postMessage(message)` → `handleFromWeb()` → 能力注册表 → `createResponse()` → `__bridgeReceive()` → pending map → Promise resolve。

平台判断只存在于 transport 与宿主安装逻辑，不进入业务按钮。`protocol`、`version`、`kind`、`sessionId`、`id`、`method`、`params` 等消息语义在两个 transport 间保持一致。

即使现在只有一个请求，异步系统也不能把“暂时没有并发”当作协议不变量。相机、登录或网络操作随时会重叠；请求 ID 是协议能力，不是并发出现后临时加的补丁。

完成标准：能画出完整路径；能指出协议与 transport 的边界；修改只影响诊断展示，没有改变消息结构或宿主分发。

</details>

## 练习二：证明响应顺序不能代表请求身份

### 运行

1. 选择“并发响应乱序”档位。
2. 点击“并发调用两个能力”。
3. 记录 H5 显示的完成顺序。
4. 在宿主日志中分别找到两个 request ID 与对应 response。

### 预测

在运行前先回答：

- 哪个能力会先完成？
- `Promise.allSettled([appInfo, navigation])` 的结果数组会按完成顺序还是输入顺序排列？
- 如果 Bridge 只用一个全局 callback，最可能发生什么？

### 修改

在 [`host.js`](./android-ios-native-and-webview-bridge-demo/host.js) 的 `responseDelay()` 中交换两种能力的延迟，再运行一次。不要改 pending map。

### 验证

- 修改前 `navigation.openNativePage` 先完成，修改后顺序反转。
- 两次运行中，两个 Promise 都得到属于自己方法的结果。
- `browser-verify.mjs` 原有的乱序断言会因实验修改而失败；完成观察后恢复延迟，使测试重新通过。

<details>
<summary>参考答案与评价标准</summary>

原始 `reorder` 档位给 `bridge.getAppInfo` 260ms，给另一个方法 60ms，所以 navigation 先完成。`Promise.allSettled()` 的结果数组保持输入 Promise 的顺序；Demo 另设 `completionOrder` 才记录实际完成顺序。

pending map 用 response `id` 找到具体 Promise，因此延迟变化不会串结果。单一全局 callback 则会被后一个请求覆盖，或把先到的结果交给错误调用方。

完成标准：区分“响应到达顺序”“Promise 聚合结果顺序”“请求身份”三个概念，并能用日志中的 ID 证明关联没有依赖时间顺序。

</details>

## 练习三：新增能力而不污染 H5 平台判断

目标是加入 `device.getBatteryState`，返回：

```json
{
  "level": 0.76,
  "charging": false,
  "source": "android"
}
```

### 修改

1. 在 [`host.js`](./android-ios-native-and-webview-bridge-demo/host.js) 的能力分发中注册 `device.getBatteryState`。
2. Android 返回 `source: "android"`，iOS 返回 `source: "ios"`；其余字段保持同一 Schema。
3. 在 [`webview.html`](./android-ios-native-and-webview-bridge-demo/webview.html) 添加一个按钮。
4. 在 [`webview.js`](./android-ios-native-and-webview-bridge-demo/webview.js) 调用同一个 `device.getBatteryState`，不要在按钮处理器中读取 `state.platform`。
5. 在 [`verify.mjs`](./android-ios-native-and-webview-bridge-demo/verify.mjs) 增加成功响应和未知字段边界的协议测试。

### 观察与推理

1. `source` 是否应该成为业务逻辑的分支依据？什么情况下它只适合诊断？
2. 两端无法提供完全相同的电池字段时，应该伪造字段、返回 `null`，还是提升 capability 版本？
3. 为什么不能允许 H5 传入原生类名和方法名来减少注册代码？

### 验证

- 两个平台按钮行为一致，返回 Schema 一致。
- transport 仍是唯一的平台判断位置之一；H5 业务层没有 `if (android)`/`if (ios)`。
- 未注册的 `device.readEverything` 返回 `METHOD_NOT_FOUND`，不会触发动态反射。
- 两个验证脚本通过。

<details>
<summary>参考答案与评价标准</summary>

业务应尽量消费稳定语义，例如 `level` 与 `charging`；`source` 适合实验展示、诊断和差异审计，不应在无实际需求时扩散平台分支。

字段差异需要先判断语义：确实不可用但可安全缺省，可以用明确的可选字段；语义或权限流程发生破坏性变化，应提升能力版本。伪造数据会让调用方无法区分“不支持”和真实状态。

固定能力注册表是最小权限边界。页面传任意类名/方法名会把 Bridge 变成反射执行器，使参数校验、授权、审计和兼容治理全部失去明确入口。

完成标准：新增能力只改注册表、H5 UI 与测试；消息信封和两个 transport 无需复制。

</details>

## 练习四：处理超时、晚到响应与页面重载

### 运行

1. 选择“慢操作超时”，点击“调用慢操作”。
2. 观察约 400ms 后的 `BRIDGE_TIMEOUT`。
3. 继续等待宿主 1200ms 的响应，观察 H5 是否重新变成成功。
4. 再次调用慢操作，在它 pending 时立即点击“重载 WebView 会话”。
5. 观察宿主如何处理旧 session 的晚到响应。

### 推理

回答：

1. 为什么超时后不能保留 pending 项等待“也许还会回来”的结果？
2. 页面重载后 request ID 从头计数是否安全？还需要什么维度？
3. 对支付或下单这种可能已产生外部副作用的能力，客户端超时是否等于操作失败？

### 修改

把 [`webview.js`](./android-ios-native-and-webview-bridge-demo/webview.js) 的默认超时从 400ms 临时改为 1500ms，重新运行第一组操作。记录变化后恢复。

### 验证

- 400ms 配置下，Promise 只结束一次；1200ms 的晚到响应被记录并忽略。
- 页面重载后出现新的 `sessionId`；宿主记录“丢弃旧会话响应”。
- 1500ms 配置下，同一宿主操作能在 deadline 前成功，这证明超时是客户端策略，不是对原生执行状态的证明。
- 恢复 400ms 后，两个验证脚本通过。

<details>
<summary>参考答案与评价标准</summary>

Promise 一旦以超时结束就不能再次 resolve。pending 项必须及时删除，否则会泄漏内存并让迟到结果修改已经进入降级路径的 UI。随后到达的 response ID 找不到 pending 项，应记为 late/duplicate 后忽略。

仅有递增 ID 不足以跨页面区分请求：新页面可能再次生成 `1`。`sessionId + id` 才标识一次具体页面会话中的调用。

超时只表示“调用方在 deadline 内没有拿到确定结果”。支付、订单和上传可能已经在宿主或服务端成功，不能自动重试；应使用业务幂等键和状态查询确定最终结果。

完成标准：明确区分 Promise 状态、原生操作状态和业务外部状态，并解释 `sessionId` 为什么不是可选字段。

</details>

## 练习五：验证来源校验不是完整授权

### 运行

1. 保持正常档位，点击宿主的“模拟不可信 frame 调用”。
2. 在宿主日志中确认出现 `ORIGIN_REJECTED`，且相册能力未执行。
3. 阅读 [`host.js`](./android-ios-native-and-webview-bridge-demo/host.js) 中对 `sourceWindow` 与 `sourceOrigin` 的检查。

### 修改

在本地实验中暂时移除 `sourceOrigin !== location.origin` 条件，再点击“不可信 frame”按钮。观察请求进入能力分发后立即恢复校验。

### 推理

1. 为什么“来源是自己的域名”仍不能证明脚本可信？
2. 如果主页面存在 XSS，来源检查还能挡住它调用 Bridge 吗？
3. 为什么传统 Android `addJavascriptInterface` 比 Demo 的显式来源参数更难校验 frame 来源？
4. 相机、支付和打开内部页面是否应该拥有相同授权规则？

### 验证

- 恢复来源检查后，不可信调用再次被拒绝。
- 给 `media.chooseImage` 增加参数 Schema 校验：`maxCount` 必须是 1—9 的整数。
- 即使来源可信，非法 `maxCount` 也返回 `INVALID_PARAMS`。
- 验证脚本通过。

<details>
<summary>参考答案与评价标准</summary>

来源校验只回答“消息来自哪个窗口/源”，不能证明该源中执行的脚本没有被 XSS、第三方依赖或供应链攻击控制。主页面 XSS 与合法代码共享同一 origin，所以还需要 CSP、依赖治理、固定能力表、参数校验和原生侧授权。

传统 Android 注入对象会暴露给 WebView 的所有 frame，官方文档指出接口缺少可靠的调用 frame origin 验证。因此真实实现不能假设 Demo 中的 `sourceOrigin` 参数天然存在或可信。

能力应按风险分级：读取非敏感 App 版本、选择本地文件、支付、账户变更和任意内部导航需要不同的前台状态、用户确认、登录态与权限校验。

完成标准：不把来源、认证、授权和参数校验混为一谈；能说明每层分别阻止什么攻击。

</details>

## 练习六：把“版本判断”改成能力协商

当前“协议版本不兼容”档位会拒绝所有调用。它适合观察错误传播，但不够精细。

### 设计

把握手结果设计为：

```json
{
  "protocolVersion": 1,
  "capabilities": {
    "bridge.getAppInfo": 1,
    "media.chooseImage": 2,
    "navigation.openNativePage": 1
  }
}
```

回答：

1. H5 需要 `media.chooseImage@2`，宿主只有 v1 时，应隐藏入口、降级参数还是阻止整页运行？
2. 新增可选参数与改变返回字段语义，是否应该采用相同升级方式？
3. 为什么只判断 `appVersion >= 6.2.0` 难以表达 Android/iOS 灰度和插件差异？

### 修改

1. 给宿主新增 `bridge.getCapabilities`。
2. H5 安装 transport 后先握手，再启用按钮。
3. 没有 `media.chooseImage` 时只禁用对应按钮，保留读取 App 信息和导航能力。
4. 把能力表加入 `window.__bridgeSnapshot()`，便于测试观察。
5. 增加三个测试：完整能力、缺少单项能力、协议主版本不兼容。

### 验证

- 单个能力缺失不会让无关能力不可用。
- H5 不通过 user agent 猜宿主能力。
- 破坏性协议版本不兼容与普通能力缺失返回不同错误。
- 两个验证脚本通过。

<details>
<summary>参考答案与评价标准</summary>

降级策略由业务风险决定。非关键图片选择可以隐藏或退化为 Web 文件选择；支付协议不兼容则应阻止该流程并提供升级或其他支付路径。不能把所有能力缺失都升级为整页不可用。

新增可选参数若有明确默认语义，通常可保持能力版本；改变同一字段含义、权限流程或结果结构是破坏性变化，应提升能力版本。协议主版本用于信封和基本语义不兼容，不应被每个业务方法的小变化频繁推动。

App 版本只是发布包标签。同一版本可能因平台、灰度、远程开关、插件打包或最低系统版本而拥有不同能力。直接协商 capability 更接近实际运行事实。

完成标准：握手失败和单项缺失可以独立处理；按钮状态来自 capability，而不是平台或 App 版本硬编码。

</details>

## 练习七：为真实业务选择边界

针对下面四个场景，选择“原生页面”“有 Bridge 的 Hybrid 页面”“无 Bridge WebView”“系统浏览器/Custom Tab/Safari View Controller”之一，并写出理由：

1. 每周变化、主要由图文和表单组成的营销活动页，需要登录态和分享能力。
2. 银行支付确认页，需要生物识别、硬件密钥、截图防护和严格审计。
3. 用户点击第三方商户条款链接，只需阅读和返回 App。
4. 行程编辑器包含地图、离线轨迹、连续定位和复杂手势，但部分说明区块由运营在线更新。

### 输出模板

```text
场景：
主 UI 边界：
是否启用 Bridge：
最小能力表：
导航所有者：
认证与授权：
离线/弱网策略：
版本降级：
关键测试：
明确不共享的部分：
```

### 验证

将设计与正文的决策树逐项对照，至少写出：

- 一条平台差异是正确行为而不是缺陷；
- 一个页面会话失效后的恢复策略；
- 一个不可信内容隔离策略；
- 一个需要真机测量、不能由本 Demo 证明的性能或交互指标。

<details>
<summary>参考方向与评价标准</summary>

营销活动页适合评估受控 Hybrid，但 Bridge 应仅提供分享、受限登录状态查询和必要导航；远程脚本、资源签名、版本降级和域名策略是关键。银行支付确认更偏向原生 UI 与原生安全能力，不能用高代码复用率覆盖审计和平台安全要求。

第三方条款不应进入拥有业务 Bridge 的主 WebView；系统浏览器或平台提供的受限浏览控制器边界更清楚。地图行程编辑器的主交互更适合原生或经过真机验证的跨平台 UI，在线说明区块可以是局部、无高权限 Bridge 的受控 Web 内容。

评分重点不是选择名称，而是：边界是否与内容信任、交互频率、设备能力、生命周期、离线和发布节奏一致；是否给出版本、失败和退出策略；是否明确哪些结论必须由 Android/iOS 真机验证。

</details>

## 完成检查

- 能从按钮一路追踪到原生能力和 Promise 完成，不把 transport 当成业务协议。
- 能用 `id` 解释并发乱序，用 `sessionId` 解释页面重载。
- 能区分超时、取消、权限拒绝、方法缺失、版本不兼容和宿主失效。
- 新增能力时使用固定注册表与一致 Schema，没有把平台判断扩散到 H5 业务层。
- 能说明来源检查、内容可信、参数校验、认证和授权分别解决什么问题。
- 能根据业务选择共享层，而不是把代码复用率作为唯一指标。
- `verify.mjs` 和 `browser-verify.mjs` 均通过；实验性修改已经恢复或有意保留并更新了测试。
