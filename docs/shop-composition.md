# 店铺组合指南

店铺由共享物件、布局、经营配置和主题组合而成。修改一个共享物件，可以更新所有引用它的店铺；每家店的位置、数量和菜单分别配置。

当前保持单制作杯位。小店、标准店、高档店的差异是顾客容量、原料、菜单、客流、营业目标及染色主题，尚未实现多个制作位或多台机器同时加工。

## 切换现有店铺

1. 在 Creator 打开 `assets/scenes/boot.scene`。
2. 选中 `Canvas`，找到 `Main` 组件。
3. 将 `shopId` 改成以下一个值，保存场景并重新预览。

- `basic`：暖色小店，`SmallShop` 布局，2 个顾客位；有红茶、鲜奶、珍珠，供应原味和珍珠奶茶，营业目标 ¥100。
- `standard`：经典标准店，`StandardShop` 布局，3 个顾客位；保留原有四种原料、渐进解锁和 ¥150 目标。默认使用此配置。
- `premium`：青玉高档店，`LargeShop` 布局，4 个顾客位；四种饮品从开店起全部可点，客流更快，营业目标 ¥200。

三个店铺目前均营业 90 秒、共用一个制作杯位。顾客位数量是同时容纳的上限，并不表示开店瞬间就会站满。结算后的重新营业，以及暂停或结算后返回菜单再开始，都会保持当前选择。

`Shop.prefab` 内嵌的标准店仅用于编辑器预览。实际开局由 `Main.shopId` 选择配置，`GameFlow` 加载对应布局，`ShopView` 替换预览布局；不要通过修改入口壳里的摆放来定制新店。

## 资源与脚本

`assets/resources/prefabs/shop/` 下共有 19 个 Prefab：

```text
shop/
├─ equipment/
│  ├─ Bin.prefab
│  ├─ Sealer.prefab
│  ├─ CupSupply.prefab
│  └─ Workstation.prefab
├─ ingredients/
│  ├─ TeaPot.prefab
│  ├─ MilkJug.prefab
│  ├─ PearlTray.prefab
│  └─ JellyTray.prefab
├─ drinks/
│  ├─ Drink.prefab
│  └─ Cup.prefab
├─ customers/
│  └─ Customer.prefab
├─ environment/
│  ├─ Background.prefab
│  ├─ Counter.prefab
│  └─ Shelf.prefab
├─ fx/
│  ├─ IngredientDrop.prefab
│  └─ FloatingText.prefab
└─ layouts/
   ├─ SmallShop.prefab
   ├─ StandardShop.prefab
   └─ LargeShop.prefab
```

`assets/resources/prefabs/view/Shop.prefab` 继续作为页面入口，原 UUID 与加载路径保留。原有 HUD、菜单和弹窗仍在 `assets/resources/prefabs/ui/`。

物件组件位于 `assets/game/view/shop/` 的同类目录；`ShopLayout.ts` 位于该目录根部，`ShopView.ts` 保留在 `assets/game/view/`。已有 `BinView`、`CupView`、`DrinkView`、`CustomerView`、`IngredientTray` 移动时保留了 `.meta` 中的 UUID。新增设备组件是 `SealerView`、`CupSupplyView`、`WorkstationView`。

现有图片仍在 `assets/resources/art/`，垃圾桶骨骼仍在 `assets/resources/spines/bin/`，拆分没有复制一套美术。

## 编辑共享物件

双击物件 Prefab 编辑内部结构，保存后由嵌套实例复用。物件应拥有完整的表现、交互区域和定位点：

- `Bin`：骨骼、桶口、提示和放置区，`BinView` 绑定 `skeleton`、`mouth`、`dropZone`。
- `Sealer`：机器图片、状态文字、进度、放置区和停杯点，`SealerView` 绑定这些节点及待机/工作图片。
- `CupSupply`：取杯按钮、提示文字和出杯点，`CupSupplyView` 绑定 `button`、`label`、`cupPoint`。
- `Workstation`：制作提示和杯子停放点，`WorkstationView` 绑定 `detail`、`status`、`cupPoint`。
- `Customer`：头像、订单气泡、耐心条和自己的收货区；多个客位使用同一个 Prefab。
- `Drink`：只负责杯身、配料和封口外观。`Cup` 在其外面增加拖动区域与移动表现；顾客订单也嵌套同一个 `Drink`。

移动垃圾桶或封盖机的实例根节点时，交互区域和内部锚点会一起移动。不要把这些内部节点单独放回布局根部，否则物件就不能完整复用。

布局里的物件是 Cocos 原生嵌套 Prefab。位置、缩放和实例名称等可以保留为当前布局的覆盖；需要让所有店铺一起改变的内容，应在源物件 Prefab 内修改。将布局中特有的覆盖应用回源 Prefab，会影响其他店铺。已经覆盖的同名属性通常会保留实例值，检查效果时要同时检查实例覆盖。

移动已有资源应通过 Creator 完成，或连同原 `.meta` 一起移动以保留引用。创建新资产副本时应让 Creator 生成新的 UUID，不要让两个不同资产共用复制来的 `.meta` UUID。

