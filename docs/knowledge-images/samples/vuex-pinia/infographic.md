# Vuex 与 Pinia 对比图

```infographic
infographic compare-binary-horizontal-underline-text-vs
theme
  palette #334155 #0f766e #d97706
data
  title Vuex vs Pinia：同源不同构
  desc 底层同源，上层组织方式不同
  items
    - label Vuex
      children
        - label 单一状态树、嵌套模块
        - label Mutation 与 Action 分层
        - label 中心注册、命名空间
        - label TS 需额外类型工作
    - label Pinia
      children
        - label 扁平 Map、独立 Store
        - label Action 直接修改 State
        - label 按需注册、自由组合
        - label TS 自动类型推导
```
