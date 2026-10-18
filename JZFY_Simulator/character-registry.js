// character-registry.js
// 角色注册表：所有角色文件调用 register() 把自己的定义挂进来。
// 引擎只通过 CHARACTERS[name] 访问，将来可平滑迁移到 CharacterRegistry.get(name)。

const CharacterRegistry = (() => {
    const store = new Map();
    const order = [];   // 记录注册顺序，决定 UI 下拉框顺序

    return {
        register(def) {
            if (!def || !def.name) {
                console.warn("[CharacterRegistry] 注册失败：缺少 name 字段", def);
                return;
            }
            if (store.has(def.name)) {
                console.warn(`[CharacterRegistry] "${def.name}" 重复注册，已覆盖旧定义。`);
            } else {
                order.push(def.name);
            }
            store.set(def.name, def);
        },

        get(name)      { return store.get(name) || null; },
        has(name)      { return store.has(name); },
        list()         { return [...order]; },
        all()          { return order.map(n => store.get(n)); },
        clear()        { store.clear(); order.length = 0; }
    };
})();