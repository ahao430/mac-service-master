# 部署指南

本文档说明如何构建和发布 ServiceMaster 应用。

## 前置要求

### GitHub Secrets 配置

在 GitHub 仓库设置中配置以下 Secrets（Settings → Secrets and variables → Actions）：

```
TAURI_PRIVATE_KEY         # Tauri 私钥内容（不是路径，是完整的密钥文件内容）
TAURI_KEY_PASSWORD        # Tauri 密钥密码
```

**重要提示：**
- `TAURI_PRIVATE_KEY` 应该是完整的 PEM 格式私钥内容，包括 `-----BEGIN PRIVATE KEY-----` 和 `-----END PRIVATE KEY-----`
- 不要使用文件路径，直接复制粘贴密钥内容

### 本地开发环境变量（可选）

如果需要在本地构建：

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

### 推荐方式：通过 Tag 触发自动构建 ✅

这是最简单、最推荐的发布方式，GitHub Actions 会自动完成所有构建和发布步骤。

#### 步骤 1：更新版本号

在以下文件中更新版本号：

```bash
# package.json
"version": "0.1.7"

# src-tauri/tauri.conf.json
"version": "0.1.7"
```

#### 步骤 2：更新文档

- 更新 `CHANGELOG.md` 添加版本更新记录
- 更新 `README.md` 如有功能变更
- 添加应用截图到 `docs/images/` 目录

#### 步骤 3：提交更改

```bash
git add -A
git commit -m "Bump version to 0.1.7"
git push origin main
```

#### 步骤 4：创建并推送 Tag

```bash
# 创建带注释的 tag
git tag -a v0.1.7 -m "Release v0.1.7: 应用模式完善与UI优化"

# 推送 tag 到 GitHub
git push origin v0.1.7
```

#### 步骤 5：等待自动构建完成

推送 tag 后，GitHub Actions 会自动：
1. 检测到 tag 推送
2. 在 macOS runner 上构建应用
3. 创建 GitHub Release
4. 上传 DMG 安装包
5. 生成更新说明

**查看构建进度：**
```
https://github.com/ahao430/mac-service-master/actions
```

**预计耗时：** 5-10 分钟

**优点：**
- ✅ 完全自动化，无需手动操作
- ✅ 统一的构建环境
- ✅ 自动创建 Release 和上传文件
- ✅ 支持版本回溯和重建
- ✅ 可配置多个平台同时构建

---

### 备选方式：本地手动构建

仅在特殊情况下使用（如测试构建、本地调试）。

#### 步骤 1-3：同上（更新版本号、文档、提交）

#### 步骤 4：本地构建

```bash
# 清理旧的构建缓存
cd src-tauri
cargo clean
cd ..

# 构建应用
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

#### 步骤 5：手动创建 Release

##### 使用 GitHub CLI

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

##### 通过 GitHub 网页

1. 访问 https://github.com/ahao430/mac-service-master/releases/new
2. 填写 Release 信息
3. 手动上传 DMG 文件
4. 点击 "Publish release"

---

## 本地开发

### 开发模式

```bash
npm install
npm run tauri dev
```

### 快速构建（不签名）

```bash
npm run build
npm run tauri build -- --no-bundle
```

## 故障排除

### GitHub Actions 构建失败

#### 问题：构建失败并提示签名错误

**解决方案：**
1. 检查 GitHub Secrets 是否正确配置
2. 确认 `TAURI_PRIVATE_KEY` 包含完整的密钥内容（不是路径）
3. 确认 `TAURI_KEY_PASSWORD` 正确

#### 问题：构建超时

**解决方案：**
- GitHub Actions 有超时限制（默认 6 小时）
- 正常构建应该在 10-15 分钟内完成
- 如果超时，检查是否有死循环或网络问题

### 本地构建失败

```bash
# 清理所有缓存
rm -rf node_modules
rm -rf src-tauri/target
rm -rf dist

# 重新安装依赖
npm install

