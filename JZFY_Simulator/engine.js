/* ============================================================
 * engine.js  —  与角色解耦版
 *   · 不再出现任何角色名
 *   · 技能效果统一交给 runEffects 分发
 *   · 角色特有机制挂在 character.hooks 上
 *   · 被动挂在 character.passives 上
 *   · 支持真伤、onDamageDealt、handleDeath 返回值、剪云机制
 * ============================================================ */

class Character {
    constructor(defOrName) {
        let def;
        if (typeof defOrName === "string") {
            def = (typeof CharacterRegistry !== "undefined" && CharacterRegistry.get(defOrName))
                || (typeof CHARACTERS !== "undefined" && CHARACTERS[defOrName]);
        } else {
            def = defOrName;
        }
        if (!def) {
            console.error(`[警告] 未找到角色数据:`, defOrName);
            def = { name: String(defOrName), hp: 1, atk: 0, skills: [{ name: "无", cost: 0, effects: [] }] };
        }
        this.def = def;
        this.name = def.name;
        this.maxHp = def.hp;
        this.baseAtk = def.atk;
        this.skills = def.skills || [];
        this.hooks = def.hooks || {};
        this.passives = def.passives || [];
        this.reset();
    }

    reset() {
        this.hp = this.maxHp;
        this.atk = this.baseAtk;
        this.isDead = false;
        this.reviveRound = 0;
        this.shield = 0;
        this.cannotAct = 0;
        this.dmgReduction = 0;
        this.fearTurns = 0;

        this.duelRounds = 0;
        this.duelTarget = null;
        this.hasExtraTurn = false;

        this.poisonTurns = 0;
        this.poisonSource = null;
        this.corrosionCount = 0;
        this.corrosionRecord = 0;
        this.corrosionHistory = [];

        this.xiJiStacks = 0;
        this.shuaiQi = 0;
        this.darkRoomTurns = 0;
        this.darkRoomDmgTaken = 0;
        this.darkRoomSource = null;
        this.buffWoYe = 0;
        this.buffTurns = 0;

        this.domainTurns = 0;
        this.zunziPassiveUsed = false;
        this.teamDmgTaken = 0;

        this._dmgTaken = 0;
        this.ultUsed = false;

        // ---- 鸡汤（大招历史） ----
        this.soupHistory = {};
        this.lastUltDmg = 0;

        // ---- 剪云 ----
        this.jianyunFragments = 0;
        this.adminPrivilege = 0;
        this.xinYueTurns = 0;
        this.marked = false;
        this.offFieldTurns = 0;

        // ---- 素锦 ----
        this.swordSteles = 0;
        this.baoxueActive = 0;
        this.baoxueBurst = 0;
        this.baoxueCooldown = 0;
        this.sujinRevived = false;
        this.sujinHeZongDmg = 0;
        this.sujinHeZongUsed = false;
        this.heZongActive = 0;
        this.heZongBuffTurns = 0;
        this.maxHpDown = 0;
        this.lastAttackTarget = null;
        this.sameTargetHits = 0;

        this.stats = { totalDmg: 0, deaths: 0, ults: 0, turnsAlive: 0 };
    }
}

class Team {
    constructor(id, members, isPlayer, isDummy = false) {
        this.id = id;
        this.isPlayer = isPlayer;
        this.isDummy = isDummy;
        this.chars = members.map(m => new Character(m));
        this.reset();
    }
    reset() {
        this.chars.forEach(c => c.reset());
        this.hearts = 5;
        this.errorHearts = 0;   // 剪云污染心计数
        this.skillPoints = 3;
        this.heZongBlockTurns = 0;
    }
    getAliveEnemies(enemyTeam) { return enemyTeam.chars.filter(c => !c.isDead); }
    getAliveChars() { return this.chars.filter(c => !c.isDead); }
}

class AutoEngine {
    constructor() {
        this.p1 = null;
        this.p2 = null;
        this.turn = 1;
        this.onLog = null;
        this.onUpdateUI = null;
        this.onEnd = null;
        this.interval = null;

        this._seed = null;
        this._rngState = 0;

        this.paused = false;

        // ---- 队伍受伤累积（桃桃大招条件） ----
        this.globalDamageTaken = { red: 0, blue: 0 };
    }

    // ---------- 种子 & 随机 ----------
    setSeed(seed) {
        this._seed = (seed == null) ? null : (seed >>> 0);
        this._rngState = this._seed || 0;
    }
    random() {
        if (this._seed == null) return Math.random();
        this._rngState = (this._rngState * 1664525 + 1013904223) >>> 0;
        return this._rngState / 4294967296;
    }

    // ---------- 暂停 / 恢复 ----------
    pause() {
        if (!this.interval) return;
        this.paused = true;
        this.log("[系统] 战斗已暂停", "system");
        this.updateUI();
    }
    resume() {
        if (!this.interval) return;
        this.paused = false;
        this.log("[系统] 战斗继续", "system");
        this.updateUI();
    }
    isPaused() { return this.paused; }
    isRunning() { return !!this.interval; }

