#!/usr/bin/env node
/**
 * 一键产出可分发目录 `dist/`：安装包 + 插件包。
 *
 * 做三件事：
 *   1. 编译 `plugins/` 下的两个插件，并用各自的 `scripts/pack.mjs` 打成 zip；
 *   2. 重建前端产物（ui-islands）后编译 desktop-tauri，拿到 NSIS 安装包；
 *   3. 把安装包与插件 zip 一起放进根目录的 `dist/`，附一份安装说明。
 *
 * ── 为什么要有这个脚本 ────────────────────────────────────────
 * 安装包**不捆绑插件**（`tauri.conf.json` 的 resources 只有 ui/licenses/LICENSE）。
 * 全新电脑装完主程序是空壳，而本仓库的更新源指向自己的 fork、插件索引为空，
 * 界面里装不了官方插件 —— 只能靠这里产出的 zip 手动安装。
 *
 * ── 用法 ──────────────────────────────────────────────────────
 * ```bash
 * npm run dist                  # 插件 + 安装包，全做
 * npm run dist -- --skip-tauri  # 只编插件（调试插件时用）
 * npm run dist -- --skip-plugins
 * ```
 *
 * 退出码：0 = 成功；非 0 = 任一步失败（直接中断，不产出半成品）。
 */

import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const args = new Set(process.argv.slice(2))
const skipPlugins = args.has('--skip-plugins')
const skipTauri = args.has('--skip-tauri')

/** 插件目录 → 对应的 cargo 包名。`pack.mjs` 会按各自 `target/release/` 找二进制。 */
const PLUGINS = [
  { label: '网页提供商', dir: join(ROOT, 'plugins/Agent2WebProviders'), pkg: 'agent2api-web-providers' },
  { label: '提供商增强', dir: join(ROOT, 'plugins/Agent2Providers'), pkg: 'agent2api-providers' },
]

function run(command, commandArgs, cwd = ROOT) {
  console.log(`\n[dist] ${command} ${commandArgs.join(' ')}`)
  // Windows 上 Node 不能直接 spawn `npm.cmd`（EINVAL），交给 cmd.exe 执行。
  if (process.platform === 'win32' && command === NPM) {
    execFileSync('cmd.exe', ['/c', 'npm', ...commandArgs], { cwd, stdio: 'inherit' })
    return
  }
  execFileSync(command, commandArgs, { cwd, stdio: 'inherit' })
}

function buildPlugins() {
  for (const plugin of PLUGINS) {
    console.log(`\n[dist] ── ${plugin.label} ──`)
    run('cargo', ['build', '--release', '-p', plugin.pkg, '--manifest-path', join(plugin.dir, 'Cargo.toml')])
    run('node', [join(plugin.dir, 'scripts/pack.mjs'), '--skip-build', '--out', DIST])
  }
}

function buildDesktop() {
  // 前端产物是入库的，先按源码重建一次，避免打包到旧字节
  run(NPM, ['--prefix', 'desktop-tauri/ui-islands', 'run', 'build'])
  run(NPM, ['--prefix', 'desktop-tauri', 'run', 'build'])

  const nsis = join(ROOT, 'target', 'release', 'bundle', 'nsis')
  if (!existsSync(nsis)) throw new Error(`找不到安装包目录：${nsis}`)
  const installers = readdirSync(nsis).filter(name => name.toLowerCase().endsWith('.exe'))
  if (!installers.length) throw new Error(`安装包目录里没有 exe：${nsis}`)
  for (const name of installers) cpSync(join(nsis, name), join(DIST, name))
}

function writeReadme() {
  const conf = JSON.parse(readFileSync(join(ROOT, 'desktop-tauri/src-tauri/tauri.conf.json'), 'utf8'))
  const files = readdirSync(DIST)
  const installer = files.find(name => name.toLowerCase().endsWith('.exe'))
  const packs = files.filter(name => name.toLowerCase().endsWith('.zip'))
  const lines = [
    `# A2A Gateway ${conf.version} 分发目录`,
    '',
    '## 文件',
    ...(installer ? [`- ${installer} —— 主程序安装包（未签名）`] : []),
    ...packs.map(name => `- ${name} —— 插件包，用界面「插件 → 从文件安装…」选中它`),
    '',
    '## 安装',
    '1. 双击安装包。SmartScreen 提示「未知发布者」时选「更多信息 → 仍要运行」。',
    '2. 打开「插件」页 →「从文件安装…」→ 选中插件 zip。',
    '3. 确认插件显示「运行中 · 已加载 N 家」。',
    '',
    '安装包不捆绑插件，必须手动安装；本仓库的插件只支持从文件安装，不做联网检查更新。',
    '',
  ]
  writeFileSync(join(DIST, 'README-安装说明.txt'), lines.join('\n'), 'utf8')
}

function main() {
  if (args.has('--help') || args.has('-h')) {
    console.log([
      '用法：',
      '  npm run dist                            插件 + 桌面端，产物进 dist/',
      '  node build/make-dist.mjs --skip-tauri   只编插件（调试用）',
      '  node build/make-dist.mjs --skip-plugins 只编桌面端',
    ].join('\n'))
    return
  }

  rmSync(DIST, { recursive: true, force: true })
  mkdirSync(DIST, { recursive: true })

  if (!skipPlugins) buildPlugins()
  if (!skipTauri) buildDesktop()

  writeReadme()
  console.log(`\n[dist] 完成，产物在：${DIST}`)
  for (const name of readdirSync(DIST)) console.log(`  ${name}`)
}

main()
