# 记账小本 · Accounting

一款面向个人日常消费的轻量记账应用，支持支出记录、分类统计、月度预算和数据备份。以简洁的移动端界面呈现账单与消费构成，帮助了解每一笔开销。

应用可在浏览器中运行，也可打包为 Android APK。日常记账无需注册或登录，数据保存在本机，Android 版可离线使用。

## 主要功能

- **日常记账**：记录金额、分类、日期和备注，支持补记、编辑与删除历史账单。
- **分类管理与筛选**：自定义消费分类；点击分类可筛选对应流水，并与日期条件组合使用。
- **消费统计**：按日、周、月查看支出总额与分类占比，支持切换历史统计周期。
- **交互式环形图**：图中直接显示分类名称和百分比，长名称自动换行、标签避让；点击标注、扇区或分类卡片即可查看对应账单。
- **月度预算**：设置每月预算，查看已用金额、剩余额度和平均每天预算。
- **数据备份与恢复**：通过 JSON 文件导入、导出账单、分类和预算；导入前预览并校验数据，保留一份导入前快照。
- **移动端适配**：支持不同屏幕宽度、Android 沉浸式全屏和安全区域，页面切换保留输入状态，并适配系统减少动态效果设置。

## 使用方式

### 记录与查看账单

在「记账」页选择分类、输入金额，按需填写日期和备注后保存。下方「账单流水」支持按今天、昨天、指定日期或全部日期查看；点击账单右侧的编辑按钮，可修改历史记录。

选择记账分类时，下方流水会同步筛选。点击「全部分类」可清除流水的分类条件，不影响当前待记账分类。

### 查看消费占比

在「占比」页切换日、周、月及日期范围。点击图中分类标注、扇区或下方分类卡片，页面会定位到相应流水；再次点击同一分类或选择「全部分类」可取消筛选。

顶部总支出和环形图始终展示整个统计周期的数据，流水区单独显示当前筛选结果。切换统计周期或日期范围时，分类筛选会重置。

### 管理数据

通过「记账」页右上角进入数据管理：

- **导出 JSON**：保存当前账单、分类和预算；Android 版通过系统文件选择器指定保存位置。
- **导入 JSON**：选择备份文件、检查预览后确认导入。导入会覆盖当前数据，单个文件上限为 8 MB。
- **恢复导入前数据**：恢复上一份导入前快照；恢复操作会与当前数据交换。
- **沉浸式全屏**：在 Android 版中切换系统栏显示方式。

数据使用浏览器或应用 WebView 的本地存储保存，不提供账号与云端同步。建议定期导出备份；卸载应用或清除应用／浏览器数据前，请先确认备份可用。

## 技术栈

| 部分 | 技术 |
| --- | --- |
| 界面与业务逻辑 | React 19、TypeScript |
| 开发与构建 | Vite 7 |
| 样式与组件 | Tailwind CSS、Radix UI、Lucide |
| 统计图表 | Recharts、自定义标签布局 |
| 数据存储 | localStorage、JSON 备份 |
| Android 容器 | Java、Android WebView、原生文件读写桥接 |
| 测试 | Node.js Test Runner、Playwright |

Android 版将前端构建产物内置于 APK，通过 WebView 加载本地页面，并由 Java 容器提供文件导入导出、全屏及安全区域适配。

## 本地开发

准备 Node.js 22.18+（可使用 Node.js 24），在终端执行：

```bash
git clone https://github.com/yetrow/Accounting.git
cd Accounting
npm ci
npm run dev
```

默认开发地址为 `http://localhost:3000`，以终端输出为准。

```bash
npm test          # 数据层测试
npm run build    # 类型检查与生产构建
npm run preview  # 预览生产构建
```

构建产物位于 `dist/`，该目录由构建命令生成，不随源码提交。

### 移动浏览器测试

安装 Playwright 和 Chromium 后执行：

```bash
npm install --no-save playwright
npx playwright install chromium
npm run build
npm run test:categories
```

完整移动端操作测试还需要 Python 3，建议在 Linux / WSL 中运行：

```bash
npm run test:mobile
```

可通过 `CHROME_PATH` 指定 Chromium 可执行文件。测试覆盖分类筛选、图表标签布局、历史账单编辑及数据导入导出等场景；Android 系统文件选择器与沉浸式效果仍需实机验证。

## Android 打包

当前版本为 **2.0.2**，支持 **Android 7.0 及以上**，应用包名为 `com.jizhang.repaired`。

### 构建环境

除前端依赖外，还需要：

- Python 3
- JDK 17，确保 `java` 和 `javac` 可用
- Android SDK Platform 35
- Android SDK Build Tools 35.0.0

### 签名准备

公开仓库不包含签名私钥。构建脚本要求在项目根目录的 `signing/` 下准备：

| 文件 | 要求 |
| --- | --- |
| `ledger-release.jks` | 包含别名为 `ledger` 的签名密钥 |
| `password.txt` | 签名所需口令，与密钥库及密钥配置匹配 |

已有应用的覆盖升级必须使用原签名材料。独立构建者需自行准备签名密钥；使用不同签名构建的 APK 无法直接覆盖已安装版本。`signing/` 已加入 `.gitignore`，请妥善备份并保持私密。

### 构建命令

先构建前端：

```bash
npm ci
npm run build
```

Windows PowerShell（SDK 位于默认安装目录时）：

```powershell
python scripts/build_apk.py --sdk "$env:LOCALAPPDATA\Android\Sdk" --skip-web
```

Linux / WSL（需先设置 `ANDROID_HOME`）：

```bash
python scripts/build_apk.py --sdk "$ANDROID_HOME" --skip-web
```

脚本使用 Android SDK 命令行工具完成编译、打包、签名和签名校验，无需 Gradle。输出文件为 `release/Ledger-2.0.2.apk`。

仓库同时提供 Android Studio / Gradle 工程；现有构建验证基于上述命令行脚本。

### 安装与升级

2.0.x 版本在包名与签名一致时可覆盖升级，无需卸载。旧包名 `com.jizhang.app` 与当前应用的数据相互独立，需要通过 JSON 备份迁移，安装新版本不会自动读取旧应用数据。迁移完成前请保留旧应用。

## 项目结构

| 路径 | 内容 |
| --- | --- |
| `src/sections/` | 记账、统计、预算、账单编辑与数据管理界面 |
| `src/components/` | 环形图与通用 UI 组件 |
| `src/hooks/` | 账单状态管理与 React Hooks |
| `src/lib/` | 数据校验、持久化、图表格式与原生桥接 |
| `android/` | Android WebView 容器与工程配置 |
| `scripts/build_apk.py` | APK 命令行构建脚本 |
| `tests/` | 数据层与移动浏览器测试 |
| `docs/` | 开发记录与验证报告 |

## 问题反馈

欢迎通过 [GitHub Issues](https://github.com/yetrow/Accounting/issues) 反馈问题或提出建议。反馈时请附上应用版本、设备与系统版本、复现步骤及必要截图，并隐藏个人账单等敏感信息。
