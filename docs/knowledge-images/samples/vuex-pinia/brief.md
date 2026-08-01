# Vuex 与 Pinia 图片内容脚本

- 原文：`learn/frontend/vue/vuex-pinia.md`
- 核心问题：Pinia 相比 Vuex 改变的是底层原理，还是上层组织方式？
- 核心结论：两者同样依赖 Vue 响应式系统和应用级注入；Pinia 的主要改进在于扁平 Store、Action 直接修改状态与 TypeScript 推导。
- 阅读顺序：先看共性，再对比状态结构、修改流程、模块组织和类型体验，最后得出 Vue 3 新项目优先 Pinia 的建议。
- 必须保留的限定：Vuex 仍适合 Vue 2 项目维护和已有架构的渐进迁移。
- 视觉类型：A/B 对比图。
- 建议比例：16:9。
