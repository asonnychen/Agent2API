# 插件源码（Agent2Providers / Agent2WebProviders）与网关的关系

本仓库是自用构建，插件源码**不再按 git tag 从上游拉取**，而是直接放在 `plugins/` 下：

| 位置 | 内容 |
|---|---|
| `plugins/Agent2Providers/` | 上游 `ProvidersPlugin/Agent2Providers` 的快照：`provider-protocol`（契约）、`provider-sdk`（trait + serve）、`crates/providers`（21 家实现，即「提供商增强」插件） |
| `plugins/Agent2WebProviders/` | 上游 `ProvidersPlugin/Agent2WebProviders` 的快照：智谱清言与 DeepSeek 网页实现，含本仓库打的一行补丁 |

两者都是独立 cargo workspace，`Agent2WebProviders` 通过**相对路径**依赖 `Agent2Providers` 的两个契约 crate：

```toml
# plugins/Agent2WebProviders/crates/providers/Cargo.toml
agent2api-provider-protocol = { path = "../../../Agent2Providers/crates/provider-protocol" }
agent2api-provider-sdk = { path = "../../../Agent2Providers/crates/provider-sdk" }
```

好处：改协议本地立刻生效，不需要打 tag、发版、再 `cargo update`；离线也能编译。

## 改协议的流程

1. 改 `plugins/Agent2Providers/crates/provider-protocol/`
2. 直接编译验证两个插件：
   ```bash
   cargo build --release -p agent2api-web-providers --manifest-path plugins/Agent2WebProviders/Cargo.toml
   cargo build --release -p agent2api-providers    --manifest-path plugins/Agent2Providers/Cargo.toml
   ```
3. 重新打插件包：`npm run dist -- --skip-tauri`

## 打插件包

每个插件目录下都有自己的 `scripts/pack.mjs`：

```bash
node plugins/Agent2WebProviders/scripts/pack.mjs --skip-build --out dist
node plugins/Agent2Providers/scripts/pack.mjs    --skip-build --out dist
```

产物是 `dist/<id>-<version>-<target>.zip`，在网关界面「插件 → 从文件安装…」里选中即可。

`npm run dist` 会依次完成：编译两个插件 → 打包 → 编译桌面端 → 把安装包与插件 zip 一起放进 `dist/`。

## 与上游的关系

这两个目录是**快照复制**，不是 git submodule / subtree。上游发新版不会自动跟进；要升级就重新复制一份并重新打补丁（DeepSeek 的 `Content-Type` 修复见 `crates/providers/src/providers/deepseek/mod.rs` 的 `headers()`）。

因为更新源与插件索引都指向本仓库（`asonnychen/Agent2API`），且插件自动更新默认关闭，已安装的插件不会被官方新包覆盖。
