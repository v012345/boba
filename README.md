# 巷口奶茶铺 · Cocos Creator 3.8.8

暖色手绘风手机横屏奶茶店原型。直接营业，90 秒内争取 ¥150。当前采用 **一个制作位、一摞共用杯子、拖放封盖与交付**。

## 在 Creator 里试玩

已有场景继续使用原来的 Canvas / TeaShop 组件，等待新素材导入后重新预览，无需重新挂载或绑定属性。

空项目首次接入：新建 2D 场景，保留默认 Canvas 和 Camera，把 `assets/scripts/TeaShop.ts` 挂在 Canvas 上一次，保存并预览。推荐 1280×720。界面运行时生成，编辑状态不可见。相机需包含 UI_2D 层。

使用 SHOW_ALL 适配，宽屏可能留边。网页在手机上手动横屏；原生构建在构建面板设置横屏。异形屏安全区和触控手感仍需真机验收。

## 当前操作

1. 客人进店即点单：头顶气泡直接显示配方与价格，同时开始消耗耐心，**不需要点击接单**。气泡上的杯子就是他们要的那杯。
2. 点击桌下杯摞，取出一个空杯移动到唯一制作位。**杯子往桌上滑的 0.45 秒里直接按住也算放好**，会立即结束滑入并开始拖动；当前杯子未交付或丢弃前不能再取杯。
3. 点击桌上材料加料：红茶 → 鲜奶 → 按配方加入珍珠或椰果。
4. **按住杯子，拖到右侧封盖机，松手**。机器封盖 **1 秒**，期间不能拖动或丢弃。空杯、缺鲜奶的杯子不会启动机器。
5. 封好后杯子留在机器里，**从机器里拖出杯子，松手放到客人身上或订单气泡上**，交付匹配奶茶。
6. 想重做时，把空杯、制作中的杯子或已封好的杯子**拖到桌下左侧垃圾桶**。整杯丢弃并重置连击，需要重新从杯摞取杯。

拖动手感：制作位与封盖机上各有一块固定抓取区（250×200、200×190，比杯子本身大得多），按压点只要落在杯子附近就算抓住，无需点准玻璃；抓起后杯子会上抬 26px 并放大到 1.08 倍，避免手指压住杯身。抓取的瞬间所有可放置区域会整体描边，指到哪个就高亮哪个（垃圾桶额外换成打开状态）。松手时封盖机与垃圾桶接受 52px 的近似命中，客人必须准确命中，避免错单；没有命中时杯子会在 0.16 秒内缓动飞回原位，而不是瞬移。落点判定以杯子中心（含上抬量）为准，与看到的画面一致。

未封盖或配方错误时保留杯子。配方错误扣客人 5 秒耐心并重置连击。触摸取消、暂停、切后台会取消当前拖动，不触发丢弃或交付。封盖与所有动画在暂停时冻结。

第一单固定原味；完成 2 单解锁椰果，5 单解锁双拼。耐心从进店起算，初始 40 秒，每交付一单递减 0.8 秒（最低 26 秒）——原来「思考 2.5 秒 + 接单」的免费时间已折算进来。连续交付有奖励。营业结束可重新开始。

## 美术与分层

- `assets/resources/art/shop.png`：原背景。桌面使用原图像素区域 `(0, 610, 1672, 260)` 单独创建 SpriteFrame，放在顾客前方。坐标说明在 `table-cutout.json`，不修改原图。
- `customers.png`：四位客人图集。
- `ingredients.png`：红茶壶与奶壶。
- `cup-shelf.png`：桌下三格柜体；当前只使用中间共用杯摞。未来 S／M／L 的供杯配置位于 `TeaGame.ts` 的 `CUP_SUPPLIES`，尚未开启杯型订单、定价和不同尺寸美术。
- `service-props.png`：杯摞、封口膜、珍珠料盘、椰果料盘。
- `cup-states.png`、`cup-jelly-states.png`：空杯、茶底、四种奶茶成品图片。杯子在桌面、订单和拖动时复用相同美术。
- `machine-bin.png`：2×2 图集，依次为待机封盖机、工作封盖机、垃圾桶、打开垃圾桶。

素材由内置 image_gen 生成。提示词和来源保存在 `ART-PROMPTS.json`、`ART-PROMPTS-V2.json`、`ART-PROMPTS-V3.json`。没有采用的带背景试稿未接入项目。UI 文本、进度、拖放提示、飞入的小料及部分临时配料叠加仍使用代码绘制。

## 发布为 web-mobile（横屏）

**先说结论：网页没法强制横屏。** 浏览器不给页面锁屏方向，iOS Safari 连 `screen.orientation.lock()` 都没有。所以这里用的是「竖屏拦截 + 能锁就锁」两层：

1. **引擎内守卫（已内置，任何浏览器都生效）**：`TeaShop.checkOrientation()` 每 0.4 秒读一次视口尺寸（web 用 `window.innerWidth/innerHeight`，原生退回 `screen.windowSize`），宽高比变成竖屏就弹一张“请把手机横过来”的全屏卡，`BlockInputEvents` 挡住操作，`update` 直接 return，**计时和动画一起冻结**；转回横屏自动恢复并接着营业。卡片上的「全屏并锁定横屏」按钮会先 `requestFullscreen()`，成功后再调 `screen.orientation.lock('landscape')`——Android Chrome 有效，iOS 会静默失败，只剩引导。
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

本轮 **20 项规则与拖放区域测试通过，项目类型检查通过**，没有启动游戏或做实际触控验收。

```sh
node tests/game.test.cjs
tsc --noEmit --skipLibCheck --ignoreDeprecations 6.0
```

需要本机 Node.js 和 TypeScript。后者参数适用于本机 TypeScript 6，其他版本可去掉 `--ignoreDeprecations 6.0`。`skipLibCheck` 跳过 Creator 引擎声明文件内部错误，仍检查项目脚本。

请重点测试：手机上是否容易抓住杯子、从机器取成品是否顺手、拖到客人和垃圾桶是否准确、取消拖动或切后台后是否正确回位。封盖计时、资源显示、坐标换算和触控事件的实际表现仍需 Creator / 真机预览确认。

## 代码

- `TeaGame.ts`：纯规则、顾客点单与耐心、单杯占位、封盖、交付和丢弃。
- `TeaShop.ts`：美术、触控拖动、动画、界面和暂停。
- `TeaDropTargets.ts`：拖放区域定义与命中判定，与高亮区域共用。
- `tests/game.test.cjs`：独立脚本测试，不启动 Cocos 游戏。

当前未加入音效、存档、升级系统或逐帧表情。

## 顾客进出场

顾客以约 0.6 秒从侧边淡入，带轻微走路起伏。交付后会显示感谢语，等待超时会显示失望语，随后向另一侧移动淡出，离场共约 1 秒。离场期间该位置不生成新客人；暂停会冻结动画和位置保留计时。复用现有角色图片，不需要新增素材或编辑器绑定。
