# 巷口奶茶铺 · Cocos Creator 3.8.8

暖色手绘风手机横屏奶茶店原型。默认标准店营业 90 秒，目标 ¥150；也可切换小店和高档店。当前各店采用 **一个制作位、一摞共用杯子、拖放封盖与交付**。

## 在 Creator 里试玩

打开 `assets/scenes/boot.scene` 预览即可：主菜单 → 营业 → 结算。`load` 场景只做一件事，就是跳转到 `boot`。

画面都是预制体，在 Creator 里双击就能调整布局、文字和颜色：

- `assets/resources/prefabs/view/Shop.prefab`：店铺入口壳，内嵌标准布局供编辑器预览，运行时加载所选店铺布局。
- `assets/resources/prefabs/shop/layouts/`：`SmallShop`、`StandardShop`、`LargeShop` 三套组合布局。
- `assets/resources/prefabs/shop/` 的其他分类目录：垃圾桶、封盖机、取杯器、制作位、原料、饮品、顾客、环境和特效，可作为独立 Prefab 拖入布局。
- `assets/resources/prefabs/ui/`：主菜单、HUD、暂停、结算、横屏提示。

在 `boot.scene` 的 `Canvas` 节点上，将 `Main` 组件的 `shopId` 设为 `basic`、`standard` 或 `premium`，保存后预览。三者分别提供 2、3、4 个顾客位；小店没有椰果，标准店保留渐进解锁，高档店开店即可制作全部四种饮品。重新营业、返回菜单后再开始会保持所选店铺。详细目录、物件编辑和新增店铺步骤见 [店铺组合指南](docs/shop-composition.md)。

按 1280×720 设计，使用 SHOW_ALL 适配，宽屏可能留边。网页在手机上手动横屏；原生构建在构建面板设置横屏。异形屏安全区和触控手感仍需真机验收。

## 当前操作

1. 客人进店即点单：头顶气泡直接显示配方与价格，同时开始消耗耐心，**不需要点击接单**。气泡上的杯子就是他们要的那杯。
2. 点击桌下杯摞，取出一个空杯移动到唯一制作位。**杯子往桌上滑的 0.45 秒里直接按住也算放好**，会立即结束滑入并开始拖动；当前杯子未交付或丢弃前不能再取杯。
3. 点击桌上材料加料：红茶 → 鲜奶 → 按配方加入珍珠或椰果。
4. **按住杯子，拖到右侧封盖机，松手**。机器封盖 **1 秒**，期间不能拖动或丢弃。空杯、缺鲜奶的杯子不会启动机器。
5. 封好后杯子留在机器里，**从机器里拖出杯子，松手放到客人身上或订单气泡上**，交付匹配奶茶。
6. 想重做时，把空杯、制作中的杯子或已封好的杯子**拖到桌下左侧垃圾桶**。整杯丢弃并重置连击，需要重新从杯摞取杯。

拖动手感：杯子身上带着一块跟着它走的抓取区（250×200，比杯子本身大得多），按压点只要落在杯子附近就算抓住，无需点准玻璃；抓起后杯子会上抬 26px 并放大到 1.08 倍，避免手指压住杯身。抓取的瞬间所有可放置区域会整体描边，指到哪个就高亮哪个（垃圾桶额外换成打开状态）。松手时封盖机与垃圾桶接受 52px 的近似命中，客人必须准确命中，避免错单；没有命中时杯子会在 0.16 秒内缓动飞回原位，而不是瞬移。落点判定以杯子中心（含上抬量）为准，与看到的画面一致。

未封盖或配方错误时保留杯子。配方错误扣客人 5 秒耐心并重置连击。触摸取消、暂停、切后台会取消当前拖动，不触发丢弃或交付。封盖与所有动画在暂停时冻结。

默认标准店第一单为原味；完成 2 单解锁椰果，5 单解锁双拼。各店的可用原料、菜单、解锁和客流在 `assets/game/config/ShopProfiles.ts` 配置，订单只从已解锁且材料齐全的菜单中生成。耐心从进店起算，初始 40 秒，每交付一单递减 0.8 秒（最低 26 秒）——原来「思考 2.5 秒 + 接单」的免费时间已折算进来。连续交付有奖励。营业结束可重新开始。

## 美术与分层

图片都在 `assets/resources/art/`，每张图一个文件，可以直接拖进预制体：

