import type { ButtonStyle } from '../../framework/ui/UIKit';

/** 本游戏界面的统一配色与按钮样式。 */
export const Theme = {
    ink: '#513B30',
    muted: '#8C7560',
    cream: '#FFF8E8',
    sand: '#DEC39A',
    green: '#527B62',
} as const;

export const PrimaryButton: ButtonStyle = { background: Theme.green, color: Theme.cream, fontSize: 28, radius: 18 };
export const SecondaryButton: ButtonStyle = { background: Theme.muted, color: Theme.cream, fontSize: 28, radius: 18 };