    // ---------- 生命周期 ----------
    init(p1Names, p2Names) {
        this.p1 = new Team("red", p1Names, true);
        this.p2 = new Team("blue", p2Names, false);
        this.turn = 1;
        this.paused = false;
        this.globalDamageTaken = { red: 0, blue: 0 };
        this.log("=== 自动战斗开始 ===", "system");
        this.updateUI();
    }

    start() {
        this.stop();
        this.paused = false;
        this.interval = setInterval(() => {
            if (this.paused) return;
            if (this.p1.hearts <= 0 || this.p2.hearts <= 0) {
                this.stop();
                this.endGame();
                return;
            }
            this.processTurnStart(this.p1);
            this.processTurnStart(this.p2);
            this.executeTurn();
            this.turn++;
            this.processTurnEnd(this.p1);
            this.processTurnEnd(this.p2);
            this.p1.chars.forEach(c => { if (!c.isDead) c.stats.turnsAlive++; });
            this.p2.chars.forEach(c => { if (!c.isDead) c.stats.turnsAlive++; });
            this.updateUI();
        }, 500);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.paused = false;
    }

    // ---------- 队伍查找 ----------
    _opposingTeam(team) {
        if (team === this.p1) return this.p2;
        if (team === this.p2) return this.p1;
        if (this.myTeam && team === this.myTeam) return this.dummyTeam;
        if (this.dummyTeam && team === this.dummyTeam) return this.myTeam;
        return null;
    }

    _findTeamOf(char) {
        if (this.p1 && this.p1.chars.includes(char)) return this.p1;
        if (this.p2 && this.p2.chars.includes(char)) return this.p2;
        if (this.myTeam && this.myTeam.chars.includes(char)) return this.myTeam;
        if (this.dummyTeam && this.dummyTeam.chars.includes(char)) return this.dummyTeam;
        return null;
    }

    // ---------- 回合开始 ----------
    processTurnStart(team) {
        team.chars.forEach(c => {
            if (c.isDead) return;

            // 放逐中：完全跳过回合开始
            if ((c.offFieldTurns || 0) > 0) {
                this.log(`[${c.name}] 放逐中，跳过回合开始结算`, "special");
                return;
            }

            // 被动 turnStart
            c.passives.forEach(p => {
                if (p.trigger !== "turnStart") return;
                const interval = p.interval || 1;
                if (interval > 1 && this.turn % interval !== 0) return;
                const fn = c.hooks[p.hook];
                if (typeof fn === "function") {
                    fn({
                        engine: this, char: c, team, turn: this.turn,
                        log: (m, t) => this.log(m, t),
                        applyDamage: (...a) => this.applyDamage(...a)
                    });
                }
            });

            // 剪云：新月盈满回合回血
            if (typeof c.hooks.onTurnStartXinYue === "function") {
                c.hooks.onTurnStartXinYue({
                    engine: this, char: c, team, turn: this.turn,
                    log: (m, t) => this.log(m, t)
                });
            }

            // 毒伤：走 applyDamage 普通结算
            if (c.poisonTurns > 0 && !c.isDead) {
                const src = c.poisonSource;
                const srcAtk = src ? (src.isDead ? src.baseAtk : src.atk) : 0;
                const pDmg = Math.max(1, Math.round(srcAtk));

                const srcTeam = src ? this._findTeamOf(src) : null;
                const actual = this.applyDamage(src, c, pDmg, team, srcTeam, {
                    isPoison: true,
                    reason: "毒发身亡"
                });

                if (src && typeof src.hooks.onCorrosionDealt === "function" && actual > 0) {
                    src.hooks.onCorrosionDealt({
                        engine: this, char: src, dmg: actual, target: c,
                        log: (m, t) => this.log(m, t)
                    });
                }

                if (!c.isDead) c.poisonTurns--;
            }
        });
    }

