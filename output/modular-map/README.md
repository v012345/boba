# 可重复拼接地图

这版沿用 `continuous` 原图的暗色中式冥界画风，重新统一了道路高度、连接处的山雾、岩台与前景。原图保留在原位置，新版单独放在 `assets/resources/images/level-select/maps/continuous/modular/`。

## 使用

- `map_01.png`：起点，放最左端。
- `map_02.png`：石拱桥，中间块，可重复。
- `map_03.png`：吊桥与牌楼，中间块，可重复。
- `map_04.png`：宫殿终点，放最右端。
- `map_full.png`：`1234` 的完整拼接参考图。

规则为 `1[23]*4`：中间可以没有块，也可以任意排列、重复 2 和 3。支持 `14`、`1234`、`124`、`134`、`1224`、`13234`、`1334`、`1324` 等组合。

每块是 **543 × 724 px**。从左向右直接拼接，间距为 0，不重叠、不翻转。所有块使用相同缩放比例：比例为 `s` 时，第 `i` 块的左边界为 `i × 543 × s`，高度为 `724 × s`。道路在接口处约位于从顶部算起 `y=450 px`。Cocos 中使用完整 SpriteFrame，尺寸和锚点统一，保持相邻节点边缘准确相接。

运行时资源路径示例：`images/level-select/maps/continuous/modular/map_02/spriteFrame`。本次只交付地图素材，未修改游戏关卡流程或场景。

## 预览与校验

用浏览器打开同目录的 `preview.html`，可输入编号组合、缩放和打开接缝标线。默认关闭标线。

- `combinations.png`：用户给出的六种组合总览。
- `sequence-*.png`：九种组合的原尺寸成图。
- `seams.png`：九种合法相邻组合的接缝近景。
- `validation.json`：接口像素校验结果。

已校验所有合法接缝 `12/13/14/22/23/24/32/33/34`。每条接缝中心的 48 px 宽区域都复用同一段自然连续的原画；连接处两侧各保留 24 px 完全相同的接口，向每块内部过渡至 72 px。接口取自生成原画内部 `x=470` 处，避开生成图的切分痕迹。道路和背景无需在运行时添加遮挡或过渡块。

## 来源与重新导出

使用内置 **image_gen** 工具参考原画重绘，再用确定性脚本统一接口、切图和输出预览。完整的初始与修正提示词保存在 `prompts.json`，选用的生成原画是 `source-atlas.png`。

在项目根目录用 Windows PowerShell 执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/export-modular-map.ps1
```

该命令只更新新版素材和预览，保留已有新版 `.meta` UUID，不修改原 `continuous/map_01.png` 至 `map_04.png`。若重新生成原画，需继续满足 2172 × 724 px 和相同道路、接口位置约定，并重新做视觉验收。