# 重新构建
npm run tauri build
```

### 签名问题

**测试私钥是否有效：**
```bash
# 如果使用文件路径
openssl rsa -in $TAURI_PRIVATE_KEY -check -noout

# 检查密钥格式
cat $TAURI_PRIVATE_KEY | head -1
# 应该显示: -----BEGIN PRIVATE KEY-----
```

### "文件已损坏" 错误

由于应用未经过 Apple 开发者签名，用户首次打开可能会提示"文件已损坏"。提供以下解决方案：

**终端命令（推荐）：**
```bash
sudo xattr -rd com.apple.quarantine /Applications/ServiceMaster.app
```

**系统设置：**
前往 `系统设置` → `隐私与安全性` → `安全性`，点击 **"仍要打开"**。

**右键打开：**
按住 `Control` 键点击应用图标，选择 `打开`。

---

## GitHub Actions 工作流

### 自动构建流程

当推送 tag 时，GitHub Actions 会自动执行：

1. **环境准备**
   - 检出代码
   - 安装 Rust 工具链
   - 安装 Node.js 20
   - 安装 npm 依赖

2. **构建应用**
   - 编译 Rust 代码
   - 打包前端资源
   - 生成 DMG 安装包
   - 使用配置的密钥进行签名

3. **创建 Release**
   - 自动创建 GitHub Release
   - 上传 DMG 文件
   - 生成更新说明

### 工作流配置文件

位置：`.github/workflows/release.yml`

当前支持的平台：
- macOS Apple Silicon (aarch64)

### 自定义工作流

如需添加更多平台或修改构建流程，编辑工作流配置文件：

```yaml
jobs:
  build:
    strategy:
      matrix:
        include:
          - platform: 'macos-aarch64'
            os: macos-latest
            target: aarch64-apple-darwin
          # 添加更多平台...
```

---

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

---

## 版本发布检查清单

### 使用 Tag 自动发布（推荐）

- [ ] 版本号已更新（package.json + tauri.conf.json）
- [ ] CHANGELOG.md 已更新
- [ ] README.md 已更新（如有需要）
- [ ] 应用截图已添加（如有需要）
- [ ] GitHub Secrets 已正确配置
- [ ] 所有更改已提交并推送到 GitHub
- [ ] Tag 已创建并推送
- [ ] GitHub Actions 构建成功
- [ ] Release 已自动创建
- [ ] DMG 文件已上传
- [ ] 验证自动更新功能正常工作

### 本地手动构建（特殊情况）

- [ ] 版本号已更新
- [ ] 文档已更新
- [ ] 本地构建成功
- [ ] 手动创建 GitHub Release
- [ ] 手动上传 DMG 文件

---

## 快速参考

### 创建新版本的完整命令

```bash
# 1. 更新版本号
vim package.json  # 修改版本号
vim src-tauri/tauri.conf.json  # 修改版本号

# 2. 更新文档
vim CHANGELOG.md
vim README.md

# 3. 提交更改
git add -A
git commit -m "Bump version to x.y.z"
git push origin main

# 4. 创建并推送 tag
git tag -a vx.y.z -m "Release vx.y.z: 版本描述"
git push origin vx.y.z

# 5. 等待 GitHub Actions 自动构建完成
# 访问：https://github.com/ahao430/mac-service-master/actions
```

### 常用命令

```bash
# 查看所有 tags
git tag

# 删除本地 tag
git tag -d vx.y.z

# 删除远程 tag
git push origin :refs/tags/vx.y.z

# 查看某个 tag 的详细信息
git show vx.y.z

# 检出某个 tag 的代码
git checkout vx.y.z
```

---

## 相关链接

- **项目仓库**: https://github.com/ahao430/mac-service-master
- **GitHub Actions**: https://github.com/ahao430/mac-service-master/actions
- **Releases**: https://github.com/ahao430/mac-service-master/releases
- **Issues**: https://github.com/ahao430/mac-service-master/issues
