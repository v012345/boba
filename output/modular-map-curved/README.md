# 弯曲主路地图

保留暗色中式冥界画风，将主路改为上下回绕的连续曲线，并去掉白线、车道式标记和规整的亮色路缘线。路面使用带碎石、磨损与自然边缘的古道质感。关卡按钮可沿路分布。起点为 1，终点为 4，2 和 3 可任意排列、重复，也支持直接拼接 14。

## 文件

- 素材目录：`assets/resources/images/level-select/maps/continuous/modular-curved/`。
- `map_01.png` 至 `map_04.png`：四张干净底图，不含按钮，均为 543 × 724 px。
- `map_full.png`：1234 的拼接图。
- `preview.html`：本地交互预览，可输入组合、缩放、隐藏按钮、显示接缝。
- `buttons-1234.png`：离线绘制的按钮排布示意，不是浏览器截图。
- `level-points.json`：每块的示例按钮中心坐标；预览页使用相同数据的 `points.js`。
- `combinations.png`、`sequence-*.png`、`seams.png`：六种组合总览、九种组合成图和全部接缝。
- `validation.json`：全部 9 种接口的像素校验结果。
- `structural-repairs/map_02.png` 至 `map_04.png`：石桥、吊桥和宫殿的 1086 × 1448 重绘原稿；导出时等比例缩小并统一连接边。

原直路版 `continuous/modular/` 和原始图片均保留。本次未接入游戏场景，按钮样式和坐标用于美术排布参考。

## 拼接与按钮坐标

规则是 `1[23]*4`，从左到右排列，同一缩放比例、零间距、无重叠。两端连接道路中心保持约 y=450。所有合法接缝的中央 48 px 区域使用同一段无标线古道接口，取自最终原画 x=519..566；不再从旧版带线道路中取接口。

`level-points.json` 的坐标以单块图片左上角为原点，x 向右、y 向下，按行进顺序排列。1/2/3 各有 5 个示例点，4 有 4 个，建议按钮直径为 54 px。石桥、吊桥和宫殿的点位已按最新的桥面和平台重新调整，可根据实际关卡数调整。

比例为 s 时，第 i 块上的点在整图中的位置为：

```text
screenX = (i * 543 + point.x) * s
screenY = point.y * s
```

若 Cocos 节点锚点为中心、坐标 y 向上，单块内可换算为：

```text
localX = point.x - 543 / 2
localY = 724 / 2 - point.y
```

预览页按拼接后的顺序连续编号。按钮没有画进素材，可自由更换造型、大小和标签。

## 来源与重新导出

使用内置 image_gen 参考原地图重绘；用户截图作为弯曲路线、按钮排布和结构问题参考。初始提示词在 `prompts.json`，去除路面标线的提示词在 `prompts-unmarked.json`，桥梁结构和宫殿细节的提示词在 `prompts-structural-repairs.json`。当前导出以 `source-atlas-unmarked.png` 为基础，再使用 `structural-repairs` 中的三张重绘图替换第 2、3、4 块内部。

石桥修正了右桥台、栏杆和桥面的透视，路面通过两侧栏杆之间；吊桥去掉桥后方的多余土路，让木桥成为两岸之间的唯一道路。宫殿重新绘制台阶、门槛、前平台和建筑细节。早期的 `source-atlas.png` 与 `palace-entry-repair.png` 保留作为制作过程记录。

在项目根目录用 Windows PowerShell 执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/export-modular-map.ps1 -SourceAtlas output/modular-map-curved/source-atlas-unmarked.png -ConnectorCenterX 543 -TileOverridesDirectory output/modular-map-curved/structural-repairs -AssetDirectory assets/resources/images/level-select/maps/continuous/modular-curved -PreviewDirectory output/modular-map-curved
powershell -NoProfile -ExecutionPolicy Bypass -File output/modular-map-curved/render-button-preview.ps1 -Sequence 1234
```

导出复用无标线原画的公共接口，保留已有新版素材的 .meta UUID。三张重绘稿仅进行等比例缩小、公共连接边复用和切图；按钮点位已随桥面位置更新。

本地浏览器自动导航受到 file:// 协议安全限制，未进行浏览器画面验收；已做页面结构与交互逻辑检查，并用离线成图检查按钮排布。
