# 音频配置与权利说明

## 开源边界

仓库只公开程序、原创界面资源与目录元数据，不分发第三方音频，不提供第三方素材下载链接。录音、配音、背景音乐及相关名称、台词等权利归各自权利人所有；MIT 代码许可不覆盖这些第三方内容。目录中的游戏名仅用于说明既有素材来源。

克隆仓库可以浏览目录、使用搜索与筛选；缺少音频时无法试听。请自行准备有权使用的素材，并确认授权覆盖你的使用或发布场景。

## 本地接入现有目录

`miniprogram/utils/shushan.js` 中的 `sounds[].variants[]` 描述每个版本的：

- `file`：小程序根目录下的路径，例如 `/packs/<包名>/audio/<文件名>.m4a`。
- `pack`：对应 `app.json` 和 `utils/load-pack.js` 中的分包名称。
- `sha256`、`bytes`：用于本地完整性验证的文件摘要和大小。
- `sourcePath`、`sourceSha256`：原始来源标识；不是下载地址。

只有在有权使用与现有目录一致的文件时，才将它们放到这些路径。Web 会读取相同的小程序目录。音频目录已被 `.gitignore` 排除，不要用 `git add -f` 强行加入。

若使用自己的声音，需同时更新目录元数据、分包配置、加载入口，以及依赖现有目录数量的测试。当前导入器针对特定素材清单结构，不是通用文件夹扫描器。

## 可选：本地重新导入

`scripts/import-shushan.py` 仅在 macOS 上使用系统 `afconvert` 转码，不上传素材。输入目录需包含 UTF-8 BOM 兼容的 `音频清单.csv`，字段包括：

```text
分类,文件路径,原始资源名称,SHA256,字节数,时长秒
```

路径相对于输入目录，SHA-256 必须对应原文件。现有分类约定见导入器。请只对可信的本地清单运行导入。

```sh
python3 scripts/import-shushan.py '/你的已授权素材目录'
```

输出位于 `.import-stage/`，导入报告位于 `data/`，两者都被 Git 忽略。导入完成后，在本地备份后将生成的 `packs/` 复制到 `miniprogram/packs/`，将 `load-pack.js`、`shushan.js` 复制到 `miniprogram/utils/`，并按报告更新 `miniprogram/app.json` 的 `subPackages`。不要提交生成的音频。

可选的 `scripts/transcribe-shushan.py` 使用 Apple Silicon / MLX 环境及 `mlx-audio`、`mlx` 与 Qwen3-ASR 模型，本地转录结果默认写入 `data/`。首次运行可能下载模型，不是运行小程序或 Web 的必要步骤。转录文字仅用于检索参考。

## 发布前检查

`npm run check:public` 检查 Git 暂存区中的文件名和音频容器签名，阻止常见音频、媒体、归档、音频目录及私人配置被发布。它不会读取或上传未暂存的本地音频，也不能替代对新增文件的人工检查。

`npm test` 始终执行目录和交互测试；当全部录音文件缺失时，仅跳过录音文件检查。部分录音缺失会报错。`npm run test:audio` 要求所有录音存在，并校验其摘要和文件大小。