## 编辑布局

在 `layouts/` 中打开所需布局，拖入共享物件，调整摆放和层级。当前规则要求每个布局恰好有一个 `BinView`、`SealerView`、`CupSupplyView`、`WorkstationView` 和 `CupView`；单纯复制机器或制作杯不会增加可并行生产能力。

每个布局根节点保留 `ShopLayout`，并绑定：

- `effects`：布局内的 `Effects` 节点，承载交付杯子、配料颗粒和飘字。
- `dropletPrefab`：`fx/IngredientDrop.prefab`。
- `floatTextPrefab`：`fx/FloatingText.prefab`。

顾客和配料通过组件自动收集，无需在 `ShopView` 重新拖一长串内部引用。顾客 slot 按布局的层级遍历顺序分配；经营配置启用前 `customerSlots` 个站位，其余停用。布局客位少于配置要求时会报错，不会悄悄截断规则。

布局中必须包含配置要求的每种原料。未启用的原料实例会隐藏，但缺少已启用原料会阻止开局。`SmallShop` 本身没有椰果盘，所以不能直接搭配需要椰果的经营配置，除非先补上该物件。

当前主题会寻找布局根节点的直接子节点 `Background`、`Counter`，并对它们根上的 `Sprite` 染色。需要继续使用主题染色时，保留这两个名称和层级关系。

## 配置职责

- `assets/game/config/Shops.ts`：一个具体店铺的 ID、名字、布局资源路径、经营配置和主题。
- `assets/game/config/ShopProfiles.ts`：顾客位、可用原料、菜单与解锁条件、营业时长、目标、封盖时间及客流参数。
- `assets/game/config/ShopThemes.ts`：背景、柜台和顾客提示的颜色。
- `assets/game/config/Recipes.ts`：原料名称与配方定义。
- `assets/game/config/Customers.ts`：顾客名字。

主题目前是对现有图片进行染色，`classic` 保留原色，`warm` 偏暖，`jade` 偏青绿。它们不包含独立的中式、热带或豪华装修图。要做外形、结构差异较大的装修，可以制作新的环境或设备 Prefab，再放进相应布局。

配方的 `afterServed` 表示完成多少单后才开始出现在订单中。每家店至少要有一道开店即可制作的配方，菜单所需原料也必须全部启用。第一单使用该店第一个已解锁配方。规则会拒绝缺料菜单、无效客位数量和无效时间配置。

## 新增一家店

以下例子新增一间使用小店经营规则、青玉颜色的花园店：

1. 在 Creator 中复制 `SmallShop.prefab` 为 `GardenShop.prefab`，保留共享物件的嵌套关系，调整背景、装饰和摆放。
2. 确认新布局保留 `ShopLayout` 的三项绑定，并有至少两个顾客位及红茶、鲜奶、珍珠。
3. 在 `Shops.ts` 原有 `SHOP_IDS` 数组中增加 `'garden'`。
4. 在同文件 `SHOPS` 对象中追加以下项：

```ts
garden: {
    id: 'garden',
    name: '花园小店',
    layoutPath: 'prefabs/shop/layouts/GardenShop',
    profile: SHOP_PROFILES.basic,
    theme: SHOP_THEMES.jade,
},
```

5. 将启动场景 `Main.shopId` 设为 `garden`，保存后预览。

`layoutPath` 相对 `assets/resources/`，不包含 `.prefab` 扩展名。若要独立经营数值，可以在 `ShopProfiles.ts` 增加配置并扩展对应的键类型，再在新店里引用；也可以用现有配置展开后覆写字段。更换主题同样不必复制经营规则。

## 验证

目前已通过 22 项规则测试、17 项框架测试、10 项店铺配置测试、7 项 Prefab 资源检查及 TypeScript 类型检查。

Creator 浏览器预览已检查三套布局、四位顾客同时显示、取杯加料、封盖交付（含第四个客位）、垃圾桶丢弃、暂停冻结封盖计时、结算、重开及返回菜单后保持店铺选择。另检查了缩放和旋转后的杯子松手位置与交付特效缩放。独立封盖机已在 Creator 编辑器中确认脚本与内部字段绑定。浏览器操作使用脚本模拟鼠标，尚未做手机真机触控验收。

```sh
node tests/game.test.mjs
node tests/framework.test.mjs
node tests/shop-config.test.mjs
node tests/shop-prefabs.test.mjs
npx -p typescript@5.9 tsc --noEmit --skipLibCheck -p .
```

前三组测试直接运行 TypeScript 源码，需要 Node 22.18 以上。Prefab 测试验证本地对象引用、资源 UUID 和共享实例结构，不负责验证渲染效果。

修改布局后，在 Creator 预览中检查取杯、加料、封盖、交付、丢弃、暂停、营业结束和重新营业；尤其检查物件移动或缩放后的放置区、停杯点和顾客气泡。新增店铺还要检查订单菜单与实际原料一致、顾客站位不超出画面。
