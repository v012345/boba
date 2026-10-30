import { _decorator, Component, director } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Load')
export class Load extends Component {
    start() {
        director.loadScene('game', (err) => {
            if (err) {
                console.error('场景加载失败：', err);
                return;
            }

            console.log('场景加载完成');
        });
    }

    update(deltaTime: number) {

    }
}

