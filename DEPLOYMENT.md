# 🚀 发布到 GitHub 和版本管理 - 简化版

由于 Tauri 更新插件的兼容性问题,我们暂时移除了自动下载功能,现在只保留了基础的检查更新功能。

## ✅ 当前可用的功能:

### 1. GitHub Actions 多平台自动构建 (.github/workflows/release.yml)

当推送标签时自动触发构建:
- ✅ macOS ARM64 (Apple Silicon)
- ✅ macOS x86_64 (Intel)
- ✅ Linux x86_64
- ✅ Windows x86_64

### 2. 版本管理

**获取当前版本:**
```bash
git tag v0.2.0
git push origin main --tags
```

### 3. 手动检查更新

应用内目前显示"已是最新版本"。完整的自动更新功能需要等待 Tauri 更新插件的兼容性问题解决。

## 🔄 完整实现更新功能的步骤(待完成)

### 选项1: 使用 Tauri 插件 (推荐)

当插件兼容性问题解决后,按以下步骤操作:

1. 重新添加 `tauri-plugin-updater` 依赖
2. 配置 updater 插件 (已在 `tauri.conf.json` 中配置)
3. 生成密钥对:
   ```bash
   cargo tauri signer generate
   ```
4. 配置 GitHub Secrets (`TAURI_PRIVATE_KEY`, `TAURI_KEY_PASSWORD`)
5. 实现完整的更新检查、下载和安装流程

### 选项2: 手动实现更新

使用 `reqwest` 手动实现 GitHub API 调用:

```rust
#[tauri::command]
async fn check_update() -> Result<Option<String>, String> {
    // 使用 reqwest 查询 GitHub API
    let response = reqwest::get(
        "https://api.github.com/repos/wanghao/mac-service-master/releases/latest"
    ).send().await.map_err(|e| e.to_string())?;

    if response.status().is_success() {
        let json: serde_json::Value = response.json().await.map_err(|e| e.to_string()))?;
        // 解析最新版本号
        if let Some(version) = json.get("tag_name") {
            Ok(version.as_str().map(|s| s.replace("v", "").to_string()))
        } else {
            Ok(None)
        }
    } else {
        Ok(None)
    }
}
```

## 📦 手动发布流程

### 发布新版本:

1. 更新版本号
   ```toml
   [package]
   version = "0.2.0"
   ```

2. 提交代码并打标签:
   ```bash
   git add .
   git commit -m "Release v0.2.0"
   git tag -a v0.2.0
   git push origin main --tags
   ```

3. GitHub Actions 自动构建

4. 在 GitHub 创建 Release:
   - 进入 Releases 页面
   - 找到 draft release
   - 编辑说明
   - 发布

## 📝 当前限制

- ❌ 自动下载更新: 受 tauri-plugin-updater 插件限制
- ✅ 手动检查版本: 可通过 GitHub API 实现
- ✅ 多平台构建: 完全支持

## 🔧 临时解决方案

在设置页面,用户点击"检查更新"时会显示"已是最新版本"。

## 📚 参考

- [Tauri 更新插件文档](https://github.com/tauri-apps/tauri-plugin-updater)
- [GitHub Actions 文档](https://docs.github.com/en/actions)

## 🐛 已知问题

### 编译错误

如果遇到 Rust 编译错误,请检查:
1. 是否正确安装 Rust
2. 是否有版本冲突
3. 依赖是否完整

### GitHub Actions 失败

如果 CI/CD 失败:
1. 检查 GitHub Actions 日志
2. 确认 workflows 文件配置正确
3. 验证 Secrets 配置是否完整
