# Boba：Cocos Creator 关卡原型

面向项目维护者和后续 Codex 会话的现状说明。使用 Cocos Creator 3.8.8，设计分辨率 1280×720，横屏。以当前代码为准；历史文档中旧的「巷口奶茶铺」流程已不适用。

## 启动与当前流程

在 Creator 打开本项目及 `assets/scenes/boot.scene` 并预览。`Main` 初始化 UI 后直接打开选关页面；选中关卡进入关卡页面，可手动返回选关。选关地图采用分段图片，关卡节点及地图段按视口复用；第三关选关图用于验证 Spine。

第一关配置了两位固定顾客、两种容器、茶／奶／珍珠、工作台、垃圾桶和两个暂存槽。取容器后点击材料，拖动容器到顾客可尝试交付，拖到垃圾桶丢弃，也可在工作台和暂存区之间移动。订单按材料种类及数量匹配，不要求加料顺序；顾客离场后目前没有通关判定或结算。其他关卡内容见 `LevelContent.ts`，不能据此推断都具备完整玩法。

## 当前边界与优先事项

- `Levels.ts` 有 300 个选关条目，多数图片和坐标为占位；`LevelContent.ts` 只配置前 5 关，只有第一关配置顾客。未配置的 ID 会回退到第一关内容，尚无关卡解锁或存档。
- `LevelView` 的完成回调已经预留，但当前没有传入通关结果。下一步可先实现第一关的完成判定、结果和返回流程，再决定关卡开放策略。
- 当前关卡流程主要写在 `LevelView`、`Customer` 等 Cocos 组件中，并非旧文档所述的 `TeaGame` 纯规则架构。尚无完整新玩法的引擎内或手机真机验收记录。
- 手机横屏由 `OrientationWatcher` 和旋转提示处理；浏览器方向锁定能力因平台而异，需真机验证。

## 代码与资源

- `assets/game/Main.ts`：入口、选关和方向监听。
- `assets/game/view/LevelSelectView.ts`、`LevelItem.ts`：地图、节点复用与选关。
- `assets/game/view/LevelView.ts`、`view/level/`：关卡加载、交互、顾客、容器和暂存区。
- `assets/game/config/`：选关展示、关卡摆放、订单、材料、顾客、设备和文本配置。资源路径相对 `assets/resources/`。
- `assets/framework/`：事件、状态机、资源、UI、输入、动画与方向监听。
- `assets/resources/prefabs/level/`、`view/` 和 `assets/resources/images/`：运行时加载的 Prefab 和图片；移动资产时保留对应 `.meta`。
- `架构.md`：现状与依赖约定。`docs/shop-composition.md`、`docs/grok-sealer-animation-task.md` 为历史资料，不描述当前流程。

## 验证

Node 22.18 或以上可以直接运行不依赖 Cocos 的测试；执行时可能出现 `MODULE_TYPELESS_PACKAGE_JSON` 提示。

```sh
node tests/framework.test.mjs
node tests/level-config.test.mjs
npx -p typescript@5.9 tsc --noEmit --skipLibCheck -p .
```

框架测试覆盖事件、状态机、动画驱动和纯落点计算；关卡测试检查选关和关卡配置引用、订单材料可用性、资源文件及 meta、现有回退行为。测试不启动 Creator，也不验证 Prefab 内部绑定、渲染、订单交付、拖放手感或完整流程。类型检查依赖 Creator 生成的 `temp/tsconfig.cocos.json`；若缺失，先在 Creator 打开项目生成。修改引擎组件后还需在 Creator 中实际预览，涉及触控时在手机上验收。