    // ---------- 回合结束 ----------
    processTurnEnd(team) {
        team.chars.forEach(c => {
            if (c.isDead) return;

            if (c.domainTurns > 0) c.domainTurns--;

            if (c.duelRounds > 0) {
                c.duelRounds--;
                if (c.duelRounds === 0 && c.duelTarget) {
                    c.duelTarget = null;
                    c.atk = Math.max(c.baseAtk, c.atk - 2);
                    this.log(`[${c.name}] 决斗结束，ATK 回落至 ${c.atk}`, "buff");
                }
            }

            if (c.darkRoomTurns > 0) {
                c.darkRoomTurns--;
                if (c.darkRoomTurns === 0) {
                    const src = c.darkRoomSource;
                    if (src && typeof src.hooks.onDarkRoomClear === "function") {
                        src.hooks.onDarkRoomClear({
                            engine: this, char: src, target: c,
                            dmgTaken: c.darkRoomDmgTaken,
                            log: (m, t) => this.log(m, t)
                        });
                    }
                    c.darkRoomDmgTaken = 0;
                    c.darkRoomSource = null;
                }
            }

            // ---- 素锦：爆血持续与冷却 ----
            if (c.baoxueActive > 0) {
                c.baoxueActive--;
                if (c.baoxueActive === 0) {
                    c.baoxueBurst = 0;
                    c.baoxueCooldown = 2;
                    this.log(`[${c.name}] 爆血结束，进入 2 回合冷却`, "buff");
                }
            }
            // baoxueCooldown 的递减在 onTurnStartSteles 里做

            // ---- 素锦：合纵 buff / 大招禁言倒数 ----
            if (c.heZongBuffTurns > 0) {
                c.heZongBuffTurns--;
                if (c.heZongBuffTurns === 0 && c.name !== "素锦") {
                    c.atk = Math.max(1, c.atk - 4);
                }
            }
            if (c.heZongActive > 0) c.heZongActive--;

            if (c.buffTurns > 0) c.buffTurns--;
            if (c.cannotAct > 0) c.cannotAct--;
        });
    }

    executeTurn() {
        // 错误心递减（每回合一次）
        [this.p1, this.p2].forEach(team => {
            if (!team) return;
            if (team.errorHearts > 0) {
                team.errorHearts--;
                if (team.errorHearts === 0) {
                    this.log(`[系统] ${team.id === 'red' ? '红方' : '蓝方'} 错误心恢复正常`, "system");
                }
            }
            if (team.heZongBlockTurns > 0) team.heZongBlockTurns--;
        });

        this.log(`<span class="log-turn">第 ${this.turn} 回合</span>`, "");
        this.checkRevival(this.p1);
        this.checkRevival(this.p2);

        const actions = [
            { actorTeam: this.p1, actor: this.p1.chars[0], targetTeam: this.p2 },
            { actorTeam: this.p2, actor: this.p2.chars[0], targetTeam: this.p1 },
            { actorTeam: this.p1, actor: this.p1.chars[1], targetTeam: this.p2 },
            { actorTeam: this.p2, actor: this.p2.chars[1], targetTeam: this.p1 },
            { actorTeam: this.p1, actor: this.p1.chars[2], targetTeam: this.p2 },
            { actorTeam: this.p2, actor: this.p2.chars[2], targetTeam: this.p1 }
        ];

        for (const act of actions) {
            if (!act.actor || act.actor.isDead || act.targetTeam.hearts <= 0) continue;

            // 放逐中：跳过并递减
            if ((act.actor.offFieldTurns || 0) > 0) {
                act.actor.offFieldTurns--;
                this.log(`[${act.actor.name}] 放逐中，跳过行动（剩余 ${act.actor.offFieldTurns} 回合）`, "special");
                continue;
            }

            if (act.actor.cannotAct > 0) {
                this.log(`[${act.actor.name}] 无法行动，跳过回合！`, "special");
                continue;
            }

            this.takeAction(act.actorTeam, act.actor, act.targetTeam);
            this.updateUI();
        }
    }

    canUseUltimate(actor, myTeam, enemyTeam) {
    // 合纵禁用
    if (enemyTeam && enemyTeam.heZongBlockTurns > 0) {
        return false;
    }
        const ult = actor.skills.find(s => s.isUltimate);
        if (!ult) return false;
        const cond = ult.ultimateCondition;
        if (!cond || cond.type === "always") return true;
        if (cond.type === "custom") {
            const fn = actor.hooks[cond.hook];
            return typeof fn === "function"
                ? !!fn({ actor, myTeam, enemyTeam, engine: this, log: (m, t) => this.log(m, t) })
                : false;
        }
        if (cond.type === "damageDealt") return actor.stats.totalDmg >= cond.value;
        if (cond.type === "damageTaken") {
            const field = cond.field || "_dmgTaken";
            return (actor[field] || 0) >= cond.value;
        }
        return false;
    }

