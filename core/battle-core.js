/* ============================================================
 * core/battle-core.js
 *   · BattleCore 主类
 *   · 事件发射 + 钩子分发
 *   · 无 UI / 无定时器 / 随机可控（splitmix32）
 * ============================================================ */

class BattleCore {
    constructor(options = {}) {
        this.registry = options.registry || CharacterRegistry;

        this.teamA = null;
        this.teamB = null;
        this.round = 1;
        this.turnIndex = 0;
        this.order = [];

        // 随机
        this._seed = null;
        this._rngState = 0;

        // 事件订阅
        this._listeners = {};

        // 日志回调
        this.onLog = null;

        // 结束状态
        this.isEnded = false;
        this.result = null;
    }

    // ---------- 种子 & 随机（splitmix32） ----------
    setSeed(seed) {
        this._seed = (seed == null) ? null : (seed >>> 0);
        this._rngState = this._seed || 0;
    }

    random() {
        if (this._seed == null) return Math.random();
        // splitmix32：对相邻种子也能产生均匀分布
        this._rngState = (this._rngState + 0x9e3779b9) >>> 0;
        let t = this._rngState;
        t = Math.imul(t ^ (t >>> 16), 0x21f0aaad);
        t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
        t = t ^ (t >>> 15);
        return (t >>> 0) / 4294967296;
    }

