import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save, open as openDialog } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";

interface LaunchAgent {
  label: string;
  program: string | null;
  program_arguments: string[] | null;
  run_at_load: boolean | null;
  keep_alive: boolean | null;
  working_directory: string | null;
  standard_out_path: string | null;
  standard_error_path: string | null;
  environment_variables: Record<string, string> | null;
  file_path: string;
  is_loaded: boolean;
  pid: number | null;
  display_name: string | null;
  description: string | null;
  icon: string | null;
  port: number | null;
  health_url: string | null;
  project_path: string | null;
  app_path: string | null;
  order: number | null;
}

interface ServiceMetadata {
  display_name: string | null;
  description: string | null;
  icon: string | null;
  port: number | null;
  health_url: string | null;
  project_path: string | null;
  app_path: string | null;
  order: number | null;
}

interface AppSettings {
  theme_color: string;
  opacity: number;
  config_path: string | null;
  theme_mode: "light" | "dark" | "auto";
  webdav_url: string | null;
  webdav_username: string | null;
  webdav_password: string | null;
  auto_launch: boolean | null;
}

interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string | null;
  downloaded: boolean;
}

interface ServiceConfig {
  label: string;
  program: string | null;
  program_arguments: string[] | null;
  run_at_load: boolean | null;
  keep_alive: boolean | null;
  working_directory: string | null;
  standard_out_path: string | null;
  standard_error_path: string | null;
  environment_variables: Record<string, string> | null;
}

interface PresetService {
  label: string;
  display_name: string;
  description: string;
  icon: string;
  program: string | null;
  program_arguments: string[] | null;
  working_directory: string | null;
  port: number | null;
  health_url: string | null;
  run_at_load: boolean;
  keep_alive: boolean;
  app_path: string | null; // 新增：应用路径
}

const ICONS: Record<string, React.ReactNode> = {
  terminal: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
  server: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  ),
  globe: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  database: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s 9-1.34 9-3V5" />
    </svg>
  ),
  cpu: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="15" x2="23" y2="15" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="15" x2="4" y2="15" />
    </svg>
  ),
  shield: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  app: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <path d="M9 9h6v6H9z" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
    </svg>
  ),
  github: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  ),
};

// Toast 提示组件
function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: 10000,
        padding: "12px 20px",
        borderRadius: "8px",
        backgroundColor: type === "success" ? "#10b981" : "#ef4444",
        color: "#fff",
        fontSize: "14px",
        fontWeight: 500,
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        animation: "slideInRight 0.3s ease-out",
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <span>{type === "success" ? "✓" : "✗"}</span>
      <span>{message}</span>
    </div>
  );
}

function ServiceModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  editingService,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: ServiceConfig, metadata: ServiceMetadata, filePath?: string) => Promise<void>;
  onDelete: (service: LaunchAgent) => void;
  editingService: LaunchAgent | null;
}) {
  const [label, setLabel] = useState("");
  const [startCommand, setStartCommand] = useState("");
  const [appPath, setAppPath] = useState("");
  const [isAppMode, setIsAppMode] = useState(false); // true: 启动应用, false: 启动命令
  const [runAtLoad, setRunAtLoad] = useState(false);
  const [keepAlive, setKeepAlive] = useState(false);
  const [workingDir, setWorkingDir] = useState("");
  const [stdoutPath, setStdoutPath] = useState("");
  const [stderrPath, setStderrPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [port, setPort] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [icon, setIcon] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [presets, setPresets] = useState<PresetService[]>([]);

  // Load presets when modal opens for new service
  useEffect(() => {
    if (isOpen && !editingService) {
      invoke<PresetService[]>("get_presets").then(setPresets).catch(console.error);
    }
  }, [isOpen, editingService]);

  const applyPreset = (preset: PresetService) => {
    setLabel(preset.label);
    setDisplayName(preset.display_name);
    setDescription(preset.description);
    setIcon(preset.icon);

    // 判断是否为应用模式
    if (preset.app_path) {
      setIsAppMode(true);
      // 移除 /Applications/ 前缀
      const appName = preset.app_path.replace(/^\/Applications\//, '');
      setAppPath(appName);
      setStartCommand("");
    } else {
      setIsAppMode(false);
      setAppPath("");
      // 合并 program 和 program_arguments 为启动命令
      const command = preset.program_arguments?.join(" ") || preset.program || "";
      setStartCommand(command);
    }

    setWorkingDir(preset.working_directory || "");
    setPort(preset.port?.toString() || "");
    setWebUrl(preset.health_url || "");
    setRunAtLoad(preset.run_at_load);
    setKeepAlive(preset.keep_alive);
  };

  useEffect(() => {
    setShowDeleteConfirm(false);
    if (editingService) {
      setLabel(editingService.label);

      // 判断是应用模式还是命令模式
      if (editingService.app_path) {
        setIsAppMode(true);
        // 移除 /Applications/ 前缀显示
        const appName = editingService.app_path.replace(/^\/Applications\//, '');
        setAppPath(appName);
        setStartCommand("");
      } else {
        setIsAppMode(false);
        setAppPath("");
        // 合并 program 和 program_arguments 为启动命令
        const commandParts = [];
        if (editingService.program) commandParts.push(editingService.program);
        if (editingService.program_arguments) commandParts.push(...editingService.program_arguments);
        setStartCommand(commandParts.join(" "));
      }

      setRunAtLoad(editingService.run_at_load || false);
      setKeepAlive(editingService.keep_alive || false);
      setWorkingDir(editingService.working_directory || "");
      setStdoutPath(editingService.standard_out_path || "");
      setStderrPath(editingService.standard_error_path || "");
      setDisplayName(editingService.display_name || "");
      setDescription(editingService.description || "");
      setPort(editingService.port?.toString() || "");
      setWebUrl(editingService.health_url || "");
      setIcon(editingService.icon || "");
      setProjectPath(editingService.project_path || "");
    } else {
      setLabel("");
      setStartCommand("");
      setAppPath("");
      setIsAppMode(false);
      setRunAtLoad(false);
      setKeepAlive(false);
      setWorkingDir("");
      setStdoutPath("");
      setStderrPath("");
      setDisplayName("");
      setDescription("");
      setPort("");
      setWebUrl("");
      setIcon("");
      setProjectPath("");
    }
  }, [editingService, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 应用模式时自动生成 label
    let finalLabel = label.trim();
    if (isAppMode && !editingService) {
      // 新建应用模式服务时，自动生成标识符
      const appName = appPath.trim().replace(/\.app$/i, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      finalLabel = `com.user.${appName}`;
    }

    if (!finalLabel && !isAppMode) return;
    if (!isAppMode && !startCommand.trim()) return;
    if (isAppMode && !appPath.trim()) return;

    setSaving(true);
    try {
      let program = null;
      let programArguments = null;

      if (isAppMode) {
        // 应用模式：使用 open 命令启动应用，添加 /Applications/ 前缀
        program = "open";
        const fullAppPath = `/Applications/${appPath.trim()}`;
        programArguments = ["-a", fullAppPath];
      } else {
        // 命令模式：将启动命令拆分为 program 和 program_arguments
        const commandParts = startCommand.trim().split(/\s+/);
        program = commandParts.length > 0 ? commandParts[0] : null;
        programArguments = commandParts.length > 1 ? commandParts.slice(1) : null;
      }

      const config: ServiceConfig = {
        label: finalLabel,
        program: program,
        program_arguments: programArguments,
        run_at_load: runAtLoad || null,
        keep_alive: keepAlive || null,
        working_directory: workingDir.trim() || null,
        standard_out_path: stdoutPath.trim() || null,
        standard_error_path: stderrPath.trim() || null,
        environment_variables: null,
      };
      const metadata: ServiceMetadata = {
        display_name: displayName.trim() || null,
        description: description.trim() || null,
        icon: icon || null,
        port: port.trim() ? parseInt(port.trim(), 10) : null,
        health_url: webUrl.trim() || null,
        project_path: projectPath.trim() || null,
        app_path: isAppMode ? appPath.trim() || null : null,
        order: editingService?.order ?? null,
      };
      await onSave(config, metadata, editingService?.file_path);
      onClose();
    } catch (e) {
      console.error("Failed to save service:", e);
      alert("保存失败: " + String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--modal-bg)",
          borderRadius: "12px",
          padding: "24px",
          width: "500px",
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
          color: "var(--text-main)",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
            {editingService ? "编辑服务" : "新建服务"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "24px",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: "0",
              lineHeight: "1",
            }}
          >
            ✕
          </button>
        </div>

        {/* Preset Templates - only show when creating new service */}
        {!editingService && presets.length > 0 && (
          <div style={{ marginBottom: "20px", padding: "12px", backgroundColor: "var(--input-bg)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
            <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "10px" }}>
              快速创建 (预设模板)
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--modal-bg)",
                    color: "var(--text-main)",
                    cursor: "pointer",
                    fontSize: "13px",
                    transition: "all 0.2s"
                  }}
                >
                  {ICONS[preset.icon] || ICONS.server}
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 500 }}>{preset.display_name}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{preset.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* 启动方式切换 - 移到最上方 */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "8px" }}>
              启动方式 <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <button
                type="button"
                onClick={() => {
                  setIsAppMode(false);
                  setAppPath(""); // 切换到服务模式时清空 app_path
                  // 切换到服务模式时，如果当前是app图标，改为terminal图标
                  if (icon === "app") {
                    setIcon("terminal");
                  }
                }}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  border: !isAppMode ? "2px solid #3b82f6" : "1px solid var(--border-color)",
                  backgroundColor: !isAppMode ? "rgba(59, 130, 246, 0.1)" : "var(--input-bg)",
                  color: "var(--text-main)",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: !isAppMode ? 600 : 400,
                }}
              >
                💻 启动命令
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAppMode(true);
                  // 切换到应用模式时，自动设置为app图标
                  setIcon("app");
                }}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  border: isAppMode ? "2px solid #3b82f6" : "1px solid var(--border-color)",
                  backgroundColor: isAppMode ? "rgba(59, 130, 246, 0.1)" : "var(--input-bg)",
                  color: "var(--text-main)",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: isAppMode ? 600 : 400,
                }}
              >
                📱 启动应用
              </button>
            </div>
          </div>

          {/* 标识符 - 只在命令模式显示 */}
          {!isAppMode && (
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px" }}>
                标识符 <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text" value={label} onChange={(e) => setLabel(e.target.value)}
                disabled={!!editingService} placeholder="com.company.service"
                style={{
                  width: "100%", padding: "10px 12px", fontSize: "14px", border: "1px solid var(--border-color)",
                  borderRadius: "8px", outline: "none", boxSizing: "border-box",
                  backgroundColor: editingService ? "var(--border-color)" : "var(--input-bg)",
                  color: "var(--text-main)"
                }}
              />
            </div>
          )}

          {/* 启动命令或应用输入框 */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px" }}>
              {isAppMode ? "应用名称" : "启动命令"} <span style={{ color: "#ef4444" }}>*</span>
            </label>
            {isAppMode ? (
              <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border-color)", borderRadius: "8px", overflow: "hidden" }}>
                <span style={{ padding: "10px 12px", backgroundColor: "var(--border-color)", color: "var(--text-secondary)", fontSize: "14px", whiteSpace: "nowrap" }}>
                  /Applications/
                </span>
                <input
                  type="text"
                  value={appPath}
                  onChange={(e) => setAppPath(e.target.value)}
                  placeholder="应用名.app（如：Google Chrome.app）"
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    fontSize: "14px",
                    border: "none",
                    outline: "none",
                    backgroundColor: "var(--input-bg)",
                    color: "var(--text-main)"
                  }}
                />
              </div>
            ) : (
              <input
                type="text"
                value={startCommand}
                onChange={(e) => setStartCommand(e.target.value)}
                placeholder="open-webui serve 或 /usr/local/bin/myapp --port 8080"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: "14px",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  outline: "none",
                  boxSizing: "border-box",
                  backgroundColor: "var(--input-bg)",
                  color: "var(--text-main)"
                }}
              />
            )}
          </div>

          <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px" }}>
                标准输出日志
              </label>
              <input
                type="text" value={stdoutPath} onChange={(e) => setStdoutPath(e.target.value)}
                placeholder="/tmp/myservice.log"
                style={{
                  width: "100%", padding: "10px 12px", fontSize: "14px", border: "1px solid var(--border-color)",
                  borderRadius: "8px", outline: "none", boxSizing: "border-box", backgroundColor: "var(--input-bg)", color: "var(--text-main)"
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px" }}>
                错误输出日志
              </label>
              <input
                type="text" value={stderrPath} onChange={(e) => setStderrPath(e.target.value)}
                placeholder="/tmp/myservice.err"
                style={{
                  width: "100%", padding: "10px 12px", fontSize: "14px", border: "1px solid var(--border-color)",
                  borderRadius: "8px", outline: "none", boxSizing: "border-box", backgroundColor: "var(--input-bg)", color: "var(--text-main)"
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px" }}>
              工作目录
            </label>
            <input
              type="text" value={workingDir} onChange={(e) => setWorkingDir(e.target.value)}
              placeholder="/Users/username/workspace/myproject"
              style={{
                width: "100%", padding: "10px 12px", fontSize: "14px", border: "1px solid var(--border-color)",
                borderRadius: "8px", outline: "none", boxSizing: "border-box", backgroundColor: "var(--input-bg)", color: "var(--text-main)"
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "24px", marginBottom: "24px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--text-secondary)", cursor: "pointer" }}>
              <input type="checkbox" checked={runAtLoad} onChange={(e) => setRunAtLoad(e.target.checked)} style={{ width: "16px", height: "16px" }} />
              开机自启动
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--text-secondary)", cursor: "pointer" }}>
              <input type="checkbox" checked={keepAlive} onChange={(e) => setKeepAlive(e.target.checked)} style={{ width: "16px", height: "16px" }} />
              崩溃自动重启
            </label>
          </div>

          {/* Metadata Section */}
          <div style={{ marginBottom: "16px", padding: "16px", backgroundColor: "var(--input-bg)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
            <h4 style={{ margin: "0 0 12px 0", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>
              扩展信息
            </h4>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "6px" }}>图标</label>
              <div style={{ display: "flex", gap: "8px" }}>
                {Object.entries(ICONS).map(([key, svg]) => (
                  <button key={key} type="button" onClick={() => setIcon(key)} style={{
                    width: "36px", height: "36px", borderRadius: "8px", border: icon === key ? "2px solid #3b82f6" : "1px solid var(--border-color)",
                    backgroundColor: icon === key ? "rgba(59, 130, 246, 0.1)" : "transparent",
                    color: icon === key ? "#3b82f6" : "var(--text-secondary)",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
                  }}>{svg}</button>
                ))}
              </div>
            </div>
            {/* Display Name & Port */}
            <div style={{ display: "flex", gap: "16px", marginBottom: "12px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "13px", marginBottom: "6px" }}>显示名称</label>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "var(--modal-bg)", color: "var(--text-main)" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "13px", marginBottom: "6px" }}>端口</label>
                <input type="number" value={port} onChange={(e) => setPort(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "var(--modal-bg)", color: "var(--text-main)" }} />
              </div>
            </div>
            {/* Description */}
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "6px" }}>描述</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="服务描述..." style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "var(--modal-bg)", color: "var(--text-main)" }} />
            </div>
            {/* Web URL with icon */}
            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "13px", fontWeight: 500, marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                {ICONS.globe}
                Web 地址
              </label>
              <input type="text" value={webUrl} onChange={(e) => setWebUrl(e.target.value)} placeholder="http://127.0.0.1:8080" style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "var(--modal-bg)", color: "var(--text-main)" }} />
            </div>
            {/* Project Path with GitHub icon */}
            <div style={{ marginBottom: "0" }}>
              <label style={{ fontSize: "13px", fontWeight: 500, marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                {ICONS.github}
                项目地址
              </label>
              <input type="text" value={projectPath} onChange={(e) => setProjectPath(e.target.value)} placeholder="/Users/username/workspace/myproject" style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "var(--modal-bg)", color: "var(--text-main)" }} />
            </div>
          </div>

          {/* Bottom Buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px" }}>
            {editingService ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {showDeleteConfirm ? (
                  <>
                    <span style={{ fontSize: "12px", color: "#ef4444" }}>确定删除？</span>
                    <button type="button" onClick={() => { onDelete(editingService); onClose(); }} style={{ padding: "6px 12px", backgroundColor: "#ef4444", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>确定</button>
                    <button type="button" onClick={() => setShowDeleteConfirm(false)} style={{ padding: "6px 12px", backgroundColor: "var(--modal-bg)", color: "var(--text-main)", border: "1px solid var(--border-color)", borderRadius: "6px", cursor: "pointer" }}>取消</button>
                  </>
                ) : (
                  <button type="button" onClick={() => setShowDeleteConfirm(true)} style={{ padding: "8px 16px", backgroundColor: "transparent", color: "#ef4444", border: "1px solid #ef4444", borderRadius: "8px", cursor: "pointer" }}>删除配置</button>
                )}
              </div>
            ) : <div />}
            <div style={{ display: "flex", gap: "12px" }}>
              <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "var(--modal-bg)", color: "var(--text-main)", cursor: "pointer" }}>取消</button>
              <button type="submit" disabled={saving} style={{ padding: "8px 16px", borderRadius: "8px", border: "none", backgroundColor: saving ? "#9ca3af" : "#3b82f6", color: "#fff", cursor: "pointer" }}>{saving ? "保存中..." : "保存"}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function LogPanel({ isOpen, onClose, service }: { isOpen: boolean; onClose: () => void; service: LaunchAgent | null }) {
  const [logs, setLogs] = useState<string[]>([]);
  const [autoRefresh] = useState(true);

  const fetchLogs = async () => {
    if (!service?.standard_out_path) return;
    try {
      const result = await invoke<string[]>("get_service_logs", { logPath: service.standard_out_path, lines: 100 });
      setLogs(result);
    } catch (e) { setLogs([`Error: ${e}`]); }
  };

  const handleClearLogs = async () => {
    if (!service?.standard_out_path) return;
    try { await invoke("clear_service_logs", { logPath: service.standard_out_path }); setLogs([]); } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (isOpen && service) fetchLogs();
    else setLogs([]);
  }, [isOpen, service]);

  useEffect(() => {
    if (!isOpen || !autoRefresh || !service) return;
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [isOpen, autoRefresh, service]);

  if (!isOpen) return null;

  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "500px", backgroundColor: "var(--modal-bg)", boxShadow: "-4px 0 20px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", zIndex: 1000, color: "var(--text-main)" }}>
      <div style={{ padding: "16px", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: "14px" }}>日志: {service?.display_name || service?.label}</h3>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={handleClearLogs} style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid var(--border-color)", backgroundColor: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}>清空</button>
          <button onClick={onClose} style={{ padding: "4px 8px", borderRadius: "4px", border: "none", backgroundColor: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}>✕</button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", fontFamily: "monospace", fontSize: "12px", whiteSpace: "pre-wrap" }}>
        {logs.map((line, i) => <div key={i}>{line}</div>)}
      </div>
    </div>
  );
}

function SettingsModal({ isOpen, onClose, onExport, onImport, settings, onSaveSettings, onRefreshServices }: { isOpen: boolean; onClose: () => void; onExport: () => void; onImport: () => void; settings: AppSettings; onSaveSettings: (settings: AppSettings) => void; onRefreshServices: () => void; }) {
  const [themeColor, setThemeColor] = useState(settings?.theme_color || "#3b82f6");
  const [opacity, setOpacity] = useState(settings?.opacity || 0.8);
  const [configPath, setConfigPath] = useState(settings?.config_path || "");
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "auto">(settings?.theme_mode || "auto");
  const [webdavUrl, setWebdavUrl] = useState(settings?.webdav_url || "");
  const [webdavUsername, setWebdavUsername] = useState(settings?.webdav_username || "");
  const [webdavPassword, setWebdavPassword] = useState(settings?.webdav_password || "");
  const [autoLaunch, setAutoLaunch] = useState(settings?.auto_launch || false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [webdavTesting, setWebdavTesting] = useState(false);
  const [webdavTestResult, setWebdavTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [webdavSyncing, setWebdavSyncing] = useState(false);

  useEffect(() => {
    if (isOpen && settings) {
      setThemeColor(settings.theme_color);
      setOpacity(settings.opacity);
      setConfigPath(settings.config_path || "");
      setThemeMode(settings.theme_mode || "auto");
      setWebdavUrl(settings.webdav_url || "");
      setWebdavUsername(settings.webdav_username || "");
      setWebdavPassword(settings.webdav_password || "");
      setAutoLaunch(settings.auto_launch || false);
    }
  }, [isOpen, settings]);

  const handleTestWebdav = async () => {
    if (!webdavUrl || !webdavUsername || !webdavPassword) {
      setWebdavTestResult({ success: false, message: "请填写完整的 WebDAV 信息" });
      return;
    }
    setWebdavTesting(true);
    setWebdavTestResult(null);
    try {
      const result = await invoke<string>("test_webdav_connection", {
        url: webdavUrl,
        username: webdavUsername,
        password: webdavPassword
      });
      setWebdavTestResult({ success: true, message: result });
    } catch (e) {
      setWebdavTestResult({ success: false, message: String(e) });
    } finally {
      setWebdavTesting(false);
    }
  };

  const handleSyncToWebdav = async () => {
    if (!webdavUrl || !webdavUsername || !webdavPassword) {
      alert("请先配置 WebDAV 信息并保存设置");
      return;
    }
    setWebdavSyncing(true);
    try {
      const result = await invoke<string>("sync_to_webdav", {
        url: webdavUrl,
        username: webdavUsername,
        password: webdavPassword
      });
      alert(result);
    } catch (e) {
      alert("同步失败: " + String(e));
    } finally {
      setWebdavSyncing(false);
    }
  };

  const handleSyncFromWebdav = async () => {
    if (!webdavUrl || !webdavUsername || !webdavPassword) {
      alert("请先配置 WebDAV 信息并保存设置");
      return;
    }

    const isConfirmed = await confirm("从 WebDAV 同步将覆盖本地配置，确定继续？");
    if (!isConfirmed) return;

    setWebdavSyncing(true);
    try {
      const result = await invoke<string>("sync_from_webdav", {
        url: webdavUrl,
        username: webdavUsername,
        password: webdavPassword
      });
      alert(result);
      onRefreshServices();
    } catch (e) {
      alert("同步失败: " + String(e));
    } finally {
      setWebdavSyncing(false);
    }
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const currentVersion = await invoke<string>("get_app_version");

      // Tauri v2 方式: 使用 plugin:updater|check 命令
      const updateResult = await invoke<{ available: boolean; version: string; body: string; date: string } | null>("plugin:updater|check");

      if (updateResult && updateResult.available) {
        setUpdateInfo({
          available: true,
          currentVersion,
          latestVersion: updateResult.version,
          downloaded: false
        });
      } else {
        setUpdateInfo({
          available: false,
          currentVersion,
          latestVersion: null,
          downloaded: false
        });
      }
    } catch (e) {
      console.error("Failed to check update:", e);
      // 显示错误信息
      alert("检查更新失败: " + (e as string));
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleInstallUpdate = async () => {
    if (!confirm("确定要安装更新吗? 应用将自动重启。")) return;

    setInstallingUpdate(true);
    try {
      // Tauri v2 方式: 使用 plugin:updater|install 命令
      await invoke("plugin:updater|install");
    } catch (e) {
      console.error("Failed to install update:", e);
      alert("更新失败: " + (e as string));
    } finally {
      setInstallingUpdate(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div style={{ backgroundColor: "var(--modal-bg)", borderRadius: "12px", padding: "24px", width: "520px", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", color: "var(--text-main)" }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 20px 0", fontSize: "18px" }}>设置</h2>

        {/* 基本设置 */}
        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>基本设置</h3>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", marginBottom: "6px" }}>配置文件目录</label>
            <input type="text" value={configPath} onChange={(e) => setConfigPath(e.target.value)} placeholder="默认: ~/Library/LaunchAgents" style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "var(--input-bg)", color: "var(--text-main)", fontSize: "14px" }} />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", marginBottom: "6px" }}>主题模式</label>
            <div style={{ display: "flex", gap: "8px" }}>
              {[
                { value: "light" as const, label: "☀️ 亮色", icon: "☀️" },
                { value: "dark" as const, label: "🌙 暗色", icon: "🌙" },
                { value: "auto" as const, label: "🔄 跟随系统", icon: "🔄" }
              ].map((mode) => (
                <button key={mode.value} type="button" onClick={() => setThemeMode(mode.value)} style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "6px",
                  border: themeMode === mode.value ? "2px solid " + themeColor : "1px solid var(--border-color)",
                  backgroundColor: themeMode === mode.value ? themeColor + "20" : "transparent",
                  color: "var(--text-main)",
                  cursor: "pointer",
                  fontSize: "13px",
                  transition: "all 0.2s"
                }}>
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", marginBottom: "6px" }}>主题色</label>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} style={{ width: "60px", height: "40px", padding: "2px", borderRadius: "6px", border: "1px solid var(--border-color)", cursor: "pointer" }} />
              <div style={{ display: "flex", gap: "8px" }}>
                {["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#ef4444"].map((color) => (
                  <button key={color} type="button" onClick={() => setThemeColor(color)} style={{
                    width: "28px", height: "28px", borderRadius: "50%", border: themeColor === color ? "2px solid var(--text-main)" : "2px solid transparent",
                    backgroundColor: color, cursor: "pointer", transition: "transform 0.2s"
                  }} />
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", marginBottom: "6px" }}>窗口透明度 ({Math.round(opacity * 100)}%)</label>
            <input type="range" min="0.3" max="1" step="0.05" value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} style={{ width: "100%", cursor: "pointer" }} />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", cursor: "pointer" }}>
              <input type="checkbox" checked={autoLaunch} onChange={(e) => setAutoLaunch(e.target.checked)} style={{ width: "16px", height: "16px" }} />
              开机自动启动应用
            </label>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", marginLeft: "24px" }}>
              💡 启用后，系统启动时会自动运行 ServiceMaster
            </div>
          </div>
        </div>

        {/* 版本更新 */}
        <div style={{ marginBottom: "24px", padding: "16px", backgroundColor: "var(--input-bg)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
          <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
            🔄 版本更新
          </h3>

          <div style={{ marginBottom: "12px", fontSize: "13px", color: "var(--text-secondary)" }}>
            当前版本: v{updateInfo?.currentVersion || "0.1.0"}
          </div>

          {updateInfo?.available ? (
            <div style={{ marginBottom: "12px", padding: "12px", backgroundColor: themeColor + "15", borderRadius: "6px", border: "1px solid " + themeColor }}>
              <div style={{ fontWeight: 600, marginBottom: "4px", color: themeColor }}>
                🎉 发现新版本 {updateInfo.latestVersion}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                新版本已准备就绪,点击下方按钮安装更新。
              </div>
              <button
                onClick={handleInstallUpdate}
                disabled={installingUpdate}
                style={{
                  marginTop: "8px",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: installingUpdate ? "#9ca3af" : themeColor,
                  color: "#fff",
                  cursor: installingUpdate ? "wait" : "pointer",
                  fontSize: "13px",
                  width: "100%"
                }}
              >
                {installingUpdate ? "安装中..." : "立即更新"}
              </button>
            </div>
          ) : updateInfo?.available === false ? (
            <div style={{ padding: "8px", fontSize: "12px", color: "#10b981", backgroundColor: "#10b98115", borderRadius: "4px", textAlign: "center" }}>
              ✓ 已是最新版本
            </div>
          ) : null}

          <button
            onClick={handleCheckUpdate}
            disabled={checkingUpdate}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              backgroundColor: "transparent",
              color: "var(--text-main)",
              cursor: checkingUpdate ? "wait" : "pointer",
              fontSize: "13px"
            }}
          >
            {checkingUpdate ? "检查中..." : "🔍 检查更新"}
          </button>
        </div>

        {/* WebDAV 设置 */}
        <div style={{ marginBottom: "24px", padding: "16px", backgroundColor: "var(--input-bg)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
          <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
            ☁️ WebDAV 同步
          </h3>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontSize: "13px", marginBottom: "6px" }}>服务器地址</label>
            <input type="text" value={webdavUrl} onChange={(e) => setWebdavUrl(e.target.value)} placeholder="https://dav.example.com/backup" style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "var(--modal-bg)", color: "var(--text-main)", fontSize: "14px" }} />
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontSize: "13px", marginBottom: "6px" }}>用户名</label>
            <input type="text" value={webdavUsername} onChange={(e) => setWebdavUsername(e.target.value)} placeholder="username" style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "var(--modal-bg)", color: "var(--text-main)", fontSize: "14px" }} />
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontSize: "13px", marginBottom: "6px" }}>密码</label>
            <input type="password" value={webdavPassword} onChange={(e) => setWebdavPassword(e.target.value)} placeholder="••••••••" style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "var(--modal-bg)", color: "var(--text-main)", fontSize: "14px" }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button type="button" onClick={handleTestWebdav} disabled={webdavTesting} style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "transparent", color: "var(--text-main)", cursor: webdavTesting ? "wait" : "pointer", fontSize: "13px" }}>
              {webdavTesting ? "测试中..." : "🔗 测试连接"}
            </button>
            {webdavTestResult && (
              <span style={{ fontSize: "12px", color: webdavTestResult.success ? "#10b981" : "#ef4444" }}>
                {webdavTestResult.success ? "✓ " : "✗ "}{webdavTestResult.message}
              </span>
            )}
          </div>
        </div>

        {/* 数据与备份 */}
        <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
          <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
            💾 数据与备份
          </h3>
          <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
            <button onClick={onExport} style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "transparent", color: "var(--text-main)", cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              📤 导出配置
            </button>
            <button onClick={onImport} style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "transparent", color: "var(--text-main)", cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              📥 导入配置
            </button>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button type="button" onClick={handleSyncToWebdav} disabled={webdavSyncing} style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "transparent", color: "var(--text-main)", cursor: webdavSyncing ? "wait" : "pointer", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              {webdavSyncing ? "同步中..." : "☁️ 上传到 WebDAV"}
            </button>
            <button type="button" onClick={handleSyncFromWebdav} disabled={webdavSyncing} style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "transparent", color: "var(--text-main)", cursor: webdavSyncing ? "wait" : "pointer", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              {webdavSyncing ? "同步中..." : "☁️ 从 WebDAV 下载"}
            </button>
          </div>
        </div>

        {/* 底部按钮 */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border-color)" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "transparent", color: "var(--text-main)", cursor: "pointer", fontSize: "13px" }}>取消</button>
          <button onClick={() => {
            onSaveSettings({
              theme_color: themeColor,
              opacity,
              config_path: configPath.trim() || null,
              theme_mode: themeMode,
              webdav_url: webdavUrl.trim() || null,
              webdav_username: webdavUsername.trim() || null,
              webdav_password: webdavPassword || null,
              auto_launch: autoLaunch,
            });
            onClose();
          }} style={{ padding: "8px 16px", borderRadius: "8px", border: "none", backgroundColor: themeColor, color: "#fff", cursor: "pointer", fontSize: "13px" }}>保存</button>
        </div>
      </div>
    </div>
  );
}

