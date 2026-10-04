# Bill 3.0.0 验证记录

基线：GitHub Ledger 2.0.3，commit `4d33b93`。日期：2026-10-04。

## 已完成

- `npm ci`：成功安装锁定依赖。
- `npm test`：16 项领域/SQLite 测试通过。实际使用 Node 24 `node:sqlite`，不是内存对象假数据库。
- `npm run lint`：通过。
- `npm run build`：TypeScript 与 Vite 生产构建通过。
- `npm run test:mobile`：通过。Chromium 移动视口测试旧 localStorage→IndexedDB 迁移、收支修改/删除、实时预算、账户转账、JSON 导出/导入/恢复、历史、重新打开、4 种屏宽、深色、字体缩放，以及模拟原生桥的迁移恢复文件选择流程。
- 截图人工检查：`docs/screenshots/`。截图展示浏览器实际界面，不是效果图。
- 独立代码审查：发现并修复导出时更新内部版本导致的丢失更新风险、原生恢复页无法选择文件、审计备份递归膨胀、仅有旧恢复点时误建空账本。相关回归测试先失败、修复后通过。
- `git diff --check`：通过。

## 测试覆盖重点

金额精度/上限；支出/收入/转账对余额和预算的区别；日期与外键引用；旧版金额转分；损坏主快照禁止回退旧数据；迁移一次性标记；真实 SQLite 事务回滚；多窗口版本冲突；不可变审计触发器；导入与恢复交换；v1→v2 schema 迁移；导出期间并发写入的一致版本；重复备份导入时去重源历史。

## Android 构建

通过已提交的 Gradle 8.9 Wrapper 实际执行 `testDebugUnitTest assembleRelease assembleDebug`，构建成功。

- Robolectric 原生数据库测试：3 项，0 失败，0 错误。
- 正式包 `app-release.apk`：成功生成并通过 APK Signature Scheme v2 验签。
- 显示名 `Bill`，applicationId `com.jizhang.repaired`，versionName `3.0.0`，versionCode `300`，minSdk 24 / targetSdk 35。
- 签名证书 SHA-256：`87af02e5c0b3de98e2a2e962cc297f4350c3e6e8e90e0e2756f473a3b4611cd9`，与用户附件的原签名证书一致。
- APK SHA-256：`934d71a385ffa4987c164e8de1adc3984ecfe465a872d9c047d5a74b6f763dde`。
- ZIP 字节比对确认 APK 内所有 Web JS/CSS 和 SQL 迁移与最终构建产物一致。
- 签名材料只在构建时读取用户附件中的原私钥，不写入源码或 Git。

本环境下载 JDK / Gradle / SDK 后完成标准构建。曾发现签名配置的局部变量遮蔽 Gradle DSL 方法，已修正后重新执行完整原生测试与正式构建。网络代理设置仅用于本次运行，没有写入项目配置。

## 验证边界

未连接用户手机，也未在 Android 模拟器进行端到端安装/覆盖升级测试。因此不声称已测得启动小于 1 秒、所有机型手势兼容、实机系统选择器/安全区效果或生产运行帧率。浏览器中的原生桥测试只验证能力路由，不能代替真实 SAF 交互。

无云同步、OCR、通知读取、周期任务或应用层数据库加密；这些没有被标为已完成。数据库审计防误改不等于防 root/设备管理员篡改。固定工具链和锁文件尚不等同于跨机器 bit 级相同产物。