    takeAction(myTeam, actor, enemyTeam) {
        // 剪云被动：队友行动 +0.5 碎片
        myTeam.chars.forEach(ally => {
            if (ally.isDead || ally === actor) return;
            if (typeof ally.hooks.onAllyAction === "function") {
                ally.hooks.onAllyAction({
                    engine: this, char: ally, actor, team: myTeam,
                    log: (m, t) => this.log(m, t)
                });
            }
        });

        const aliveEnemies = enemyTeam.getAliveChars();
        if (aliveEnemies.length === 0) return;

        let target;
        if (actor.duelTarget && !actor.duelTarget.isDead) {
            target = actor.duelTarget;
        } else {
            const firstEffect = actor.skills[0] && actor.skills[0].effects && actor.skills[0].effects[0];
            const preferHigh = firstEffect && firstEffect.target === "highest";
            target = [...aliveEnemies].sort((a, b) => preferHigh ? b.hp - a.hp : a.hp - b.hp)[0];
        }

        const basic = actor.skills[0];
        const s1 = actor.skills[1];
        const s2 = actor.skills[2];
        const ult = actor.skills.find(s => s.isUltimate);

        let chosenSkill = basic;
        let skillIdx = 0;

        const canUlt = ult && this.canUseUltimate(actor, myTeam, enemyTeam);

        if (canUlt) {
            chosenSkill = ult;
            skillIdx = actor.skills.indexOf(ult);
        } else if (myTeam.skillPoints >= 2) {
            if (this.random() > 0.4 && s2 && myTeam.skillPoints >= (s2.cost || 0)) {
                chosenSkill = s2; skillIdx = 2;
            } else if (s1 && myTeam.skillPoints >= (s1.cost || 0)) {
                chosenSkill = s1; skillIdx = 1;
            }
        }

        const teamName = myTeam.isPlayer ? "红方" : "蓝方";

        if (chosenSkill.cost === -1) {
            myTeam.skillPoints = Math.min(5, myTeam.skillPoints + 1);
            this.log(`[${teamName}] ${actor.name} 使用 [${chosenSkill.name}] (技能点+1)`, "buff");
        } else {
            const cost = chosenSkill.cost || 0;
            if (myTeam.skillPoints >= cost) {
                myTeam.skillPoints -= cost;
                if (chosenSkill.isUltimate) actor.stats.ults++;
                this.log(`[${teamName}] ${actor.name} 使用 [${chosenSkill.name}]`, "buff");
            } else {
                chosenSkill = basic;
                skillIdx = 0;
                myTeam.skillPoints = Math.min(5, myTeam.skillPoints + 1);
                this.log(`[${teamName}] ${actor.name} 技能点不足，改用 [普攻] (技能点+1)`, "buff");
            }
        }

        this.resolveSkillEffect(actor, target, enemyTeam, myTeam, chosenSkill, skillIdx);
    }

    resolveSkillEffect(actor, target, enemyTeam, myTeam, skill, skillIdx) {
        const ctx = {
            actor, target, enemyTeam, myTeam, skill, skillIdx,
            engine: this,
            log: (m, t) => this.log(m, t),
            applyDamage: (...a) => this.applyDamage(...a),
            random: () => this.random(),
            rollDamage: (r) => Math.max(1, Math.round(actor.atk * r)),
            lastDamage: 0,
            lastTargets: []
        };

        if (typeof runEffects === "function") {
            runEffects(skill.effects || [], ctx);
        } else {
            this.log(`[错误] runEffects 未加载，请检查 effect-handlers.js 引入顺序`, "system");
        }

        this._applyOnHitEffects(actor, target, ctx.lastDamage, ctx.lastTargets, enemyTeam, myTeam);
    }

    _applyOnHitEffects(actor, target, dmg, targets, enemyTeam, myTeam) {
        if (dmg <= 0) return;

        if (actor.xiJiStacks > 0) {
            actor.xiJiStacks--;
            actor.atk = Math.max(1, actor.atk - 2);
            this.log(`[希冀] ${actor.name} 消耗一层，ATK 降至 ${actor.atk}`, "buff");

            myTeam.chars.forEach(ally => {
                if (!ally.isDead && typeof ally.hooks.onAllyConsumedXiJi === "function") {
                    ally.hooks.onAllyConsumedXiJi({
                        engine: this, char: ally, consumer: actor, team: myTeam,
                        log: (m, t) => this.log(m, t)
                    });
                }
            });
        }

        if (actor.buffWoYe > 0 && targets && targets.length > 0) {
            actor.buffWoYe--;
            const extraDmg = Math.round(dmg * 0.2);
            const first = targets[0];
            if (extraDmg > 0 && first && !first.isDead) {
                this.log(`[${actor.name}] 触发[我也要玩]，附加 ${extraDmg} 点伤害。`, "special");
                this.applyDamage(actor, first, extraDmg, enemyTeam, myTeam);
            }
        }
    }

    _recordDamageTaken(target, targetTeam, dmg) {
        if (!target || dmg <= 0) return;
        target._dmgTaken = (target._dmgTaken || 0) + dmg;

        // 队伍受伤累积（桃桃大招条件）
        if (targetTeam && this.globalDamageTaken) {
            const key = targetTeam === this.p1 ? 'red' : (targetTeam === this.p2 ? 'blue' : (targetTeam.id === 'red' ? 'red' : 'blue'));
            this.globalDamageTaken[key] = (this.globalDamageTaken[key] || 0) + dmg;
        }

        // 通用通知
        targetTeam.chars.forEach(ally => {
            if (ally.isDead) return;
            if (typeof ally.hooks.onTeamDamageTaken === "function") {
                ally.hooks.onTeamDamageTaken({
                    engine: this, char: ally, team: targetTeam, target, dmg,
                    log: (m, t) => this.log(m, t)
                });
            }
        });

        if (typeof target.hooks.onDamageTaken === "function") {
            target.hooks.onDamageTaken({
                engine: this, char: target, team: targetTeam, dmg,
                log: (m, t) => this.log(m, t)
            });
        }

        if (target.darkRoomTurns > 0) target.darkRoomDmgTaken += dmg;
    }

