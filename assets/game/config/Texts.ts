/** 文本 ID 与中文文本；以后增加语言时沿用相同 ID。 */
const zhCN = {
    'material.tea': '红茶',
    'material.milk': '鲜奶',
    'material.pearl': '珍珠',
    'material.jelly': '椰果',
    'material.bone': '骨头',
    'material.flesh': '尸块',
    'material.organs': '内脏',
    'material.poop': '大便',
    'customer.wants': '想要：',
    'customer.mismatch': '不对哦！',
    'customer.thanks': '谢谢！',
} as const;

export type TextId = keyof typeof zhCN;

export const Texts = {
    get(id: TextId): string { return zhCN[id]; },
};
