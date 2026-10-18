// data.js
// 从 CharacterRegistry 装配出旧版全局 CHARACTERS。
// 引擎和 UI 继续使用 CHARACTERS[name]，一行不用改。

const CHARACTERS = (() => {
    const obj = {};
    CharacterRegistry.list().forEach(name => {
        const def = CharacterRegistry.get(name);
        if (def) obj[name] = def;
    });
    return obj;
})();

// 允许手动模式动态注册木桩，并保留原有行为
window.CHARACTERS = CHARACTERS;