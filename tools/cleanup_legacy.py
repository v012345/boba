"""预览或清理旧奶茶店及生成中间资源。

默认只打印清单；运行 `python tools/cleanup_legacy.py --apply` 才会修改文件。
执行前将受影响的文件备份到系统临时目录的 ZIP 中。
"""

from __future__ import annotations

import argparse
import json
import re
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIRECTORIES = (
    'assets/game/flow', 'assets/game/logic', 'assets/game/view/shop',
    'assets/resources/prefabs/shop', 'assets/resources/spines/sealer',
    'assets/resources/images/level-select/maps/draft',
    'assets/resources/images/level-select/maps/continuous/modular',
    'assets/resources/art/bin-animation-v1', 'assets/resources/art/bin-animation-v2',
    'assets/resources/art/level-select-assets', 'assets/resources/art/machine-bin-parts',
    'assets/resources/art/sealer-animation-v1', 'output',
)
FILES = (
    'assets/game/flow.meta', 'assets/game/logic.meta', 'assets/game/view/shop.meta',
    'assets/game/view/ShopView.ts', 'assets/game/view/ShopView.ts.meta',
    *(f'assets/game/ui/{name}{suffix}' for name in ('HudPanel', 'MainMenuPanel', 'PausePanel', 'ResultPanel') for suffix in ('.ts', '.ts.meta')),
    *(f'assets/game/config/{name}{suffix}' for name in ('Customers', 'Recipes', 'ShopProfiles', 'ShopThemes', 'Shops') for suffix in ('.ts', '.ts.meta')),
    'assets/resources/prefabs/shop.meta',
    'assets/resources/prefabs/view/Shop.prefab', 'assets/resources/prefabs/view/Shop.prefab.meta',
    *(f'assets/resources/prefabs/ui/{name}{suffix}' for name in ('Hud', 'MainMenu', 'Pause', 'Result') for suffix in ('.prefab', '.prefab.meta')),
    'assets/resources/spines/sealer.meta',
    'assets/resources/images/level-select/maps/draft.meta',
    'assets/resources/images/level-select/maps/continuous/modular.meta',
    'assets/resources/images/level-select/maps/continuous/modular-curved/map_full.png',
    'assets/resources/images/level-select/maps/continuous/modular-curved/map_full.png.meta',
    'tests/game.test.mjs', 'tests/shop-config.test.mjs', 'tests/shop-prefabs.test.mjs',
)
KEEP_SPRITES = {'jelly-tray.png', 'milk-jug.png', 'pearl-tray.png', 'tea-pot.png'}
EDIT_PATHS = ('assets/game/Main.ts', 'assets/game/GameEvents.ts', 'assets/scenes/boot.scene')


def safe(path: Path) -> Path:
    """拒绝工作区外路径和符号链接，避免清理到意外位置。"""
    path = path.absolute()
    if not path.is_relative_to(ROOT):
        raise ValueError(f'路径不在项目内: {path}')
    for part in (path, *path.parents):
        if part == ROOT.parent:
            break
        if part.is_symlink() or (hasattr(part, 'is_junction') and part.is_junction()):
            raise ValueError(f'拒绝处理链接或连接点: {part}')
    return path


def collect() -> tuple[set[Path], set[Path]]:
    files: set[Path] = set()
    dirs: set[Path] = set()
    for rel in DIRECTORIES:
        folder = safe(ROOT / rel)
        if folder.is_dir():
            dirs.add(folder)
            for path in folder.rglob('*'):
                safe(path)
                if path.is_file():
                    files.add(path)
                elif path.is_dir():
                    dirs.add(path)
    for rel in FILES:
        path = safe(ROOT / rel)
        if path.is_file():
            files.add(path)
    art = ROOT / 'assets/resources/art'
    for path in art.iterdir():
        if path.is_file() and path.name != 'sprites.meta':
            files.add(safe(path))
    for path in (art / 'sprites').iterdir():
        original = path.name.removesuffix('.meta')
        if path.is_file() and original not in KEEP_SPRITES:
            files.add(safe(path))
    for path in (ROOT / 'assets/resources/spines/characters').iterdir():
        if path.is_file() and not path.name.startswith('wuy.'):
            files.add(safe(path))
    for rel in ('assets/resources/images/level-select/maps', 'assets/resources/images/level-select/maps/continuous'):
        for path in (ROOT / rel).glob('map_*'):
            if path.is_file():
                files.add(safe(path))
    return files, dirs


