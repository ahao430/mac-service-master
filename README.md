# Service Master

一款基于 Tauri v2 开发的跨平台本地服务管理工具，旨在为开发者提供美观且高效的本地服务（如 macOS launchd, Linux systemd, Windows services）图形化管理界面。

## 核心功能

- **🚀 服务管理**：可视化管理本地开发服务，支持启动、停止、重启及状态检测。
- **🌐 跨平台支持**：支持 macOS (launchd)、Windows (计划任务/服务预留) 及 Linux (systemd)。
- **☁️ WebDAV 同步**：支持将服务配置、图标、元数据同步至 WebDAV（如坚果云），方便多机同步。
- **📦 预设模板**：内置常用服务模板（如 CLIProxy），支持快速创建。
- **📊 实时日志**：集成服务日志查看器，支持实时滚动及清空日志。
- **🔍 健康检查**：自动检测服务端口占用及 HTTP 健康状态。
- **🎨 高度自定义**：支持主题色、窗口透明度及亮/暗色模式切换。

## 技术栈

- **Frontend**: React + TypeScript + Vite + dnd-kit (拖拽排序)
- **Backend**: Rust + Tauri v2
- **Plugins**: Updater, Dialog, FileSystem, Opener

## 开发与构建

### 准备工作

确保已安装 [Rust](https://www.rust-lang.org/) 和 [Node.js](https://nodejs.org/)。

### 安装依赖

```bash
npm install
```

### 调试运行

```bash
npm run tauri dev
```

### 构建打包

```bash
npm run tauri build
```

## 备份与同步说明

本应用支持 WebDAV 同步。对于**坚果云**用户：
1. 服务器地址建议使用：`https://dav.jianguoyun.com/dav/service-master/`
2. 应用会自动尝试创建 `service-master` 目录。
3. 如果同步失败，请确保已在坚果云后台开启 WebDAV 服务并创建了对应的应用密码。

## 开源协议

MIT