    // opts: { isPoison, isTrue, reason }
    applyDamage(actor, target, dmg, targetTeam, myTeam, opts = {}) {
        if (!target || dmg <= 0) return 0;

        // ================== 真伤分支 ==================
        if (opts.isTrue) {
            const trueDmg = Math.max(1, Math.round(dmg));

            // 统计
            if (actor) actor.stats.totalDmg += trueDmg;

            // 承伤记录（含 globalDamageTaken）
            this._recordDamageTaken(target, targetTeam, trueDmg);

            // 通知 onDamageDealt
            if (actor && typeof actor.hooks.onDamageDealt === "function") {
                actor.hooks.onDamageDealt({
                    engine: this, char: actor, dmg: trueDmg, target,
                    isTrue: true, isPoison: false,
                    log: (m, t) => this.log(m, t)
                });
            }

// 暴走转移（真伤也生效）
const taoGuard = targetTeam.chars.find(c =>
    c.name === "吃颗桃挑" && !c.isDead && (c.berserkTurns || 0) > 0 && c !== target
);
if (taoGuard) {
    const taoDmg = Math.round(trueDmg * 0.8);
    const restDmg = trueDmg - taoDmg;
    this.log(`[暴走] ${taoGuard.name} 为 ${target.name} 分担 80% 真伤 (${taoDmg})`, "special");
    this._recordDamageTaken(taoGuard, targetTeam, taoDmg);
    taoGuard.hp -= taoDmg;
    if (taoGuard.hp <= 0) this.handleDeath(taoGuard, targetTeam, actor, "暴走分担");
    trueDmg = restDmg;
    if (trueDmg <= 0) return 0;
}

// 致命伤害 → 替死检查（真伤也能触发）
if (target.hp - trueDmg <= 0) {
    const guard = targetTeam.chars.find(c =>
        c !== target && !c.isDead
        && typeof c.hooks.onAllyLethal === "function"
        && !c.zunziPassiveUsed
    );
    if (guard) {
        const replaced = guard.hooks.onAllyLethal({
            engine: this, char: guard, team: targetTeam,
            victim: target, dmg: trueDmg,
            log: (m, t) => this.log(m, t)
        });
        if (replaced) target = guard;
    }
}

            target.hp -= trueDmg;
            const atkName = actor ? actor.name : "?";
            this.log(`[真伤] ${atkName} -> ${target.name} 造成 ${trueDmg} 真伤 (剩余HP: ${Math.max(0, target.hp)})`, "dmg");

            if (target.hp <= 0) this.handleDeath(target, targetTeam, actor, opts.reason || "真伤致死");
            return trueDmg;
        }

        // ================== 普通伤害分支 ==================
        // 小黑屋易伤：1.10
        if (target.darkRoomTurns > 0) dmg = Math.round(dmg * 1.10);

        let reduction = 0;
        targetTeam.chars.forEach(ally => {
            if (ally.isDead) return;
            if (typeof ally.hooks.getTeamDamageReduction === "function") {
                const r = ally.hooks.getTeamDamageReduction({
                    engine: this, char: ally, team: targetTeam
                });
                if (typeof r === "number") reduction += r;
            }
        });

        if (target.domainTurns > 0) reduction += 0.15;
        if (target.buffTurns > 0) reduction += 0.10;
        if (target.fearTurns > 0) reduction += 0.50;
        if (reduction > 0) dmg = Math.round(dmg * (1 - Math.min(0.9, reduction)));

        if (target.domainTurns > 0 && this.random() < 0.10) {
            this.log(`[领域] ${target.name} 免疫了此次伤害！`, "special");
            return 0;
        }

        let absorbed = 0;
        if (target.shield > 0) {
            if (dmg <= target.shield) {
                absorbed = dmg;
                target.shield -= dmg;
                this.log(`[护盾] ${target.name} 的护盾吸收了 ${dmg} 点伤害 (剩余护盾: ${target.shield})`, "buff");
                dmg = 0;
            } else {
                absorbed = target.shield;
                dmg -= target.shield;
                this.log(`[护盾] ${target.name} 的护盾被击破，承受 ${dmg} 点伤害。`, "buff");
                target.shield = 0;
            }
        }

        // 承伤记录（含护盾吸收）
        this._recordDamageTaken(target, targetTeam, absorbed + dmg);

        // 统计
        if (dmg > 0 && actor) {
            actor.stats.totalDmg += dmg;
            if (typeof actor.hooks.onDamageDealt === "function") {
                actor.hooks.onDamageDealt({
                    engine: this, char: actor, dmg, target,
                    isTrue: false, isPoison: opts.isPoison || false,
                    log: (m, t) => this.log(m, t)
                });
            }
        }

        if (dmg <= 0) return 0;

        if (target.hp - dmg <= 0) {
            const guard = targetTeam.chars.find(c =>
                c !== target && !c.isDead
                && typeof c.hooks.onAllyLethal === "function"
                && !c.zunziPassiveUsed
            );
            if (guard) {
                const replaced = guard.hooks.onAllyLethal({
                    engine: this, char: guard, team: targetTeam,
                    victim: target, dmg,
                    log: (m, t) => this.log(m, t)
                });
                if (replaced) target = guard;
            }
        }

        target.hp -= dmg;

        const atkTeamName = myTeam ? (myTeam.isPlayer ? "红方" : "蓝方") : "?";
        const tgtTeamName = targetTeam.isPlayer ? "红方" : "蓝方";

        if (opts.isPoison) {
            this.log(`[毒化] ${target.name} 受到 ${dmg} 点腐蚀伤害 (剩余HP: ${Math.max(0, target.hp)})`, "special");
        } else {
            const actorName = actor ? actor.name : "?";
            this.log(
                `[${atkTeamName}] ${actorName} -> [${tgtTeamName}] ${target.name} 造成 ${dmg} 伤害 (剩余HP: ${Math.max(0, target.hp)})`,
                "dmg"
            );
        }

        if (target.hp <= 0) this.handleDeath(target, targetTeam, actor, opts.reason || "战斗死亡");
        return dmg;
    }

