# 封口机 Spine

Spine 3.8.99 Professional 工程。Cocos Creator 3.8.8 使用引擎模块 `spine-3.8`。导出骨架的版本字符串是 `3.8.99`。Creator 的检查接受以 `3.8.` 开头、且不是 `3.8.75` 的数据，也接受这个版本写出的皮肤数组。贴图按透明边裁过，`orig` 仍是 1024，轴心不动。像素已预乘，Skeleton 的 `premultipliedAlpha` 保持打开，和现有垃圾桶一样。导出缩放是 1，一个单位等于源图一个像素。

没有改 `Sealer.prefab`、`SealerView` 或店铺流程。Creator 还没导入这些文件，下次打开项目时会自己生成 `.meta`。

## 文件

- `sealer.spine`：完整机器。打开后直接看到待机。里面有一张带 `PREVIEW` 字样的示意杯，用的是游戏空杯图，只供在 Spine 里看遮挡。
- `sealer-back.spine`、`sealer-front.spine`：同一套时间，拆成后层和前层。
- `images/`：散件副本。没有导入 `clamp_full`，也没有导入全透明的 `clamp_front_00`。
- `assets/resources/spines/sealer/`：给 Cocos 的 `sealer-back` 与 `sealer-front`，各有 `.skel`、`.atlas`、`.png`。

图片路径相对工程，是 `./images/`。

## 动画

30 帧/秒。`idle` 和 `seal` 都是 1.0 秒。`idle` 停在初始姿势，循环也没有动作。`seal` 播完一次后回到这个姿势。

| 帧 | 时间 | 动作 |
| --- | --- | --- |
| 0–5 | 0–0.167 秒 | 前夹爪从无到 `clamp_front_05` |
| 6–10 | 0.200–0.333 秒 | `roll` 与 `film` 同步从 00 到 05，封头仍在上面 |
| 10–15 | 0.333–0.500 秒 | 封头 Y 从 0 到 -104 |
| 15–19 | 0.500–0.633 秒 | 停住热封 |
| 19–24 | 0.633–0.800 秒 | 封头回到 0 |
| 25–29 | 0.833–0.967 秒 | 前夹爪从 05 打开到无 |
| 29–30 | 0.967–1.000 秒 | 膜卷和膜条回到 00，姿势与 `idle` 相同 |

膜卷是换图，不是把整张图转一圈。封头只上下移动。散件说明里的下压终点是 -90。按示意杯口看，-90 时金边还悬在杯口上方，所以终点改成 -104，顺序没变。

## 杯子放在两层中间

Cocos 的 `sp.Skeleton.SpineSocket` 只把骨骼矩阵抄到目标节点。目标必须是骨架的直接子节点，画在整张骨架后面。它不能插进插槽之间。

游戏杯子继续用现在的 `Cup` 节点，不要换成 Spine 里的那张示意杯。杯子放进机器时，场景顺序要是：

1. `SealerBack`：`sealer-back`，皮肤 `default`
2. 现有的杯子
3. `SealerFront`：`sealer-front`，皮肤 `default`

两个骨架的位置、旋转、缩放必须相同。杯子被拖走时要离开这个夹层，画到两层上面。这一步还没写进 `ShopView`。

骨骼 `cup` 在 `(58, -277)`，挂点路径是 `root/cup`。这是夹环内孔中心，内宽约 245 像素。后层和前层都有这根骨骼，但它只标记位置，不画杯子。

## 缩放到当前杯子

当前饮品图显示成 140，进机器后再乘 `cupScale` 0.62。杯口宽约 60.6 屏幕像素。

建议两个骨架用同一个缩放 `0.2475`（60.6 / 245）。这时机器可见范围大约是 168×218，不要拉成现在封口机那个 210×210 的正方形，否则夹环和杯子会变形。

杯口在饮品图案中心上方约 30 像素。杯子中心如果仍停在现有 `CupPoint (0, -46)`，骨架本地坐标大约是 `(-14.3, 52.6)`：

```text
rim = (58, -277) * 0.2475
骨架位置 = CupPoint - rim + (0, 30)
```

夹环到机器脚底只有大约 37 屏幕像素，现在的杯子从杯口往下大约 68 像素，所以杯身会露出脚底一截。这是新图和现有杯子的比例差，没有改 `cupScale`。

## 和封盖计时一起走

`sealDuration` 现在是 1 秒，动画也是 1 秒。用封盖剩余时间算进度，再写入两个骨架的同一条轨道时间：

```text
progress = 1 - cup.remaining / sealDuration
trackTime = progress * 1
```

暂停时 `ShopView` 不再调用 `tick`。轨道时间跟着剩余时间走，动画会一起停。不要让 Skeleton 用自己的时间往前播。封盖结束时两边都改播 `idle`。缓存模式用实时，换图关键帧才不会被烘掉。

## 预览和还没做的验证

`preview/00-idle.png` 到 `04-released.png` 是按上面的帧，用散件叠出来的。杯子是标了 `PREVIEW` 的示意杯，用来看「后半环在杯后、前夹爪和封头在杯前」。

`preview/spine-idle.png`、`spine-clamped.png`、`spine-pressed.png`、`spine-lifted.png`、`spine-released.png` 是 Spine 自己导出的 `seal` 画面，分别对应第 0、5、17、24、29 帧。这组没有画出示意杯。完整 30 帧在 `export/spine-render/`。

还没在 Creator 里加载，也没在游戏里看过暂停、连续封杯，以及真实杯子插在两层之间的遮挡。上面的接法是根据 Creator 3.8.8 的 `sp.Skeleton` 和 `AttachUtil` 得来的，不是游戏内试出来的。
