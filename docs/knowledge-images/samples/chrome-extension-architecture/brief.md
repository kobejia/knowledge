# Chrome Extension 架构图片内容脚本

- 原文：`learn/frontend/browser/chrome-extension-architecture.md`
- 核心问题：Manifest V3 下，插件为何不能被当成拥有更多 API 的单页应用？
- 核心结论：它是一个跨多个生命周期与信任区的事件驱动系统；质量由最小权限、消息协议、可恢复状态和特权隔离共同决定。
- 阅读顺序：从网页进入 content script，通过受验证的消息协议到达 service worker，再访问持久状态与受权限约束的 Chrome API。
- 必须保留的限定：content script 位于低信任区；service worker 持有主要权限但可随时终止；进程内存不能是真相来源。
- 视觉类型：信任边界 + 运行时架构图。
- 建议比例：16:10。
