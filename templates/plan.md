# 工程架构与垂直切片研发计划 (Engineering Plan)

> 权威契约 2/3：由 Architect 内核遵循“代码之禅”与奥卡姆剃刀产出。`[]` 内为稳定机器校验标识。

## 当前仓库与依赖发现 [Current Repository Findings]

- **目录与技术栈**：记录当前项目语言、运行时版本、目录结构与现有模块。
- **构建与测试命令**：精确的 build、test、typecheck、lint 命令。
- **现有依赖审查 [Existing Dependency Review]**：优先使用标准库与现有依赖；任何新增第三方依赖必须证明标准库无法满足。

| 需求能力 [Need] | 已检查标准库/现有依赖 [Checked Stdlib / Existing Dep] | 决策 [Decision] | 理由 [Reason] |
| --- | --- | --- | --- |
| 核心功能实现 | Node.js / Python 标准库与现有模块 | reuse | 标准库已完备支持，零外部依赖引入 |

## 架构设计 [Architecture]

```text
Entrypoint / Handler / UI Surface (Layer 1: 输入校验、路由分发、视图呈现)
  └──> Core Domain & State Logic  (Layer 2: 纯业务规则、状态流转、持久化原子操作)
```

### 复杂度说明与扁平设计 [Complexity Justification & Flat Design]

- **两层扁平架构**：严格采用 `Entrypoint/Handler -> Core Domain Logic` 两层直接调用。
- **反过度抽象承诺**：不到 3 个已存在的复用点，绝不引入 `Factory`、`Adapter`、`Strategy`、`Proxy`、`Facade` 等胶水包装层。
- **函数嵌套与深模块约束**：所有函数缩进嵌套深度 `<= 3`，公共接口极简，实现内聚。

## 数据模型与精简 Schema [Database Design]

- **Lean Schema 声明**：只定义当前已确认 `REQ-NNN` 必需的字段，严禁 `ext_json`、`extra_data`、`reserved_*` 等预留扩展字段。
- **并发与原子性策略**：文件写入采用临时文件 + 原子替换（或数据库事务/CAS），防止半写损坏。

## 七维业务规则防御矩阵 [Business Rule Matrix]

| 规则编号 [Rule ID] | 适用模块 [Applicable Modules] | 维度 [Dimension] | 场景与防御设计 [Description & Scenarios] | 是否适用 [Applicable] | 验证策略与测试接缝 [Verification Strategy & Test Reference] |
| --- | --- | --- | --- | --- | --- |
| BR-1 | MOD-001 | Normal Path | 有效输入与标准正常主流程闭环 | Yes | 公共接口正常路径测试 |
| BR-2 | MOD-001 | Invalid Input | 缺失必填项、非法类型、格式错误时显式报错拒绝 | Yes | 非法输入与异常捕获测试 |
| BR-3 | MOD-001 | Boundary Cases | 0、1、最大值、空集合、50+ 字符超长文本压力测试 | Yes | 边界极值与长文本抗挤压测试 |
| BR-4 | MOD-001 | Permission Boundary | 路径白名单 (`allowed_paths`) 与作用域隔离检查 | Yes | 越界写入拦截测试 |
| BR-5 | MOD-001 | Idempotency & Retry | 重复执行或重试不产生重复副作用或脏数据 | Yes | 幂等性重复调用测试 |
| BR-6 | MOD-001 | Concurrency | 并发读写或状态更新时的原子性与锁保护 | Yes | 原子写入与并发安全测试 |
| BR-7 | MOD-001 | Dependency Failure | 外部命令/网络超时或异常时的有界超时与优雅降级 | Yes | 超时控制与错误恢复测试 |

## 垂直研发切片计划 [Vertical Slices]

| 切片编号 [Slice ID] | 模块编号 [Module ID] | 包含需求 [Included Requirements] | 允许修改路径 [Allowed Paths] | 最高稳定公共测试接缝 [Highest Stable Seam] | 验证命令与预期输出 [Verification Command] | 退出条件 [Exit Criteria] |
| --- | --- | --- | --- | --- | --- | --- |
| SLC-001 | MOD-001 | REQ-001 | `src/`, `tests/` | 核心公共入口函数 / CLI / 路由 | `node --test` -> 100% PASS | 红绿 TDD 闭环通过，零越界修改 |
