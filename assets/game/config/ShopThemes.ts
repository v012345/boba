/** 对现有美术进行染色的主题；不代表新增了一套美术资源。 */
export interface ShopTheme {
    readonly id: string;
    readonly name: string;
    readonly backgroundColor: string;
    readonly counterColor: string;
    readonly accentColor: string;
}

export const SHOP_THEMES: Readonly<Record<'classic' | 'warm' | 'jade', ShopTheme>> = {
    classic: { id: 'classic', name: '原色', backgroundColor: '#FFFFFF', counterColor: '#FFFFFF', accentColor: '#527B62' },
    warm: { id: 'warm', name: '暖色', backgroundColor: '#FFF1DF', counterColor: '#F4D7B8', accentColor: '#9B6843' },
    jade: { id: 'jade', name: '青玉', backgroundColor: '#E6F0E9', counterColor: '#D2E3D5', accentColor: '#396B60' },
};
