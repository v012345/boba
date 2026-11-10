import { Asset, resources } from 'cc';

/** 资源类型，例如 Texture2D、SpriteFrame、Prefab。 */
type AssetType<T extends Asset> = new (...args: any[]) => T;

/**
 * 资源管理：统一加载 resources 目录下的资源，并记住加载过什么，方便成批释放。
 * 目前只支持内置的 resources 包；以后拆分 Asset Bundle 时在这里扩展。
 */
export class ResManager {
    private held = new Map<string, Asset>();
    private loading = new Map<string, Promise<Asset>>();

    /**
     * 加载资源。path 相对 resources 目录、不带扩展名，
     * 图片的子资源要写全，例如 'art/shop/texture'。
     * 同一路径重复加载会复用，不会重复请求。
     */
    load<T extends Asset>(path: string, type: AssetType<T>): Promise<T> {
        const held = this.held.get(path);
        if (held) return Promise.resolve(held as T);
        const pending = this.loading.get(path);
        if (pending) return pending as Promise<T>;

        let settled = false;
        const promise = new Promise<T>((resolve, reject) => {
            resources.load(path, type, (error, asset) => {
                settled = true;
                this.loading.delete(path);
                if (error || !asset) { reject(error || new Error(`资源加载失败：${path}`)); return; }
                // 引用计数 +1，防止资源在使用期间被引擎自动回收。
                asset.addRef();
                this.held.set(path, asset);
                resolve(asset);
            });
        });
        if (!settled) this.loading.set(path, promise);
        return promise;
    }

    /** 释放一个已加载完成的资源。还在加载途中的不受影响。 */
    release(path: string): void {
        const asset = this.held.get(path);
        if (!asset) return;
        this.held.delete(path);
        asset.decRef();
    }

    /** 释放全部已加载的资源，一般在切换大场景时调用。 */
    releaseAll(): void {
        for (const path of Array.from(this.held.keys())) this.release(path);
    }
}