    handleDeath(target, targetTeam, killer, reason) {
    if (target.isDead) return;

    let override = null;
    if (typeof target.hooks.onDeath === "function") {
        const ret = target.hooks.onDeath({
            engine: this, char: target, team: targetTeam, killer, reason,
            log: (m, t) => this.log(m, t)
        });
        if (ret && typeof ret === "object") override = ret;
    }

    // 死亡被拦截（如素锦神碑护主）
    if (override && override.preventDeath) {
        return;
    }

    target.hp = 0;
    target.isDead = true;
    target.stats.deaths++;

    if (!targetTeam.isDummy) {
        if (!(override && override.noHeartLoss)) {
            targetTeam.hearts = Math.max(0, targetTeam.hearts - 1);
        }
        if (override && override.noRevive) {
            target.reviveRound = 0;
        } else {
            target.reviveRound = this.turn + 1;
        }
    }

    const teamName = targetTeam.isPlayer ? "红方" : "蓝方";
    if (!targetTeam.isDummy) {
        if (override && override.noHeartLoss) {
            this.log(`💀 ${target.name} 阵亡（不扣心）`, "death");
        } else {
            this.log(`💀 ${target.name} 阵亡！${teamName}扣除1心 (剩 ${targetTeam.hearts} 心)`, "death");
        }
        if (override && override.noRevive) {
            this.log(`☠️ ${target.name} 不会复活`, "death");
        }
    } else {
        this.log(`💀 ${target.name} 已被击碎！`, "death");
    }
}

    checkRevival(team) {
        team.chars.forEach(char => {
            if (char.isDead && char.reviveRound === this.turn) {
                char.isDead = false;
                char.hp = char.maxHp;
                char.atk = char.baseAtk;
                char.shield = 0;
                char.xiJiStacks = 0;
                char.buffTurns = 0;
                char.buffWoYe = 0;
                char.poisonTurns = 0;
                char.poisonSource = null;
                char.darkRoomTurns = 0;
                char.darkRoomSource = null;
                char.darkRoomDmgTaken = 0;
                // 清剪云字段
                char.jianyunFragments = 0;
                char.adminPrivilege = 0;
                char.xinYueTurns = 0;
                char.marked = false;
                char.offFieldTurns = 0;
                // 清素锦字段（sujinRevived 不清，神碑护主终身一次）
                char.swordSteles = 0;
                char.baoxueActive = 0;
                char.baoxueBurst = 0;
                char.baoxueCooldown = 0;
                char.heZongBuffTurns = 0;
                char.heZongActive = 0;
                char.maxHpDown = 0;
                char.lastAttackTarget = null;
                char.sameTargetHits = 0;
                // 合纵是每条命一次，复活后重置
                char.sujinHeZongUsed = false;
                char.sujinHeZongDmg = 0;
                this.log(`✨ [${team.id === "red" ? "红方" : "蓝方"}] ${char.name} 复活。`, "heal");
            }
        });
    }

    endGame() {
        let winner = "平局";
        if (this.p1.hearts > this.p2.hearts) winner = "红方胜利";
        else if (this.p2.hearts > this.p1.hearts) winner = "蓝方胜利";
        else winner = "平局";
        this.log(`=== 战斗结束, 结果: ${winner} (总计 ${this.turn} 回合) ===`, "system");
        if (this.onEnd) this.onEnd(winner, this.turn);
    }