def check_references(files: set[Path]) -> None:
    """检查当前关卡和选关 Prefab/场景的 UUID 依赖以及配置的资源路径。"""
    uuid_to_asset: dict[str, Path] = {}
    class_to_asset: dict[str, Path] = {}
    alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    for meta in (ROOT / 'assets').rglob('*.meta'):
        try:
            uid = json.loads(meta.read_text(encoding='utf-8')).get('uuid')
        except (OSError, ValueError):
            continue
        if uid:
            asset = Path(str(meta)[:-5])
            uuid_to_asset[uid] = asset
            if asset.suffix == '.ts' and re.fullmatch(r'[0-9a-f-]{36}', uid):
                compact = uid.replace('-', '')
                encoded = compact[:5] + ''.join(
                    alphabet[int(compact[i:i + 3], 16) >> 6] + alphabet[int(compact[i:i + 3], 16) & 63]
                    for i in range(5, 32, 3)
                )
                class_to_asset[encoded] = asset
    roots = list((ROOT / 'assets/resources/prefabs/level').rglob('*.prefab'))
    roots += list((ROOT / 'assets/resources/prefabs/level-select').rglob('*.prefab'))
    roots += [ROOT / p for p in ('assets/resources/prefabs/view/LevelView.prefab',
                                'assets/resources/prefabs/view/LevelSelectView.prefab',
                                'assets/resources/prefabs/ui/RotateHint.prefab',
                                'assets/scenes/boot.scene', 'assets/load.scene')]
    seen: set[Path] = set()
    while roots:
        path = roots.pop()
        if path in seen or not path.is_file():
            continue
        seen.add(path)
        try:
            content = path.read_text(encoding='utf-8')
        except UnicodeError:
            continue
        for uid in re.findall(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', content):
            asset = uuid_to_asset.get(uid)
            if asset in files or (asset and Path(str(asset) + '.meta') in files):
                raise ValueError(f'当前资源 {path.relative_to(ROOT)} 仍引用待删除资源 {asset.relative_to(ROOT)}')
            if asset:
                roots.append(asset)
        for class_id in re.findall(r'"__type__"\s*:\s*"([^" ]+)"', content):
            asset = class_to_asset.get(class_id)
            if asset in files:
                raise ValueError(f'当前资源 {path.relative_to(ROOT)} 仍使用待删除脚本 {asset.relative_to(ROOT)}')
    configs = ROOT / 'assets/game/config'
    for config in configs.glob('*.ts'):
        if config in files:
            continue
        config_text = '\n'.join(line for line in config.read_text(encoding='utf-8').splitlines()
                                if not line.lstrip().startswith('//'))
        for raw in re.findall(r"['\"]((?:prefabs|images|spines)/[^'\"]+)['\"]", config_text):
            resource = raw.removesuffix('/spriteFrame')
            for suffix in ('.prefab', '.png', '.skel', '.json'):
                path = ROOT / 'assets/resources' / (resource + suffix)
                if path in files:
                    raise ValueError(f'当前配置 {config.relative_to(ROOT)} 引用了待删除资源 {path.relative_to(ROOT)}')
    select_source = (ROOT / 'assets/game/view/LevelSelectView.ts').read_text(encoding='utf-8')
    if "'images/level-select/maps/continuous/modular-curved'" not in select_source:
        raise ValueError('选关地图路径已变化，请重新检查要删除的地图素材')


def edits() -> dict[Path, bytes]:
    main = ROOT / 'assets/game/Main.ts'
    text = main.read_text(encoding='utf-8')
    replacements = (
        ("import { registerFlow } from './flow/GameFlow';\n", ''),
        ("import { DEFAULT_SHOP_ID } from './config/Shops';\n", ''),
        ('const { ccclass, property } = _decorator;', 'const { ccclass } = _decorator;'),
        ('// 流程状态只注册一次（脚本加载时），重复进入场景不会重复注册。\nregisterFlow(app.flow);\n\n', ''),
        ("    @property({ tooltip: '店铺配置 ID：basic 小店、standard 标准店、premium 大店；配置见 game/config/Shops.ts' })\n    shopId = DEFAULT_SHOP_ID;\n\n", ''),
    )
    for old, new in replacements:
        if old not in text:
            raise ValueError(f'Main.ts 已变化，无法安全自动修改: {old[:45]}')
        text = text.replace(old, new, 1)
    scene = ROOT / 'assets/scenes/boot.scene'
    scene_text = scene.read_text(encoding='utf-8')
    if '    "shopId": "standard",\n' not in scene_text:
        raise ValueError('boot.scene 已变化，无法安全自动移除旧店铺配置')
    scene_text = scene_text.replace('    "shopId": "standard",\n', '', 1)
    return {
        main: text.encode('utf-8'),
        scene: scene_text.encode('utf-8'),
        ROOT / 'assets/game/GameEvents.ts': '/** 全游戏事件表；新玩法需要事件时在此添加。 */\nexport interface GameEvents {}\n'.encode('utf-8'),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='备份后执行清理；默认只预览')
    args = parser.parse_args()
    files, dirs = collect()
    check_references(files)
    changes = edits()
    for path in sorted(files):
        print(f'删除: {path.relative_to(ROOT)}')
    for path in changes:
        print(f'更新: {path.relative_to(ROOT)}')
    print(f'共 {len(files)} 个文件、{len(dirs)} 个目录；保留当前关卡配置和资源。')
    if not args.apply:
        print('预览模式：没有修改任何文件。执行请加 --apply。')
        return
    backup = Path(tempfile.gettempdir()) / f'boba-cleanup-{datetime.now():%Y%m%d-%H%M%S-%f}.zip'
    with zipfile.ZipFile(backup, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=3) as archive:
        for path in sorted(files | set(changes)):
            archive.write(path, path.relative_to(ROOT))
    print(f'备份: {backup}', flush=True)
    for path, content in changes.items():
        path.write_bytes(content)
    for path in sorted(files):
        safe(path).unlink()
    for folder in sorted(dirs, key=lambda p: len(p.parts), reverse=True):
        safe(folder).rmdir()
    print('清理完成。请在 Cocos 中重新编译并检查第一关。')


if __name__ == '__main__':
    main()
