# 封口机 Spine 散件 v1

30 张独立透明 PNG，全部 1024×1024，同中心对齐；原素材保留，未接入游戏。
内置 image_gen 补绘机身、封头、金属环、膜卷；脚本切分、对齐并生成夹环/送膜帧。提示词在 output/sealer-animation-v1/prompts.json。

## 文件
- body：固定机身，已补完整空腔。
- front_housing：前面板遮挡层，放在封头前，挡住活塞上端。
- spindle_supports：膜卷轴支架遮挡层，放在膜卷前。
- clamp_supports：固定夹环支座。
- press_head：热封头，骨骼上下移动，正常位置 (0,0)，压下位置 (0,-90)，不要旋转。
- roll_00～05：膜卷滚动六帧，循环播放；不要整体旋转图片。
- film_00～05：送膜条六帧，与膜卷同帧播放。
- clamp_full_00～05：完整夹环六帧，从后半环到闭合圆环，用于简易装配。
- clamp_back：固定后半环，放在杯子后面。
- clamp_front_00～05：前方夹爪六帧，放在杯子前面。00 是全透明帧，Spine 中直接用“无附件”表示，不需要导入该空白图。

## 两种夹环装配方式，二选一
1. 简易预览：单插槽切换 clamp_full_00～05。
2. 游戏推荐：clamp_back 固定显示，杯子居中，其前方插槽切换 clamp_front_01～05，张开时隐藏前插槽。不要再叠加 clamp_full。

## 坐标与层次
图片导入后统一位置 (0,0)、缩放 (1,1)、旋转 0。不要自动裁掉透明边后重新居中。
以画布中心为 Spine 原点：杯口/夹环中心约 (58,-277)，可见底部约 y=-428。
绘制顺序从后到前：body → film → roll → spindle_supports → clamp_supports → clamp_back → 游戏杯子 → clamp_front → press_head → front_housing。
若游戏杯子是独立 Cocos 节点，必须另做前后层或使用插槽挂点，不能简单放到整个机器最上方，否则遮挡不正确。

## 建议动画（30fps，总计约1秒）
- 0～5 帧：夹环 00→05；实际表现为弧形夹爪从两侧逐步伸出，闭合成环。
- 5～10 帧：roll、film 的00～05送膜；封头仍在上方。
- 10～15 帧：press_head Y 从0到-90；按实际杯口高度微调终点。
- 15～19 帧：停留热封，膜卷停止。
- 19～24 帧：封头回到 Y=0。
- 24～29 帧：夹环05→00，释放杯子。

卷膜应走带而非整张图平面转圈；夹紧后再压头，抬头后再松夹环。夹环是游戏化伸缩结构，并非实机机械工程图。膜卷六帧是纹理滚动近似，不是3D转轴模拟。

## 预览
output/sealer-animation-v1/assembly-preview.jpg：六档组合检查。
output/sealer-animation-v1/motion-preview.gif：零件运动检查（同时变化以便观察，不是上述正式工序时间线）。

真实机器的送膜/封口/出杯流程参考：https://www.beiliton.com/product/cup-sealing-machine/
