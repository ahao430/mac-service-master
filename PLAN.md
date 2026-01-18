这份 `plan.md` 旨在指导你从零开始构建一个美观、实用的 macOS 服务管理工具。

---

# 🚀 macOS 服务管家 (Service Master) 开发计划书

## 1. 项目定位

一款基于 **Tauri** 的 macOS `launchd` 图形化管理工具，旨在替代界面简陋的 LaunchControl。它不仅管理启动脚本，更侧重于**开发者本地服务**（如 `cliproxy`, `new api`）的状态监控、日志追踪和可视化配置。

---

## 2. 核心功能模块

### A. 服务管理 (Core)

* **服务列表：** 扫描 `~/Library/LaunchAgents` 下的 `.plist` 文件。
* **CRUD 操作：** 支持新建、编辑、删除服务。
* **开关控制：** 调用 `launchctl` 实现服务的 `Load/Unload` (Start/Stop)。
* **一键重启：** 快速重载配置并重启进程。

### B. 增强监控 (Advanced)

* **双重状态：** 进程级状态 (PID) + 端口连通性检查 (TCP Check)。
* **日志监听：** 实时读取 `StandardOutPath` 记录的日志。
* **健康检查：** 配置自定义 Health Check URL（如 `http://127.0.0.1:8317/management`）。

### C. 个性化展示 (UI/UX)

* **元数据存储：** 为每个服务关联自定义图标 (SF Symbols/图片)、别名和详细描述。
* **菜单栏 (Tray)：** 顶部状态栏常驻，支持一键切换服务状态。

---

## 3. 技术栈建议

* **前端:** React/Vue 3 + Tailwind CSS (用于极速构建美观界面)。
* **后端:** Rust (Tauri) + `plist` crate (XML 处理) + `tokio` (异步端口检查)。
* **样式:** 开启 Tauri 的 `vibrancy` 特性，实现 macOS 原生毛玻璃效果。

---

## 4. 开发分阶段路线图

### 第一阶段：基础设施 (MVP)

* [ ] 初始化 Tauri 项目，配置 macOS 窗口美化（透明度、隐藏标题栏）。
* [ ] **Rust:** 实现读取指定目录 plist 的函数，并转换为 JSON 返回前端。
* [ ] **Rust:** 封装 `launchctl load/unload` 命令。
* [ ] **前端:** 简单的服务卡片列表，展示 Label 和基本开关。

### 第二阶段：业务增强 (Developer Friendly)

* [ ] **Rust:** 实现 `check_port` 函数。
* [ ] **Rust:** 实现 `get_logs` 函数（读取文件末尾 100 行）。
* [ ] **前端:** 实现“新建服务”弹窗，包含路径选择、工作目录自动填充。
* [ ] **存储:** 建立 `metadata.json` 存储别名、描述和图标配置。

### 第三阶段：UI/UX 精修

* [ ] **图标系统:** 集成图标选择器（支持 SF Symbols 图标库）。
* [ ] **交互:** 为卡片添加运行状态的呼吸灯动画。
* [ ] **日志面板:** 增加一个滑出的抽屉组件，支持实时查看服务输出。
* [ ] **菜单栏:** 实现 System Tray 逻辑。

---

## 5. 数据结构设计 (Reference)

### Metadata 索引文件 (`services.json`)

```json
{
  "com.user.cliproxy": {
    "displayName": "CLI 代理中转",
    "description": "处理 8317 端口的 API 转发，用于突破本地开发限制",
    "icon": "bolt.fill",
    "iconType": "sfsymbol",
    "port": 8317,
    "healthUrl": "http://127.0.0.1:8317/management"
  }
}

```

---

## 6. UI 组件示例 (Tailwind CSS)

你可以参考这个简单的卡片结构来起步：

```html
<div class="bg-white/80 backdrop-blur-md rounded-xl p-4 shadow-sm border border-gray-200 flex items-center gap-4">
  <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
    <Icon name="bolt.fill" size="24" />
  </div>
  
  <div class="flex-1">
    <h3 class="font-bold text-gray-800">CLI 代理中转</h3>
    <p class="text-xs text-gray-500 line-clamp-1">处理 8317 端口的流量转发...</p>
    <div class="mt-1 flex items-center gap-2">
      <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
      <span class="text-[10px] text-gray-400 font-mono">PID: 45012 | Port: 8317</span>
    </div>
  </div>
  
  <div class="flex gap-2">
    <button class="p-2 hover:bg-gray-100 rounded-full">重启图标</button>
    <button class="p-2 hover:bg-gray-100 rounded-full text-red-500">开关图标</button>
  </div>
</div>

```

---

## 7. 后续扩展想法

1. **自动休眠:** 监测 CPU 占用，如果服务长时间闲置则自动提示关闭。
2. **配置一键导出:** 方便在多台 Mac 之间同步你的开发环境。

---

**你想现在就开始针对第一阶段的“读取 plist”功能编写具体的 Rust 代码吗？**