    // ---------- 批量模拟 ----------
    batchSimulate(p1Names, p2Names, rounds = 100, baseSeed = null, maxTurns = 999) {
        const seed0 = (baseSeed == null || isNaN(baseSeed)) ? (Date.now() >>> 0) : (baseSeed >>> 0);

        const results = {
            rounds, seed: seed0,
            redWin: 0, blueWin: 0, draw: 0,
            totalTurns: 0, minTurns: Infinity, maxTurns: 0,
            redChars: {}, blueChars: {}
        };

        p1Names.forEach(n => { results.redChars[n] = { totalDmg: 0, deaths: 0, ults: 0, turnsAlive: 0 }; });
        p2Names.forEach(n => { results.blueChars[n] = { totalDmg: 0, deaths: 0, ults: 0, turnsAlive: 0 }; });

        const t0 = performance.now();

        for (let i = 0; i < rounds; i++) {
            const eng = new AutoEngine();
            eng.setSeed((seed0 + i) >>> 0);
            eng.onLog = null;
            eng.onUpdateUI = null;
            eng.onEnd = null;
            eng.init(p1Names, p2Names);

            let safety = 0;
            while (eng.p1.hearts > 0 && eng.p2.hearts > 0 && safety < maxTurns) {
                eng.processTurnStart(eng.p1);
                eng.processTurnStart(eng.p2);
                eng.executeTurn();
                eng.turn++;
                eng.processTurnEnd(eng.p1);
                eng.processTurnEnd(eng.p2);
                eng.p1.chars.forEach(c => { if (!c.isDead) c.stats.turnsAlive++; });
                eng.p2.chars.forEach(c => { if (!c.isDead) c.stats.turnsAlive++; });
                safety++;
            }

            if (eng.p1.hearts > eng.p2.hearts) results.redWin++;
            else if (eng.p2.hearts > eng.p1.hearts) results.blueWin++;
            else results.draw++;

            results.totalTurns += eng.turn;
            results.minTurns = Math.min(results.minTurns, eng.turn);
            results.maxTurns = Math.max(results.maxTurns, eng.turn);

            const acc = (stats, chars) => {
                chars.forEach(c => {
                    if (!stats[c.name]) return;
                    stats[c.name].totalDmg += c.stats.totalDmg;
                    stats[c.name].deaths += c.stats.deaths;
                    stats[c.name].ults += c.stats.ults;
                    stats[c.name].turnsAlive += c.stats.turnsAlive;
                });
            };
            acc(results.redChars, eng.p1.chars);
            acc(results.blueChars, eng.p2.chars);
        }

        results.elapsedMs = Math.round(performance.now() - t0);
        results.avgTurns = (results.totalTurns / rounds).toFixed(1);
        results.redWinRate = (results.redWin / rounds * 100).toFixed(1) + "%";
        results.blueWinRate = (results.blueWin / rounds * 100).toFixed(1) + "%";
        results.drawRate = (results.draw / rounds * 100).toFixed(1) + "%";

        const avgStats = (stats) => {
            Object.keys(stats).forEach(name => {
                const s = stats[name];
                s.avgDmg = (s.totalDmg / rounds).toFixed(1);
                s.avgDeaths = (s.deaths / rounds).toFixed(2);
                s.avgUlts = (s.ults / rounds).toFixed(2);
                s.avgDps = s.turnsAlive > 0 ? (s.totalDmg / s.turnsAlive).toFixed(1) : "0.0";
            });
        };
        avgStats(results.redChars);
        avgStats(results.blueChars);

        return results;
    }

    log(msg, type = "info") {
        if (this.onLog) this.onLog({ msg, type });
    }

    updateUI() {
        if (this.onUpdateUI) this.onUpdateUI(this);
    }
}

/* ============================================================
 * 手动打木桩引擎
 * ============================================================ */
class ManualEngine extends AutoEngine {
    constructor() {
        super();
        this.myTeam = null;
        this.dummyTeam = null;
        this.turn = 1;
        this.currentActorIndex = 0;
        this.targetIndex = 0;
    }

    init(playerNames, dummyCount, dummyHp) {
        const validPlayers = playerNames.filter(n => n && n !== "无" && CHARACTERS[n]);
        this.myTeam = new Team("red", validPlayers, true);

        const dummyNames = [];
        for (let i = 1; i <= dummyCount; i++) {
            const dName = `木桩${i}`;
            dummyNames.push(dName);
            CHARACTERS[dName] = {
                name: dName, hp: dummyHp, atk: 0,
                skills: [{ name: "无", cost: 0, effects: [] }]
            };
        }

        this.dummyTeam = new Team("blue", dummyNames, false, true);
        this.turn = 1;
        this.currentActorIndex = 0;
        this.targetIndex = 0;
        this._ended = false;
        this.globalDamageTaken = { red: 0, blue: 0 };
        this.log("=== 手动测试模式开始 ===", "system");
        this.updateUI();
    }

