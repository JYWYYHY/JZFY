/* ============================================================
 * core/character-registry.js
 * ============================================================ */

class CharacterRegistryClass {
    constructor() { this._store = new Map(); }

    register(def) {
        if (!def || !def.id) {
            console.warn("[core] 注册失败：缺少 id", def);
            return;
        }
        if (this._store.has(def.id)) {
            console.warn(`[core] "${def.id}" 重复注册，已覆盖`);
        }
        this._store.set(def.id, def);
    }

    get(idOrName) {
        if (this._store.has(idOrName)) return this._store.get(idOrName);
        for (const def of this._store.values()) {
            if (def.name === idOrName) return def;
        }
        return null;
    }

    has(idOrName) { return !!this.get(idOrName); }
    list() { return [...this._store.keys()]; }
    all() { return [...this._store.values()]; }

    // 注册 MOD
    registerMod(mod) {
        if (!mod.id || !mod.name) throw new Error("MOD 需要 id 和 name");
        if (!mod.skills || !Array.isArray(mod.skills)) throw new Error("MOD 需要 skills 数组");

        const def = {
            id: mod.id,
            name: mod.name,
            hp: mod.hp || 50,
            atk: mod.atk || 0,
            skills: mod.skills,
            initialState: mod.initialState || {},
            hooks: mod.hooks || {},
            passives: mod.passives || [],
            isMod: true,
        };
        this.register(def);
        console.log(`[core] MOD 注册成功: ${mod.name}`);
        return def;
    }
}

const CharacterRegistry = new CharacterRegistryClass();