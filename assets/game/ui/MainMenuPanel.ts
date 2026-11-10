import { _decorator, Sprite, SpriteFrame, Texture2D } from 'cc';
import { createButton, createFullscreenNode, createLabel, createNode, fillBackground } from '../../framework/ui/UIKit';
import { UIPanel } from '../../framework/ui/UIPanel';
import { app } from '../GameApp';
import { PrimaryButton, Theme } from './Theme';

const { ccclass } = _decorator;

export interface MainMenuParams {
    /** 点击「开始营业」。 */
    onStart: () => void;
}

/** 主菜单：店铺背景、标题和开始按钮。 */
@ccclass('MainMenuPanel')
export class MainMenuPanel extends UIPanel<MainMenuParams> {
    private backgroundFrame: SpriteFrame | null = null;

    onOpen(params: MainMenuParams) {
        // 背景图加载完成前先显示纯色底。
        fillBackground(this.node, Theme.sand);
        const background = createFullscreenNode(this.node, 'Background').addComponent(Sprite);
        background.sizeMode = Sprite.SizeMode.CUSTOM;
        app.res.load('art/shop/texture', Texture2D).then(texture => {
            if (!this.isValid) return;
            const frame = new SpriteFrame();
            frame.texture = texture;
            this.backgroundFrame = frame;
            background.spriteFrame = frame;
        }).catch(error => console.warn('[MainMenu] 背景加载失败，使用纯色底', error));

        const card = createNode(this.node, 'Card', 0, 0, 560, 320);
        fillBackground(card, Theme.cream + 'F2', 26);
        createLabel(card, '巷口奶茶铺', 0, 70, 500, 80, 56, Theme.ink);
        createButton(card, '开始营业', 0, -70, 300, 84, PrimaryButton, params.onStart);
    }

    onClose() {
        this.backgroundFrame?.destroy();
        this.backgroundFrame = null;
    }
}
