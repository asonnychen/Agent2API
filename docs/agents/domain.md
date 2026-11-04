# 领域文档

技能在探索本仓库代码库时，应如何消费这里的领域文档。

## 探索之前先读这些

- 仓库根目录的 **`GLOSSARY.md`**，或
- 若存在根目录的 **`GLOSSARY-MAP.md`**：它指向每个上下文各自的 `GLOSSARY.md`。把与当前话题相关的都读一遍。
- **`docs/adr/`**：读与即将改动的区域相关的 ADR。多上下文仓库里还要看 `src/<context>/docs/adr/` 下针对该上下文的决策。

这些文件若不存在，**静默继续**。不要点出它们的缺失，也不要主动建议提前创建。`/domain-modeling` 技能（经由 `/grill-with-docs` 和 `/improve-codebase-architecture` 触达）会在术语或决策真正定下来时按需创建。

## 文件结构

单上下文仓库（大多数仓库）：

```
/
├── GLOSSARY.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

多上下文仓库（根目录存在 `GLOSSARY-MAP.md`）：

```
/
├── GLOSSARY-MAP.md
├── docs/adr/                          ← 全局性决策
└── src/
    ├── ordering/
    │   ├── GLOSSARY.md
    │   └── docs/adr/                  ← 上下文相关决策
    └── billing/
        ├── GLOSSARY.md
        └── docs/adr/
```

## 使用术语表里的词汇

当你的产出要命名某个领域概念时（issue 标题、重构提案、假设、测试名），使用 `GLOSSARY.md` 中定义的术语。不要漂移向术语表明确回避的同义词。

如果需要的概念还不在术语表里，这是一个信号：要么你在发明项目并不使用的语言（请重新考虑），要么这里确实存在空白（记下来交给 `/domain-modeling`）。

## 标出 ADR 冲突

如果你的产出与现有 ADR 相矛盾，要显式指出，而不是悄悄覆盖：

> _与 ADR-0007（事件溯源订单）相矛盾，但值得重新讨论，因为……_
