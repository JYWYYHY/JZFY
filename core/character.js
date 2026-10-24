/* ============================================================
 * core/character.js
 *   · Character / Team
 *   · 通用 buff 字段（扁平）
 *   · 私有状态由 def.initialState 声明
 * ============================================================ */

class Character {
    constructor(defOrName, registry) {
        let def;
        if (typeof defOrName === "string") {
            def = registry ? registry.get(defOrName) : null;
        } else {
            def = defOrName;
        }

        if (!def) {
            console.error(`[core] 未找到角色:`, defOrName);
            def = {
                id: String(defOrName),
                name: String(defOrName),
                hp: 1, atk: 0,
                skills: [{ name: "无", cost: 0, effects: [], targetType: "self" }],
                initialState: {},
                hooks: {},
                passives: [],
            };
        }

        this.def = def;
        this.id = def.id;
        this.name = def.name;
        this.maxHp = def.hp;
        this.baseAtk = def.atk;

        // 技能数组统一编号 0/1/2/3，同时保留 key
        this.skills = (def.skills || []).map((s, i) => ({
            ...s,
            key: ["basic", "s1", "s2", "ult"][i] || `skill${i}`,
            isUltimate: s.isUltimate || i === 3,
        }));

        this.hooks = def.hooks || {};
        this.passives = def.passives || [];

        // side / team / pos 由 Team 设置
        this.team = null;
        this.side = null;
        this.pos = 0;

        this.reset();
    }

    reset() {
        // ---------- 基础 ----------
        this.hp = this.maxHp;
        this.atk = this.baseAtk;
        this.isDead = false;
        this.reviveRound = 0;

        // ---------- 通用 buff（core 认识） ----------
        this.shield = 0;
        this.xiJiStacks = 0;
        this.buffWoYe = 0;
        this.poisonTurns = 0;
        this.poisonSource = null;
        this.fearTurns = 0;
        this.buffTurns = 0;        // 通用 10% 减伤
        this.domainTurns = 0;      // 领域（15% 减伤 + 10% 免疫）
        this.cannotAct = 0;        // 无法行动回合数
        this.darkRoomTurns = 0;
        this.darkRoomDmgTaken = 0;
        this.darkRoomSource = null;
        this.duelRounds = 0;
        this.duelTarget = null;
        this.xiJiStacks = 0;
        this.buffWoYe = 0;


        // ---------- 统计 ----------
        this.stats = { totalDmg: 0, deaths: 0, ults: 0, turnsAlive: 0 };

        // ---------- 私有状态（角色自定义） ----------
        const init = this.def.initialState || {};
        for (const k of Object.keys(init)) {
            this[k] = (typeof init[k] === "object" && init[k] !== null)
                ? JSON.parse(JSON.stringify(init[k]))
                : init[k];
        }
    }
}

class Team {
    constructor(id, names, registry) {
        this.id = id;                // 'A' | 'B'
        this.chars = names.map((n, i) => {
            const c = new Character(n, registry);
            c.team = this;
            c.side = id;
            c.pos = i;
            return c;
        });

        this.hearts = 5;
        this.skillPoints = 3;
        this.errorHearts = 0;        // 剪云污染
        this.heZongBlockTurns = 0;   // 合纵禁言
    }

    getAliveChars() { return this.chars.filter(c => !c.isDead); }
    getAliveEnemies(enemyTeam) { return enemyTeam.chars.filter(c => !c.isDead); }
}