- `shop.png`：店铺背景。
- `cup-shelf.png`：桌下三格柜体；当前只使用中间共用杯摞。未来 S／M／L 的供杯配置位于 `assets/game/logic/TeaGame.ts` 的 `CUP_SUPPLIES`，尚未开启杯型订单、定价和不同尺寸美术。
- `sprites/counter.png`：从背景里裁出的桌面（原图 `(0, 610, 1672, 260)` 这一条），盖在顾客前面。
- `sprites/customer-1.png` … `customer-4.png`：四位客人。
- `sprites/cup-empty.png`、`cup-tea.png`、`cup-milk.png`、`cup-pearl.png`、`cup-jelly.png`、`cup-pearl-jelly.png`：空杯、茶底和四种成品。杯子在桌面、订单和拖动时复用相同美术。
- `sprites/tea-pot.png`、`milk-jug.png`、`pearl-tray.png`、`jelly-tray.png`：四种配料。
- `sprites/cup-stack.png`、`lid.png`：杯摞、封口膜。
- `sprites/sealer-idle.png`、`sealer-working.png`：封盖机待机与工作。
- `assets/resources/spines/bin/`：垃圾桶的 Spine 动画（open、close、bounce）。

`sprites/` 里的图是从原来的 2×2 图集按格子原样裁出来的，原图集已删除。素材由内置 image_gen 生成，提示词和来源保存在 `ART-PROMPTS.json`、`ART-PROMPTS-V2.json`、`ART-PROMPTS-V3.json`（里面提到的图集文件名是裁切前的）。没有采用的带背景试稿未接入项目。卡片底、进度条、拖放提示框用 `RoundRect` 组件绘制，不需要图片；「先加小料后加奶」的临时配料叠加仍由代码绘制。

`ShopThemes.ts` 当前提供原色、暖色、青玉三种染色主题，作用于现有背景、柜台和顾客提示色。本次拆分保留美术与 Spine 的原路径，没有新增整套装修美术。

## 发布为 web-mobile（横屏）

**先说结论：网页没法强制横屏。** 浏览器不给页面锁屏方向，iOS Safari 连 `screen.orientation.lock()` 都没有。所以这里用的是「竖屏拦截 + 能锁就锁」两层：

1. **引擎内守卫（已内置，任何浏览器都生效）**：`framework/platform/Orientation.ts` 监听窗口变化并每 0.4 秒读一次视口尺寸（web 用 `window.innerWidth/innerHeight`，原生退回 `screen.windowSize`），宽高比变成竖屏就由 `game/Main.ts` 弹出“请把手机横过来”的全屏卡（`RotateHint.prefab`）并调用 `director.pause()`，**计时和动画一起冻结**，按钮仍可点；转回横屏自动恢复并接着营业。卡片上的「全屏并锁定横屏」按钮会先 `requestFullscreen()`，成功后再调 `screen.orientation.lock('landscape')`——Android Chrome 有效，iOS 会静默失败，只剩引导。
2. **页面级 meta（能覆盖微信/QQ 的 X5 内核、部分 Android WebView）**：需要覆盖构建产物的 `index.html`。做法是先构建一次，把产物里的 `index.html` 复制到 `build-templates/web-mobile/index.html`，只在 `<head>` 里加下面几行，再构建：

```html
<meta name="screen-orientation" content="landscape">
<meta name="x5-orientation" content="landscape">
<meta name="x5-fullscreen" content="true">
<meta name="full-screen" content="yes">
<meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
```

不要手写整个 `index.html`：3.8 的模板里有引擎脚本名和内联启动参数，抄错就是黑屏。一定要从自己的构建产物里复制再改。

**PWA 路线**（添加到主屏后真正锁横屏）：在 `index.html` 旁边放 `manifest.json`，设 `"orientation": "landscape"`、`"display": "fullscreen"`，`<head>` 里加 `<link rel="manifest" href="./manifest.json">`。

**平台差异**：桌面浏览器窗口拉窄也会触发横屏提示（同一条判定，无需特殊处理）；微信 iOS 里 `x5-orientation` 无效，只能靠卡片引导用户手动转；如果是小游戏/原生包，那才是有真正的方向配置（`game.json` 的 `deviceOrientation`、原生构建面板的方向选项），web-mobile 没有。

## 部署到 GitHub Pages

线上地址：<https://v012345.github.io/>，仓库在 `~/Desktop/work/v012345.github.io`（Pages 源 = `master` 分支根目录，直接指向仓库根，所以构建产物的 `index.html` 必须放在根目录）。

**`.nojekyll` 是必须的。** 3.8 的产物里有 `cocos-js/_virtual_cc-*.js`，文件名以下划线开头，GitHub Pages 默认用 Jekyll 处理站点，会把下划线开头的文件过滤掉 → 该文件 404 → `cc` 模块加载失败 → 页面白屏。仓库根目录放一个空的 `.nojekyll` 即可关掉 Jekyll。

同步命令（产物与线上完全一致，并自动保留 `.nojekyll`）：