    // ---------- 事件 ----------
    on(event, handler) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(handler);
    }
    emit(event, data) {
        if (this._listeners[event]) {
            for (const h of this._listeners[event]) {
                try { h(data); } catch (e) { console.error(e); }
            }
        }
    }

    // ---------- 初始化 ----------
    init(teamANames, teamBNames) {
        this.teamA = new Team("A", teamANames, this.registry);
        this.teamB = new Team("B", teamBNames, this.registry);
        this.round = 1;
        this.turnIndex = 0;
        this.isEnded = false;
        this.result = null;

        // 用种子决定先手（和游戏本体一致）
        const firstSide = this.random() < 0.5 ? "A" : "B";
        const secondSide = firstSide === "A" ? "B" : "A";

        this.order = [
            { side: firstSide, pos: 0 }, { side: secondSide, pos: 0 },
            { side: firstSide, pos: 1 }, { side: secondSide, pos: 1 },
            { side: firstSide, pos: 2 }, { side: secondSide, pos: 2 },
        ];

        this.log(`=== 战斗开始（${firstSide} 方先手）===`, "system");
        this.emit("start", { teamA: this.teamA, teamB: this.teamB, firstSide });
    }

    // ---------- 队伍查找 ----------
    getTeam(side) { return side === "A" ? this.teamA : this.teamB; }
    getOpposingTeam(team) { return team === this.teamA ? this.teamB : this.teamA; }
    getTeamOf(char) { return char.side === "A" ? this.teamA : this.teamB; }

    // ---------- 行动顺序 ----------
    getNextActor() {
        while (this.turnIndex < this.order.length) {
            const slot = this.order[this.turnIndex];
            const actor = this.getTeam(slot.side).chars[slot.pos];
            this.turnIndex++;
            if (actor && !actor.isDead) return actor;
        }
        return null;
    }

    nextRound() {
        this.turnIndex = 0;
        this.processRoundEnd();
        if (this.isEnded) return;

        this.round++;
        this.processRoundStart();
    }

    // ---------- 回合 / 轮次 生命周期 ----------
    processRoundStart() {
        this.log(`--- 第 ${this.round} 轮 ---`, "system");

        // 复活
        [this.teamA, this.teamB].forEach(team => {
            team.chars.forEach(c => {
                if (c.isDead && c.reviveRound === this.round) {
                    this.revive(c, team);
                }
            });
        });

        // 回合开始钩子
        [this.teamA, this.teamB].forEach(team => {
            team.chars.forEach(c => {
                if (c.isDead) return;
                this.callHook(c, "onRoundStart", { team, round: this.round });
                this.emit("roundStart", { char: c, team });
            });
        });

        this.checkGameOver();
    }

    processRoundEnd() {
        [this.teamA, this.teamB].forEach(team => {
            team.chars.forEach(c => {
                if (c.isDead) return;
                this.callHook(c, "onRoundEnd", { team, round: this.round });
                this.emit("roundEnd", { char: c, team });
            });
        });
    }

    beginTurn(actor) {
        if (actor.isDead || this.isEnded) return;
        actor.stats.turnsAlive++;

        this.processTurnStart(actor);

        this.emit("turnStart", { actor });
    }

    processTurnStart(actor) {
        const team = this.getTeamOf(actor);

        // 毒伤
        if (actor.poisonTurns > 0) {
            const src = actor.poisonSource;
            const srcAtk = src ? (src.isDead ? src.baseAtk : src.atk) : 1;
            const dmg = Math.max(1, Math.round(srcAtk));
            const srcTeam = src ? this.getTeamOf(src) : null;
            this.dealDamage(src, actor, dmg, team, srcTeam, { isPoison: true });
            if (!actor.isDead) actor.poisonTurns--;
        }

        if (actor.isDead) return;

        // 角色私有 turnStart 被动
        (actor.passives || []).forEach(p => {
            if (p.trigger !== "turnStart") return;
            if (p.interval > 1 && this.round % p.interval !== 0) return;
            const fn = actor.hooks[p.hook];
            if (typeof fn === "function") {
                try {
                    fn(this.makeContext(actor, null, team, this.getOpposingTeam(team), null, "passive"));
                } catch (e) { console.error(`[core] ${actor.name} 被动执行错误:`, e); }
            }
        });

        this.callHook(actor, "onTurnStart", { team });
    }

    endTurn(actor) {
        if (actor.isDead) return;
        const team = this.getTeamOf(actor);

        // ---------- 希冀消耗（每次行动减 1 层） ----------
        if (actor.xiJiStacks > 0) {
            actor.xiJiStacks--;
            actor.atk = Math.max(1, actor.atk - 2);
            this.log(`[希冀] ${actor.name} 消耗一层，ATK 降至 ${actor.atk}`, "buff");
            team.chars.forEach(ally => {
                if (!ally.isDead && typeof ally.hooks?.onAllyConsumedXiJi === "function") {
                    try {
                        ally.hooks.onAllyConsumedXiJi(this.makeContext(ally, actor, team, this.getOpposingTeam(team), null, "xiJiConsumed"));
                    } catch (e) { console.error(e); }
                }
            });
        }

        // ---------- 我也要玩（每次行动减 1 层） ----------
        if (actor.buffWoYe > 0) actor.buffWoYe--;

        // 递减通用 buff
        if (actor.fearTurns > 0) actor.fearTurns--;
        if (actor.buffTurns > 0) actor.buffTurns--;
        if (actor.domainTurns > 0) actor.domainTurns--;
        if (actor.cannotAct > 0) actor.cannotAct--;
        if (actor.duelRounds > 0) {
            actor.duelRounds--;
            if (actor.duelRounds === 0) actor.duelTarget = null;
        }
        if (actor.darkRoomTurns > 0) {
            actor.darkRoomTurns--;
            if (actor.darkRoomTurns === 0) {
                const src = actor.darkRoomSource;
                if (src && typeof src.hooks?.onDarkRoomClear === "function") {
                    try { src.hooks.onDarkRoomClear(this.makeContext(src, actor, this.getTeamOf(src), team, null, "passive")); }
                    catch (e) { console.error(e); }
                }
                actor.darkRoomDmgTaken = 0;
                actor.darkRoomSource = null;
            }
        }

        this.callHook(actor, "onTurnEnd", { team });

        this.emit("turnEnd", { actor });
    }

    // ---------- 技能执行 ----------
    canUseUltimate(actor, myTeam, enemyTeam) {
        if (enemyTeam.heZongBlockTurns > 0) return false;

        const ult = actor.skills.find(s => s.isUltimate);
        if (!ult) return false;

        const cond = ult.ultimateCondition;
        if (!cond || cond.type === "always") return true;

        if (cond.type === "custom") {
            const fn = actor.hooks[cond.hook];
            return typeof fn === "function"
                ? !!fn(this.makeContext(actor, null, myTeam, enemyTeam, ult, "ultCheck"))
                : false;
        }
        if (cond.type === "damageDealt") return actor.stats.totalDmg >= cond.value;
        return false;
    }

    executeAction(actor, skillKey, target) {
        if (actor.isDead || this.isEnded) return false;

        const myTeam = this.getTeamOf(actor);
        const enemyTeam = this.getOpposingTeam(myTeam);

        let skill = actor.skills.find(s => s.key === skillKey);
        if (!skill) skill = actor.skills[0];

        if (skill.isUltimate && !this.canUseUltimate(actor, myTeam, enemyTeam)) {
            this.log(`[${actor.name}] 大招条件未满足`, "system");
            return false;
        }

        const cost = skill.cost != null ? skill.cost : (skill.isUltimate ? 0 : (skillKey === "basic" ? -1 : 1));
        if (cost === -1) {
            myTeam.skillPoints = Math.min(5, myTeam.skillPoints + 1);
        } else if (cost > 0) {
            if (myTeam.skillPoints < cost) {
                this.log(`[${actor.name}] 技能点不足，改用普攻`, "system");
                return this.executeAction(actor, "basic", target);
            }
            myTeam.skillPoints -= cost;
        }

        if (skill.isUltimate) actor.stats.ults++;

        this.log(`使用【${skill.name}】`, "buff", actor.side);
        this.emit("skillCast", { actor, skill, target });

        this.callHook(actor, "onSkillCast", { team: myTeam, skill, skillKey });

        const ctx = this.makeContext(actor, target, myTeam, enemyTeam, skill, skillKey);
        runEffects(skill.effects || [], ctx);

        if (this.isEnded) return true;

        if (skillKey === "basic") {
            this.callHook(actor, "onBasicAttack", { team: myTeam, skillKey });
        }

        this.callHook(actor, "onSkillEnd", { team: myTeam, skill, skillKey });

        this.emit("skillEnd", { actor, skill, target });
        return true;
    }

    // ---------- 伤害结算 ----------
    dealDamage(actor, target, dmg, targetTeam, actorTeam, opts = {}) {
        if (!target || target.isDead || dmg <= 0) return 0;

        if (opts.isTrue) return this.dealTrueDamage(actor, target, dmg, targetTeam, actorTeam);

        // 我也要玩增伤（层数在 endTurn 递减）
        if (actor && actor.buffWoYe > 0) {
            dmg = Math.round(dmg * 1.2);
            this.log(`[${actor.name}] 触发[我也要玩]，伤害 +20%`, "special");
        }

        // 小黑屋易伤 +10%
        if (target.darkRoomTurns > 0) dmg = Math.round(dmg * 1.10);

        // 减伤叠加
        let reduction = 0;
        if (target.domainTurns > 0) reduction += 0.15;
        if (target.buffTurns > 0) reduction += 0.10;
        if (target.fearTurns > 0) reduction += 0.50;
        if (targetTeam) {
            targetTeam.chars.forEach(ally => {
                if (ally.isDead) return;
                if (typeof ally.hooks?.getTeamDamageReduction === "function") {
                    const r = ally.hooks.getTeamDamageReduction({ char: ally, team: targetTeam });
                    if (typeof r === "number") reduction += r;
                }
            });
        }
        if (reduction > 0) dmg = Math.round(dmg * (1 - Math.min(0.9, reduction)));

        // 领域免疫
        if (target.domainTurns > 0 && this.random() < 0.10) {
            this.log(`[领域] ${target.name} 免疫了伤害`, "special");
            return 0;
        }

        // 护盾
        let absorbed = 0;
        if (target.shield > 0) {
            if (dmg <= target.shield) {
                absorbed = dmg;
                target.shield -= dmg;
                dmg = 0;
            } else {
                absorbed = target.shield;
                dmg -= target.shield;
                target.shield = 0;
            }
        }

        this.recordDamageTaken(target, targetTeam, absorbed + dmg);

        if (dmg <= 0) return 0;

        if (actor) {
            actor.stats.totalDmg += dmg;
            if (typeof actor.hooks?.onDamageDealt === "function") {
                try { actor.hooks.onDamageDealt(this.makeContext(actor, target, actorTeam, targetTeam, null, "dmgDealt")); }
                catch (e) { console.error(e); }
            }
        }

        target.hp -= dmg;
        this.log(
            `${actor ? actor.name : "毒"} -> ${target.name} ${dmg} 伤害 (HP: ${Math.max(0, target.hp)})`,
            opts.isPoison ? "special" : "dmg",
            actor ? actor.side : "?"
        );

        if (target.hp <= 0) {
            this.handleDeath(target, targetTeam, actor, opts.reason || "战斗死亡");
        }

        return dmg;
    }

    dealTrueDamage(actor, target, dmg, targetTeam, actorTeam) {
        if (!target || target.isDead || dmg <= 0) return 0;
        const trueDmg = Math.max(1, Math.round(dmg));

        if (actor) actor.stats.totalDmg += trueDmg;
        this.recordDamageTaken(target, targetTeam, trueDmg);

        target.hp -= trueDmg;
        this.log(`${actor ? actor.name : "?"} -> ${target.name} ${trueDmg} 真伤 (HP: ${Math.max(0, target.hp)})`, "dmg", actor ? actor.side : "?");

        if (target.hp <= 0) {
            this.handleDeath(target, targetTeam, actor, "真伤致死");
        }
        return trueDmg;
    }

    recordDamageTaken(target, team, dmg) {
        if (!target || dmg <= 0) return;
        if (target.darkRoomTurns > 0) target.darkRoomDmgTaken += dmg;
    }

    // ---------- 死亡处理 ----------
    handleDeath(target, targetTeam, killer, reason, opts = {}) {
        if (target.isDead) return;

        let override = null;
        if (typeof target.hooks?.onDeath === "function") {
            try {
                override = target.hooks.onDeath(this.makeContext(target, killer, targetTeam, this.getOpposingTeam(targetTeam), null, "death")) || null;
            } catch (e) { console.error(e); }
        }

        if (override && override.preventDeath && !opts.forceKill) {
            this.log(`[${target.name}] 阻止了死亡`, "special");
            return;
        }

        target.hp = 0;
        target.isDead = true;
        target.stats.deaths++;

        if (!(override && override.noHeartLoss)) {
            targetTeam.hearts = Math.max(0, targetTeam.hearts - 1);
        }

        if (override && override.noRevive) {
            target.reviveRound = 0;
        } else {
            target.reviveRound = this.round + 1;
        }

        this.log(
            `💀 ${target.name} 阵亡 (剩 ${targetTeam.hearts} 心${override?.noHeartLoss ? "，不扣心" : ""}${override?.noRevive ? "，不复活" : ""})`,
            "death",
            target.side
        );

        this.emit("death", { char: target, team: targetTeam, killer, reason });

        if (killer && !killer.isDead) {
            this.callHook(killer, "onKill", { team: this.getTeamOf(killer), victim: target });
        }

        this.checkGameOver();
    }

    executeKill(target, targetTeam, killer, reason) {
        this.handleDeath(target, targetTeam, killer, reason, { forceKill: true });
    }

    revive(c, team) {
        c.isDead = false;
        c.hp = c.maxHp;
        c.atk = c.baseAtk;
        c.shield = 0;
        c.poisonTurns = 0;
        c.poisonSource = null;
        c.darkRoomTurns = 0;
        c.darkRoomSource = null;
        c.darkRoomDmgTaken = 0;
        c.fearTurns = 0;
        c.buffTurns = 0;
        c.cannotAct = 0;
        c.duelRounds = 0;
        c.duelTarget = null;
        const init = c.def.initialState || {};
        for (const k of Object.keys(init)) {
            c[k] = (typeof init[k] === "object" && init[k] !== null)
                ? JSON.parse(JSON.stringify(init[k]))
                : init[k];
        }
        this.log(`✨ ${c.name} 复活`, "heal");
    }

    // ---------- 胜负判定 ----------
    checkGameOver() {
        if (this.isEnded) return;

        const aAlive = this.teamA.getAliveChars().length;
        const bAlive = this.teamB.getAliveChars().length;
        const aHasRevive = this._hasPendingRevive(this.teamA);
        const bHasRevive = this._hasPendingRevive(this.teamB);

        const aDead = aAlive === 0 && !aHasRevive;
        const bDead = bAlive === 0 && !bHasRevive;

        if (aDead && bDead) return this.finish("平局", "双方全灭");
        if (aDead) return this.finish("B", "A 方全灭");
        if (bDead) return this.finish("A", "B 方全灭");

        // 心数到 0 只是"不复活"，不代表输
        // 只有"全灭且无复活"才算死，这里不判
    }

    _hasPendingRevive(team) {
        return team.chars.some(c => c.isDead && c.reviveRound > 0);
    }

    finish(winner, reason) {
        this.isEnded = true;
        this.result = { winner, reason, rounds: this.round };
        this.log(`=== 战斗结束：${winner === "A" ? "A 方胜利" : winner === "B" ? "B 方胜利" : "平局"} (${reason}) ===`, "system");
        this.emit("end", this.result);
    }

    // ---------- 工具 ----------
    callHook(char, hookName, extra = {}) {
        if (typeof char.hooks?.[hookName] !== "function") return;
        try {
            const ctx = this.makeContext(char, null, this.getTeamOf(char), this.getOpposingTeam(this.getTeamOf(char)), null, hookName, extra);
            char.hooks[hookName](ctx);
        } catch (e) {
            console.error(`[core] ${char.name}.${hookName} 错误:`, e);
        }
    }

    makeContext(actor, target, myTeam, enemyTeam, skill, skillKey, extra = {}) {
        const core = this;
        return {
            core,
            actor,
            char: actor,
            target,
            myTeam,
            enemyTeam,
            team: myTeam,
            skill,
            skillKey,
            ...extra,
            log: (m, t) => core.log(m, t),
            rng: () => core.random(),
            dealDamage: (a, t, d, tTeam, aTeam) => core.dealDamage(a, t, d, tTeam, aTeam),
            dealTrueDamage: (a, t, d, tTeam, aTeam) => core.dealTrueDamage(a, t, d, tTeam, aTeam),
            heal: (t, v) => { t.hp = Math.min(t.maxHp, t.hp + v); },
            addShield: (t, v) => { t.shield += v; },
            addBuff: (t, buffs) => {
                Object.keys(buffs).forEach(k => {
                    if (k === "poison") t.poisonTurns = buffs[k];
                    else if (k === "fear") t.fearTurns = buffs[k];
                    else if (k === "cannotAct") t.cannotAct = buffs[k];
                    else if (k === "darkRoom") { t.darkRoomTurns = buffs[k]; t.darkRoomSource = actor; t.darkRoomDmgTaken = 0; }
                    else if (k === "shield") t.shield += buffs[k];
                });
            },
            getEnemies: () => enemyTeam ? enemyTeam.getAliveChars() : [],
            getAllies: () => myTeam ? myTeam.getAliveChars() : [],
        };
    }

    log(msg, type = "info", prefix = "") {
        const fullMsg = prefix ? `[${prefix}] ${msg}` : msg;
        if (this.onLog) this.onLog({ msg: fullMsg, type });
        this.emit("log", { msg: fullMsg, type });
    }
}