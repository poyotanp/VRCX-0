# VRCX-0

The first commit of this repository corresponds to the upstream VRCX snapshot at the time of forking and is licensed under the MIT License.

All modifications, additions, and new code introduced after the fork are licensed under the GNU General Public License v3.0 (GPLv3).

---

## About

**VRCX-0** is an independent fork of VRCX.

I contributed to VRCX from late 2024 to April 2026, working on a large part of its development, including multiple frontend iterations.

As of April 2026, I am no longer part of the original project.

VRCX-0 continues the work independently, with a new architecture and different development priorities.

---

## Main Changes

VRCX-0 is being rebuilt with **Tauri + React**, replacing the previous CEF-based architecture.

Main goals:

- Lower memory usage
- Smaller application size
- Better performance
- Improved accessibility support
- Full keyboard navigation
- A more maintainable frontend stack

---

## Differences from VRCX

- Rewritten with Tauri + React
- Reduced resource usage
- Different UI and interaction design
- Independent roadmap and development decisions

---

## Platform Support

- **Windows**: supported
- **Linux**: supported in test builds
- **macOS**: supported in test builds

Linux and macOS builds are still being tested and may have platform-specific issues.

---

## VROverlay

VROverlay support is planned.

It will be redesigned instead of directly reusing the old implementation, with a focus on better and more correct use cases.

---

## Quick Start

### Requirements

- **Node.js** LTS recommended
- **Rust** latest stable via rustup

### Run

```bash
git clone https://github.com/Map1en/VRCX-0
cd VRCX-0

npm install
npm run tauri:dev
```

---

## Data Migration

On first run, VRCX-0 automatically migrates existing VRCX database and configuration data.

- Original VRCX data is not modified
- No manual setup is required
- Existing users can start from their current data

---

## Current Status

VRCX-0 is usable and under active development.

Core functionality is available. Some features, platform support, and UI details are still being adjusted.

# VRCX-0

本仓库的第一个提交对应 fork 时的上游 VRCX 项目快照，并遵循 MIT License。

fork 之后新增、修改或重写的代码均遵循 GNU General Public License v3.0（GPLv3）。

---

## 项目说明

**VRCX-0** 是 VRCX 的独立分支项目。

我从 2024 年末开始参与 VRCX 开发，并持续到 2026 年 4 月，期间参与了大量功能开发和多轮前端迭代。

从 2026 年 4 月起，我已不再参与原项目。

VRCX-0 会作为独立项目继续开发，使用新的架构，并按照不同的开发优先级推进。

---

## 主要变化

VRCX-0 正在使用 **Tauri + React** 重构，替代原有的 CEF 架构。

主要目标包括：

- 降低内存占用
- 减小程序体积
- 提升性能
- 改善无障碍支持
- 支持完整键盘操作
- 使用更容易维护的前端技术栈

---

## 与 VRCX 的区别

- 基于 Tauri + React 重写
- 更低资源占用
- 不同的 UI 和交互设计
- 独立的开发路线和决策

---

## 平台支持

- **Windows**：支持
- **Linux**：测试构建支持
- **macOS**：测试构建支持

Linux 和 macOS 版本仍在测试中，可能存在平台相关问题。

---

## VROverlay

VROverlay 以后会支持。

它不会直接沿用旧实现，而是会根据更好、更正确的使用场景重新设计。

---

## 快速开始

### 前置环境

- **Node.js**，建议使用 LTS 版本
- **Rust**，建议通过 rustup 安装最新稳定版

### 运行项目

```bash
git clone https://github.com/Map1en/VRCX-0
cd VRCX-0

npm install
npm run tauri:dev
```

---

## 数据迁移

VRCX-0 首次运行时会自动迁移现有 VRCX 的数据库和配置。

- 不会修改原有 VRCX 数据
- 不需要手动配置
- 可以直接从现有数据开始使用

---

## 当前状态

VRCX-0 已经可以使用，并且仍在持续开发中。

核心功能已经可用，部分功能、平台支持和界面细节还在继续调整。