    _opposingTeam(team) {
        if (team === this.myTeam) return this.dummyTeam;
        if (team === this.dummyTeam) return this.myTeam;
        return null;
    }

    getCurrentActor() {
        const alive = this.myTeam.getAliveChars();
        if (alive.length === 0) return null;
        return alive[this.currentActorIndex % alive.length];
    }

    selectTarget(idx) {
        this.targetIndex = idx;
        this.updateUI();
    }

    setDummyConfig(count, hp) {
        const dummyNames = [];
        for (let i = 1; i <= count; i++) {
            const dName = `木桩${i}`;
            dummyNames.push(dName);
            CHARACTERS[dName] = {
                name: dName, hp: hp, atk: 0,
                skills: [{ name: "无", cost: 0, effects: [] }]
            };
        }
        this.dummyTeam = new Team("blue", dummyNames, false, true);
        if (this.targetIndex >= this.dummyTeam.chars.length) this.targetIndex = 0;
        this.log(`[系统] 已重置木桩：${count} 个，每个 ${hp} HP`, "system");
        this.updateUI();
    }

    resetStats() {
        const clear = (team) => {
            if (!team) return;
            team.chars.forEach(c => {
                c.stats.totalDmg = 0;
                c.stats.deaths = 0;
                c.stats.ults = 0;
                c.stats.turnsAlive = 0;
            });
        };
        clear(this.myTeam);
        clear(this.dummyTeam);
        this.turn = 1;
        this.currentActorIndex = 0;
        this._ended = false;
        this.globalDamageTaken = { red: 0, blue: 0 };
        this.log(`[系统] 统计数据已重置，回合数归零`, "system");
        this.updateUI();
    }

    nextTurn() {
        if (!this.myTeam) return;
        this.currentActorIndex++;
        const aliveCount = this.myTeam.getAliveChars().length;
        if (aliveCount === 0) return;

        if (this.currentActorIndex >= aliveCount) {
            this.currentActorIndex = 0;
            this.processTurnEnd(this.myTeam);
            this.processTurnEnd(this.dummyTeam);
            this.turn++;
            this.checkRevival(this.myTeam);
            this.checkRevival(this.dummyTeam);

            // 错误心 / 合纵禁言递减
            [this.myTeam, this.dummyTeam].forEach(team => {
                if (team.errorHearts > 0) {
                    team.errorHearts--;
                    if (team.errorHearts === 0) {
                        this.log(`[系统] ${team.id === 'red' ? '红方' : '蓝方'} 错误心恢复正常`, "system");
                    }
                }
                if (team.heZongBlockTurns > 0) team.heZongBlockTurns--;
            });

            this.processTurnStart(this.myTeam);
            this.processTurnStart(this.dummyTeam);
            this.log(`<span class="log-turn">-- 进入第 ${this.turn} 回合 --</span>`, "");
        }

        const allDummyDead = this.dummyTeam.chars.every(c => c.isDead);
        const allPlayerDead = this.myTeam.getAliveChars().length === 0;
        if ((allDummyDead || allPlayerDead) && !this._ended) {
            this._ended = true;
            this.log(`=== 手动测试结束：${allPlayerDead ? "玩家全灭" : "木桩击破"} ===`, "system");
        }
        this.updateUI();
    }

    executeManualSkill(skillIdx) {
        const actor = this.getCurrentActor();
        if (!actor) return;

        const skill = actor.skills[skillIdx];
        if (!skill) return;

        if (skill.isUltimate && !this.canUseUltimate(actor, this.myTeam, this.dummyTeam)) {
            this.log(`[${actor.name}] 大招条件未满足，无法释放！`, "system");
            return;
        }

        const alive = this.dummyTeam.getAliveChars();
        if (alive.length === 0) {
            this.log("所有木桩已被击碎，请重置。", "system");
            return;
        }

        let target = this.dummyTeam.chars[this.targetIndex];
        if (!target || target.isDead) target = alive[0];

        if (skill.cost === -1) {
            this.myTeam.skillPoints = Math.min(5, this.myTeam.skillPoints + 1);
        } else {
            const cost = skill.cost || 0;
            if (this.myTeam.skillPoints >= cost) {
                this.myTeam.skillPoints -= cost;
                if (skill.isUltimate) actor.stats.ults++;
            } else {
                this.log(`技能点不足！`, "system");
                return;
            }
        }

        this.log(`[玩家] ${actor.name} 使用 [${skill.name}]`, "buff");

        // 触发队友 onAllyAction
        this.myTeam.chars.forEach(ally => {
            if (ally.isDead || ally === actor) return;
            if (typeof ally.hooks.onAllyAction === "function") {
                ally.hooks.onAllyAction({
                    engine: this, char: ally, actor, team: this.myTeam,
                    log: (m, t) => this.log(m, t)
                });
            }
        });

        this.resolveSkillEffect(actor, target, this.dummyTeam, this.myTeam, skill, skillIdx);
        this.nextTurn();
        this.updateUI();
    }
}