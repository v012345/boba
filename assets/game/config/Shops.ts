import { SHOP_PROFILES, validateShopProfile } from './ShopProfiles';
import type { ShopProfile } from './ShopProfiles';
import { SHOP_THEMES } from './ShopThemes';
import type { ShopTheme } from './ShopThemes';

export interface ShopDefinition {
    readonly id: string;
    readonly name: string;
    /** 相对 resources、不带扩展名的布局 Prefab 路径。 */
    readonly layoutPath: string;
    readonly profile: ShopProfile;
    readonly theme: ShopTheme;
}

export const SHOP_IDS = ['basic', 'standard', 'premium'] as const;
export type ShopId = typeof SHOP_IDS[number];
export const DEFAULT_SHOP_ID: ShopId = 'standard';

/** 布局、经营档次和染色主题独立组合；物件 Prefab 由布局复用。 */
export const SHOPS: Readonly<Record<ShopId, ShopDefinition>> = {
    basic: { id: 'basic', name: '暖色小店', layoutPath: 'prefabs/shop/layouts/SmallShop', profile: SHOP_PROFILES.basic, theme: SHOP_THEMES.warm },
    standard: { id: 'standard', name: '经典标准店', layoutPath: 'prefabs/shop/layouts/StandardShop', profile: SHOP_PROFILES.standard, theme: SHOP_THEMES.classic },
    premium: { id: 'premium', name: '青玉高档店', layoutPath: 'prefabs/shop/layouts/LargeShop', profile: SHOP_PROFILES.premium, theme: SHOP_THEMES.jade },
};

export function getShopDefinition(id: string = DEFAULT_SHOP_ID): ShopDefinition {
    if (!Object.prototype.hasOwnProperty.call(SHOPS, id)) throw new Error(`未知店铺：${id}`);
    const shop = SHOPS[id as ShopId];
    validateShopProfile(shop.profile);
    return shop;
}