function ServiceCard({ service, onToggle, onRestart, onEdit, onViewLogs, settings }: { service: LaunchAgent; onToggle: () => void; onRestart: () => void; onEdit: () => void; onViewLogs: () => void; settings: AppSettings }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: service.label });
  const [portStatus, setPortStatus] = useState<boolean | null>(null);
  const [healthStatus, setHealthStatus] = useState<boolean | null>(null);

  // Check port status
  useEffect(() => {
    if (!service.is_loaded || !service.port) { setPortStatus(null); return; }
    const check = async () => {
      try {
        const isOpen = await invoke<boolean>("check_port", { port: service.port! });
        setPortStatus(isOpen);
      }
      catch { setPortStatus(null); }
    };
    // 延迟首次检查，给服务时间启动端口监听
    const initialTimer = setTimeout(check, 2000);
    const interval = setInterval(check, 5000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [service.is_loaded, service.port]);

  // Check health status
  useEffect(() => {
    if (!service.is_loaded || !service.health_url) { setHealthStatus(null); return; }
    const check = async () => {
      try { setHealthStatus(await invoke<boolean>("check_health", { url: service.health_url! })); }
      catch { setHealthStatus(null); }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [service.is_loaded, service.health_url]);

  // Open service in browser
  const openServicePage = async () => {
    let url = service.health_url;
    if (!url && service.port) {
      url = `http://127.0.0.1:${service.port}`;
    }
    if (url) {
      await invoke("open_url", { url });
    }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1001 : "auto",
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: `rgba(var(--bg-card), ${settings?.opacity ?? 0.8})`,
    borderRadius: "12px", padding: "16px", border: "1px solid var(--border-color)",
    display: "flex", alignItems: "center", gap: "16px", marginBottom: "12px", position: "relative" as const, color: "var(--text-main)"
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div {...attributes} {...listeners} style={{ cursor: "grab", color: "var(--text-muted)" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" /></svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {service.icon && ICONS[service.icon] && (
            <span style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center" }}>
              {ICONS[service.icon]}
            </span>
          )}
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>{service.display_name || service.label.split(".").pop()}</h3>
          {service.is_loaded && (
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: service.pid ? "#22c55e" : "#f59e0b", animation: service.pid ? "pulse 2s infinite" : "none" }} />
          )}
        </div>
        <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>{service.description || service.label}</p>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px", fontSize: "11px", color: "var(--text-muted)" }}>
          {service.pid && <span>PID: {service.pid}</span>}
          {service.port && <span>端口: {service.port} {portStatus === true ? "✓" : portStatus === false ? "✗" : "?"}</span>}
          {service.health_url && <span>页面: {healthStatus === true ? "✓" : healthStatus === false ? "✗" : "?"}</span>}
        </div>
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        {/* Open service page button */}
        {(service.port || service.health_url) && (
          <button onClick={openServicePage} title="打开服务页面" style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>
            {ICONS.globe}
          </button>
        )}
        {/* Open project folder button */}
        {service.project_path && (
          <button onClick={() => invoke("open_url", { url: service.project_path! })} title="打开项目文件夹" style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
          </button>
        )}
        {/* Start/Stop button */}
        <button onClick={onToggle} title={service.is_loaded ? "停止" : "启动"} style={{ background: "transparent", border: "none", color: service.is_loaded ? "#ef4444" : (settings?.theme_color ?? "#3b82f6"), cursor: "pointer" }}>
          {service.is_loaded ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>}
        </button>
        {/* Restart button */}
        <button onClick={onRestart} title="重启" style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
        </button>
        {/* Edit button */}
        <button onClick={onEdit} title="编辑" style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
        </button>
        {/* Logs button */}
        {service.standard_out_path && (
          <button onClick={onViewLogs} title="日志" style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
          </button>
        )}
      </div>
    </div>
  );
}

function App() {
  const [services, setServices] = useState<LaunchAgent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<LaunchAgent | null>(null);
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false);
  const [logService, setLogService] = useState<LaunchAgent | null>(null);
  const [portConflict, setPortConflict] = useState<{ service: LaunchAgent; pid: number } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    theme_color: "#3b82f6",
    opacity: 0.8,
    config_path: null,
    theme_mode: "auto",
    webdav_url: null,
    webdav_username: null,
    webdav_password: null,
    auto_launch: false,
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const safeSettings = {
    theme_color: appSettings?.theme_color || "#3b82f6",
    opacity: appSettings?.opacity ?? 0.8,
    config_path: appSettings?.config_path || null,
    theme_mode: appSettings?.theme_mode || "auto",
    webdav_url: appSettings?.webdav_url || null,
    webdav_username: appSettings?.webdav_username || null,
    webdav_password: appSettings?.webdav_password || null,
    auto_launch: appSettings?.auto_launch || false,
  };

  const fetchServices = async () => {
    setIsRefreshing(true);
    try {
      const result = await invoke<LaunchAgent[]>("get_services");

      // 检测应用模式的服务运行状态
      const servicesWithAppStatus = await Promise.all(
        result.map(async (service) => {
          if (service.app_path) {
            // 应用模式：使用 check_app_running 检测
            let appName = service.app_path;
            // 去掉 .app 后缀作为进程名
            if (appName.toLowerCase().endsWith('.app')) {
              appName = appName.substring(0, appName.length - 4);
            }

            try {
              const isRunning = await invoke<boolean>("check_app_running", { appName });
              return {
                ...service,
                is_loaded: isRunning,
                pid: isRunning ? 1 : null, // 应用模式下不显示具体 PID，只显示运行状态
              };
            } catch (e) {
              console.error(`检测应用 ${appName} 状态失败:`, e);
              return service;
            }
          } else {
            // 服务模式：已经由后端通过 launchctl 检测
            return service;
          }
        })
      );

      setServices(servicesWithAppStatus);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const s = await invoke<AppSettings>("get_app_settings");
      if (s) setAppSettings({
        theme_color: s.theme_color || "#3b82f6",
        opacity: s.opacity || 0.8,
        config_path: s.config_path || null,
        theme_mode: s.theme_mode || "auto",
        webdav_url: s.webdav_url || null,
        webdav_username: s.webdav_username || null,
        webdav_password: s.webdav_password || null,
        auto_launch: s.auto_launch || false,
      });
    } catch (e) { console.error(e); }
  };

  // Apply theme mode
  useEffect(() => {
    const themeMode = appSettings?.theme_mode || "auto";
    if (themeMode === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else if (themeMode === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [appSettings?.theme_mode]);

  useEffect(() => { fetchServices(); fetchSettings(); }, []);

  const handleToggle = async (service: LaunchAgent) => {
    try {
      // 判断是应用模式还是服务模式
      if (service.app_path) {
        // 应用模式：直接打开应用
        if (!service.is_loaded) {
          let appPath = service.app_path;

          // 确保路径以 .app 结尾
          if (!appPath.toLowerCase().endsWith('.app')) {
            appPath = `${appPath}.app`;
          }

          const fullAppPath = `/Applications/${appPath}`;

          try {
            await invoke("open_url", { url: fullAppPath });
            setToast({ message: `应用 ${appPath} 启动成功`, type: "success" });
            // 立即刷新状态以显示停止按钮
            setTimeout(fetchServices, 800);
          } catch (e) {
            console.error("启动应用失败:", e);
            setToast({ message: `启动应用失败: ${String(e)}`, type: "error" });
          }
        } else {
          // 应用模式下停止应用（通过 quit 命令）
          try {
            const appName = service.app_path.replace(/\.app$/i, '');
            await invoke("quit_app", { appName });
            setToast({ message: "应用已停止", type: "success" });
            setTimeout(fetchServices, 800);
          } catch (e) {
            console.error("停止应用失败:", e);
            setToast({ message: `无法停止应用: ${String(e)}`, type: "error" });
          }
        }
      } else {
        // 服务模式：使用 launchctl
        if (service.is_loaded) {
          await invoke("unload_service", { plistPath: service.file_path });
          setToast({ message: "服务已停止", type: "success" });
          fetchServices();
        } else {
          if (service.port) {
            const isOpen = await invoke<boolean>("check_port", { port: service.port });
            if (isOpen) {
              const pid = await invoke<number | null>("get_process_by_port", { port: service.port });
              if (pid) {
                setPortConflict({ service, pid });
                return;
              }
            }
          }
          await invoke("load_service", { plistPath: service.file_path });
          setToast({ message: "服务已启动", type: "success" });
          fetchServices();
        }
      }
    } catch (e) {
      console.error("启动/停止失败:", e);
      setToast({ message: `操作失败: ${String(e)}`, type: "error" });
    }
  };

  const handleRestart = async (service: LaunchAgent) => {
    try {
      // 判断是应用模式还是服务模式
      if (service.app_path) {
        // 应用模式：先关闭再打开
        let appPath = service.app_path;

        // 确保路径以 .app 结尾
        if (!appPath.toLowerCase().endsWith('.app')) {
          appPath = `${appPath}.app`;
        }

        const appName = appPath.replace(/\.app$/i, '');

        try {
          await invoke("quit_app", { appName });
          // 等待应用完全关闭
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
          console.warn("应用可能未在运行:", e);
        }

        // 重新打开应用
        const fullAppPath = `/Applications/${appPath}`;

        try {
          await invoke("open_url", { url: fullAppPath });
          setToast({ message: `应用 ${appPath} 重启成功`, type: "success" });
          setTimeout(fetchServices, 800);
        } catch (e) {
          console.error("重启应用失败:", e);
          setToast({ message: `重启应用失败: ${String(e)}`, type: "error" });
        }
      } else {
        // 服务模式：使用 restart_service
        await invoke("restart_service", { plistPath: service.file_path });
        setToast({ message: "服务重启成功", type: "success" });
        fetchServices();
      }
    } catch (e) {
      console.error("重启失败:", e);
      setToast({ message: `重启失败: ${String(e)}`, type: "error" });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setServices((items) => {
        const oldIdx = items.findIndex(i => i.label === active.id);
        const newIdx = items.findIndex(i => i.label === over.id);
        const next = arrayMove(items, oldIdx, newIdx);
        const orders: Record<string, number> = {};
        next.forEach((item, index) => orders[item.label] = index);
        invoke("update_services_order", { orders }).catch(console.error);
        return next;
      });
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: `rgba(var(--bg-app), ${safeSettings.opacity})`, display: "flex", flexDirection: "column", color: "var(--text-main)" }}>
      <div style={{ flexShrink: 0, padding: "12px 16px", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", backgroundColor: `rgba(var(--bg-card), 0.5)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button onClick={() => invoke("open_url", { url: "https://github.com/ahao430/mac-service-master" })} title="GitHub 仓库" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "6px", borderRadius: "6px", backgroundColor: "var(--border-color)", color: "var(--text-main)", border: "none", cursor: "pointer" }}>
            {ICONS.github}
          </button>
          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            v0.1.9
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button onClick={() => { setEditingService(null); setIsModalOpen(true); }} style={{ padding: "6px 12px", borderRadius: "6px", backgroundColor: safeSettings.theme_color, color: "#fff", border: "none", cursor: "pointer", fontSize: "13px" }}>新建服务</button>
        <button
          onClick={fetchServices}
          disabled={isRefreshing}
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            backgroundColor: "var(--border-color)",
            color: "var(--text-main)",
            border: "none",
            cursor: isRefreshing ? "not-allowed" : "pointer",
            fontSize: "13px",
            opacity: isRefreshing ? 0.6 : 1,
            display: "flex",
            alignItems: "center",
            gap: "4px"
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              transform: isRefreshing ? "rotate(360deg)" : "rotate(0deg)",
              transition: isRefreshing ? "transform 1s linear infinite" : "none",
              animation: isRefreshing ? "spin 1s linear infinite" : "none"
            }}
          >
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {isRefreshing ? "刷新中..." : "刷新"}
        </button>
        <button onClick={() => setIsSettingsOpen(true)} style={{ padding: "6px 12px", borderRadius: "6px", backgroundColor: "var(--border-color)", color: "var(--text-main)", border: "none", cursor: "pointer", fontSize: "20px", fontWeight: "bold" }}>⚙</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
          <SortableContext items={services.map(s => s.label)} strategy={verticalListSortingStrategy}>
            {services.map(s => <ServiceCard key={s.label} service={s} onToggle={() => handleToggle(s)} onRestart={() => handleRestart(s)} onEdit={() => { setEditingService(s); setIsModalOpen(true); }} onViewLogs={() => { setLogService(s); setIsLogPanelOpen(true); }} settings={safeSettings} />)}
          </SortableContext>
        </DndContext>
      </div>

      <ServiceModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={async (c, m, f) => { if (f) await invoke("update_service", { filePath: f, config: c }); else await invoke("create_service", { config: c }); await invoke("save_service_metadata", { label: c.label, metadata: m }); fetchServices(); }} onDelete={(s) => invoke("delete_service", { filePath: s.file_path }).then(fetchServices)} editingService={editingService} />
      <LogPanel isOpen={isLogPanelOpen} onClose={() => setIsLogPanelOpen(false)} service={logService} />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onExport={async () => {
          try {
            const m = await invoke("get_all_metadata_map");
            const path = await save({
              filters: [{ name: 'JSON', extensions: ['json'] }],
              defaultPath: 'backup.json'
            });
            if (path) {
              await writeTextFile(path, JSON.stringify(m, null, 2));
              alert("导出成功");
            }
          } catch (e) {
            console.error(e);
            alert("导出失败: " + e);
          }
        }}
        onImport={async () => {
          try {
            const path = await openDialog({
              filters: [{ name: 'JSON', extensions: ['json'] }],
              multiple: false
            });
            if (path) {
              const content = await readTextFile(path as string);
              const m = JSON.parse(content);
              await invoke("import_metadata", { metadata: m });
              fetchServices();
              alert("导入成功");
            }
          } catch (e) {
            console.error(e);
            alert("导入失败: " + e);
          }
        }}
        settings={safeSettings}
        onSaveSettings={(s) => {
          invoke("save_app_settings", { settings: s })
            .then(() => {
              setAppSettings(s);
              setToast({ message: "设置保存成功", type: "success" });
            })
            .catch((e) => {
              setToast({ message: `保存失败: ${String(e)}`, type: "error" });
            });
        }}
        onRefreshServices={fetchServices}
      />

      {portConflict && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "var(--modal-bg)", borderRadius: "12px", padding: "24px", width: "400px", color: "var(--text-main)" }}>
            <h3>端口被占用: {portConflict.service.port}</h3>
            <p>PID: {portConflict.pid}</p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "20px" }}>
              <button onClick={() => setPortConflict(null)}>取消</button>
              <button onClick={() => invoke("kill_process", { pid: portConflict.pid }).then(() => handleToggle(portConflict.service)).then(() => setPortConflict(null))} style={{ backgroundColor: "#ef4444", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "6px" }}>杀死进程并启动</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default App;
