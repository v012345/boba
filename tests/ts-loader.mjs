// 让 Node 直接运行项目里不依赖引擎的 TypeScript 源码，不需要安装 tsc。
// 需要 Node 22.18 以上（内置去除类型标注的能力）。在测试文件开头 import 本文件即可。
// 限制：被测试的源码只能用「去掉类型就是合法 JS」的写法，不能用 enum、
// 构造函数参数属性（constructor(private x)）和装饰器。
import { registerHooks } from 'node:module';

// 项目里的 import 按 Cocos 的习惯不写扩展名，这里替 Node 补上 .ts。
registerHooks({
    resolve(specifier, context, nextResolve) {
        try { return nextResolve(specifier, context); }
        catch (error) {
            if (!specifier.startsWith('.')) throw error;
            return nextResolve(specifier + '.ts', context);
        }
    },
});
