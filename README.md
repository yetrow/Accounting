# 记账小本 · 修复版 2.0.0（by codex）

基于你提供的 React 记账项目修复，并补齐 Android 原生容器源码。离线运行，数据保存在本机，不需要联网账号。

## 安装与旧版数据

安装 `Ledger-2.0.0.apk`，应用名称为「记账小本·修复版」。支持 Android 7.0 及以上，建议系统 Android WebView 保持更新。

**不要卸载旧版。** 原压缩包未提供原版签名私钥，因此新版包名为 `com.jizhang.repaired`，可以与 `com.jizhang.app` 旧版并存。新版无法直接读取旧版应用私有数据，也不会自动迁移已有账单。有旧 JSON 备份时可导入。旧版导出失效且没有备份时，需要先另行取回旧版数据，不能通过安装新版解决。不要通过卸载旧版来安装本包。

本包采用新生成的个人发布签名，支持后续使用同一份私钥升级修复版。`signing/` 中含私钥和口令，供你保管和后续打包使用；不要上传到公开仓库或随源码公开分享。`.gitignore` 已忽略此目录。

## 功能入口

- 全屏：默认开启沉浸模式；「记账」右上角数据管理 → 沉浸式全屏，可切回显示状态栏。屏幕边缘滑动可临时显示系统栏。
- 历史账单：记账页向下滚动至「账单流水」，点击「昨天」、日期或「全部」；点每笔右侧铅笔修改金额、分类、日期、备注。统计页「本期流水」也能编辑。
- 切换：记账与占比页保留输入和筛选状态，使用短淡入位移动画，支持系统减少动态效果设置。
- 导出：数据管理 → 导出 JSON → 安卓系统窗口选择保存位置。
- 导入：数据管理 → 导入 JSON → 选择文件 → 检查数量 → 确认覆盖导入。
- 恢复：数据管理 → 恢复导入前数据。保留一份恢复快照，恢复时会与当前数据交换。
- 异常数据：如本机数据损坏，界面会提示并提供「导出原始数据」。该文件是救援材料，不是普通账单备份。有效备份仍可导入；原始异常内容保留在本机快照中。

导入上限为 8 MB；接受旧版 JSON 和修复版 JSON，校验金额、日期、分类、重复 ID 和预算。空备份也会明确预览并要求确认。

## 源码结构

- `src/`：React + TypeScript 前端。
- `android/app/src/main/`：离线 WebView、系统文件读写、全屏和安全区域。
- `scripts/build_apk.py`：实际验证过的 SDK 命令行构建与签名流程，无需 Gradle。
- `android/`：也提供 Android Studio/Gradle 工程文件，Gradle 构建路径未在本环境执行。
- `dist/`：已编译网页，便于直接构建 APK 或部署。
- `tests/`：数据层和移动浏览器操作测试。
- `docs/`：处理计划、验证报告。
- `signing/`：此修复版的私有签名材料。

## Windows / Linux 构建

安装 Node.js 22.18+（建议 24 LTS）、Python 3、JDK 17，以及 Android SDK Platform 35、Build Tools 35.0.0。Windows 可在 Android Studio 的 SDK Manager 中安装 SDK。

```powershell
npm ci
npm test
npm run build
python scripts/build_apk.py --sdk "$env:LOCALAPPDATA\Android\Sdk" --skip-web
```

Linux / WSL：

```bash
npm ci
npm test
npm run build
python scripts/build_apk.py --sdk "$ANDROID_HOME" --skip-web
```

输出：`release/Ledger-2.0.0.apk`。保留原来的 `signing/` 才能覆盖升级修复版；不含原版应用的签名。

本次构建环境仅有 JRE，故使用 Eclipse ECJ 3.38.0（`ECJ_JAR` 环境变量指定）编译，再用 Android Build Tools 的 D8、aapt、zipalign、apksigner 打包。普通 JDK 环境脚本默认使用 javac。

移动浏览器测试（可选，需要 Python 与 Playwright）：

```bash
npm install --no-save playwright
npx playwright install chromium
npm run build
npm run test:mobile
```

可通过 `CHROME_PATH` 指定已安装的 Chromium 可执行文件。测试启动本地 3000 端口；测试数据仅使用浏览器临时上下文。

## 验证边界

前端构建、数据回归测试、移动 Chromium 操作测试以及 APK 编译/签名/资源检查均有执行记录，见 `docs/验证报告.md`。没有连接你的手机，也没有 Android 模拟器；安卓系统文件选择器、沉浸式效果、机型动画帧率仍需在手机验收，不能把浏览器测试当作实机验证。