```sh
tools/publish-pages.sh                # 默认 build/web-mobile -> ~/Desktop/work/v012345.github.io
tools/publish-pages.sh build/web-mobile /path/to/v012345.github.io
```

推送后 Pages 重建约 30–60 秒。自检一条命令就够：

```sh
curl -o /dev/null -w '%{http_code}\n' https://v012345.github.io/cocos-js/_virtual_cc-C6aOtQS_.js
```

哈希会随每次构建变化，文件名以产物里的实际文件为准。

已知无害噪音：控制台会有一条 `favicon.ico 404`，产物里没有这个文件，不影响运行；想要干净就丢一个 `favicon.ico` 到仓库根目录。

## 验证

模块化改造已通过 **22 项规则测试、17 项框架测试、10 项店铺配置测试、7 项 Prefab 检查，以及 TypeScript 类型检查**。拆分后的 Creator 浏览器预览已验证三套布局、四客位同时显示、取杯、加料、拖放封盖、交付第四位顾客、垃圾桶丢弃、封盖暂停、结算与重开，以及返回菜单后保留店铺选择。操作使用脚本模拟鼠标，**没有在真机上用手指验收**。

另验证了杯子根节点非等比缩放并旋转后的松手位置连续性，以及交付特效保留世界缩放。独立 `Sealer.prefab` 已在 Creator 编辑器中打开并确认组件绑定完整。

```sh
node tests/game.test.mjs        # 奶茶规则
node tests/framework.test.mjs   # 框架里不依赖引擎的部分（事件总线、状态机、动画驱动、落点判定）
node tests/shop-config.test.mjs # 店铺容量、可制作菜单、解锁、客流、配置校验
node tests/shop-prefabs.test.mjs # Prefab 本地引用、资源 UUID、物件归属和共享实例
npx -p typescript@5.9 tsc --noEmit --skipLibCheck -p .
```

规则、框架和店铺配置测试直接运行 TypeScript 源码，需要 Node 22.18 以上，不需要安装 tsc；运行时 Node 会打印一条 `MODULE_TYPELESS_PACKAGE_JSON` 警告，可以忽略。Prefab 测试检查资源文件，不启动引擎。类型检查要用 TypeScript 5.x，TypeScript 7 不再支持 Creator 生成的配置里的 `moduleResolution` 选项。`skipLibCheck` 跳过 Creator 引擎声明文件内部错误，仍检查项目脚本。

请重点测试：手机上是否容易抓住杯子、从机器取成品是否顺手、拖到客人和垃圾桶是否准确、取消拖动或切后台后是否正确回位。封盖计时、资源显示、坐标换算和触控事件的实际表现仍需 Creator / 真机预览确认。

## 代码

整体规划和分层规则见 `架构.md`。

- `assets/framework/`：通用框架，不含奶茶相关内容，以后做别的 2D 游戏可以整个拿走。
  - `core/`：`App` 入口、事件总线。`fsm/`：状态机。`res/`：资源加载。
  - `ui/`：界面管理（页面、浮层、弹窗、顶层四个层级）、圆角矩形 `RoundRect`、进度条 `FillBar`。
  - `input/`：拖拽 `Draggable`、放置区 `DropZone` 和落点判定。
  - `fx/`：动画驱动 `Animator`。`platform/`：横竖屏监视。
- `assets/game/`：奶茶游戏本体。
  - `logic/TeaGame.ts`：纯规则——顾客点单与耐心、单杯占位、封盖、交付和丢弃。不依赖引擎，通过事件通知画面。
  - `flow/GameFlow.ts`：流程状态（主菜单、营业中、结算），保持店铺选择并等待布局就绪后开始计时。
  - `view/ShopView.ts`：规则和画面之间的桥；`view/shop/ShopLayout.ts` 收集布局物件并应用经营配置和主题。
  - `view/shop/`：按 `equipment`、`ingredients`、`drinks`、`customers` 分类的物件组件。
  - `ui/`：界面组件，只负责填数据和绑按钮。`config/`：店铺组合、经营配置、主题、配方和顾客内容。
- `assets/resources/prefabs/`：界面入口与画面资源。`shop/` 共 19 个 Prefab，包括 16 个物件/特效与 3 个布局；布局使用原生嵌套引用共享物件。
- `tests/`：独立脚本测试，不启动 Cocos 游戏。

当前未加入音效、存档、升级系统或逐帧表情。

## 顾客进出场

顾客以约 0.6 秒从侧边淡入，带轻微走路起伏。交付后会显示感谢语，等待超时会显示失望语，随后向另一侧移动淡出，离场共约 1 秒。离场期间该位置不生成新客人；暂停会冻结动画和位置保留计时。复用现有角色图片，不需要新增素材或编辑器绑定。
