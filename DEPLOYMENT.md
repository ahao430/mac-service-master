# 部署指南

本文档说明如何构建和发布 ServiceMaster 应用。

## 前置要求

### 环境变量配置

确保已配置以下环境变量（用于 Tauri 代码签名）：

```bash
# Tauri 私钥路径
export TAURI_PRIVATE_KEY="/path/to/your/private_key.pem"

# Tauri 密钥密码
export TAURI_KEY_PASSWORD="your_password"
```

### 系统要求

- macOS 10.13 或更高版本
- Node.js 18+
- Rust 1.70+
- Xcode 命令行工具

## 版本发布流程

### 1. 更新版本号

在以下文件中更新版本号：

```bash
# package.json
"version": "0.1.7"

# src-tauri/tauri.conf.json
"version": "0.1.7"
```

### 2. 更新文档

- 更新 `CHANGELOG.md` 添加版本更新记录
- 更新 `README.md` 如有功能变更
- 添加应用截图到 `docs/images/` 目录

### 3. 提交更改

```bash
git add -A
git commit -m "Bump version to 0.1.7"
git push origin main
```

### 4. 构建应用

```bash
# 清理旧的构建缓存
cd src-tauri
cargo clean

# 构建应用
cd ..
npm run tauri build
```

构建过程需要 2-5 分钟，生成的文件位于：

```
src-tauri/target/release/bundle/
├── dmg/
│   └── ServiceMaster_0.1.7_aarch64.dmg   # Apple Silicon 安装包
├── macos/
│   └── ServiceMaster.app                 # macOS 应用程序
└── ...
```

### 5. 创建 GitHub Release

#### 方式一：使用 GitHub CLI（推荐）

```bash
# 安装 GitHub CLI
brew install gh

# 登录
gh auth login

# 创建 Release 并上传 DMG 文件
gh release create v0.1.7 \
  --title "v0.1.7 - 版本描述" \
  --notes "Release notes..." \
  src-tauri/target/release/bundle/dmg/ServiceMaster_0.1.7_aarch64.dmg
```

#### 方式二：通过 GitHub 网页

1. 访问 https://github.com/ahao430/mac-service-master/releases/new
2. 填写以下信息：
   - **Tag version**: `v0.1.7`
   - **Target**: `main`
   - **Release title**: `v0.1.7 - 版本描述`
   - **Description**: 复制 CHANGELOG 中的更新内容
3. 上传构建好的 `.dmg` 文件
4. 点击 "Publish release"

### 6. 验证发布

发布完成后，检查以下内容：

- [ ] Release 页面显示正确的版本号和更新日志
- [ ] `.dmg` 文件成功上传
- [ ] 应用内置的自动更新能检测到新版本

## 开发构建

### 本地开发

```bash
npm install
npm run tauri dev
```

### 生产构建（不签名）

```bash
npm run build
npm run tauri build -- --no-bundle
```

## 故障排除

### 构建失败

如果构建失败，尝试以下步骤：

```bash
# 清理缓存
rm -rf node_modules
rm -rf src-tauri/target
npm install

# 重新构建
npm run tauri build
```

### 签名问题

如果遇到签名相关问题：

1. 检查环境变量是否正确设置
2. 确认私钥文件存在且可访问
3. 验证书密码是否正确

```bash
# 检查环境变量
echo $TAURI_PRIVATE_KEY
echo $TAURI_KEY_PASSWORD

# 测试私钥
openssl rsa -in $TAURI_PRIVATE_KEY -check -noout
```

### "文件已损坏" 错误

由于应用未经过 Apple 开发者签名，用户首次打开可能会提示"文件已损坏"。提供以下解决方案：

1. **终端命令（推荐）**：
   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/ServiceMaster.app
   ```

2. **系统设置**：
   前往 `系统设置` -> `隐私与安全性` -> `安全性`，点击 **"仍要打开"**。

3. **右键打开**：
   按住 `Control` 键点击应用图标，选择 `打开`。

## 自动更新配置

ServiceMaster 使用 Tauri 内置的更新插件。配置位于 `src-tauri/tauri.conf.json`：

```json
{
  "plugins": {
    "updater": {
      "pubkey": "public_key_here",
      "endpoints": [
        "https://github.com/wanghao/mac-service-master/releases/latest/download/latest-release.json"
      ]
    }
  }
}
```

更新机制会自动检查 GitHub Releases 并提示用户更新。

## 发布检查清单

- [ ] 版本号已更新（package.json + tauri.conf.json）
- [ ] CHANGELOG.md 已更新
- [ ] README.md 已更新（如有需要）
- [ ] 应用截图已添加（如有需要）
- [ ] 所有更改已提交并推送到 GitHub
- [ ] 构建成功并生成 .dmg 文件
- [ ] GitHub Release 已创建
- [ ] .dmg 文件已上传到 Release
- [ ] 验证自动更新功能正常工作
