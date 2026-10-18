CharacterRegistry.register({
    id: "sujin",
    name: "素锦",
    hp: 56,
    atk: 7,

    skills: [
        {
            name: "普攻", cost: -1,
            effects: [{ type: "custom", hook: "basicStrike" }]
        },
        {
            name: "王座", cost: 1,
            effects: [
                { type: "damage", ratio: 0.6, target: "same" },
                { type: "custom", hook: "throne" }
            ]
        },
        {
            name: "爆血", cost: 1,
            effects: [{ type: "custom", hook: "baoXue" }]
        },
        {
            name: "合纵", cost: 0, isUltimate: true,
            ultimateCondition: { type: "custom", hook: "canUltimate" },
            effects: [{ type: "custom", hook: "heZong" }]
        }
    ],

    passives: [
        { trigger: "turnStart", interval: 1, hook: "onTurnStartSteles" },
        { trigger: "turnStart", interval: 1, hook: "onTurnStartHeal" }
    ],

    hooks: {
        // ---------- 普攻：优先最高血 + 连击额外 3 真伤 ----------
        basicStrike(ctx) {
            const { actor, enemyTeam, myTeam, applyDamage, log } = ctx;
            const enemies = enemyTeam.getAliveChars();
            if (enemies.length === 0) return;
            const target = [...enemies].sort((a, b) => b.hp - a.hp)[0];

            applyDamage(actor, target, Math.max(1, Math.round(actor.atk * 1.0)), enemyTeam, myTeam);

            // 连击判定
            if (actor.lastAttackTarget === target.name) {
                actor.sameTargetHits = (actor.sameTargetHits || 0) + 1;
            } else {
                actor.lastAttackTarget = target.name;
                actor.sameTargetHits = 1;
            }
            if (actor.sameTargetHits >= 2 && !target.isDead) {
                log(`[素锦] 连击！对 ${target.name} 额外造成 3 点真伤`, "special");
                applyDamage(actor, target, 3, enemyTeam, myTeam, { isTrue: true });
                actor.sameTargetHits = 0;
            }
        },

        // ---------- 王座：降血上限 2，最多 6 ----------
        throne(ctx) {
            const { actor, target, log } = ctx;
            if (!target) return;
            const currentDown = target.maxHpDown || 0;
            if (currentDown >= 6) {
                log(`[素锦] ${target.name} 的血量上限已降至最低`, "buff");
                return;
            }
            const down = Math.min(2, 6 - currentDown);
            target.maxHpDown = currentDown + down;
            target.maxHp = Math.round(target.maxHp - down);
            if (target.hp > target.maxHp) target.hp = target.maxHp;
            log(`[素锦] 王座：${target.name} 血量上限 -${down}（累计 ${target.maxHpDown}/6）`, "special");
        },

        // ---------- 爆血：爆 1-3 座剑碑 ----------
        baoXue(ctx) {
            const { actor, log, random } = ctx;
            const steles = actor.swordSteles || 0;
            if (steles <= 0) {
                log(`[素锦] 无剑碑可爆`, "system");
                return;
            }
            const maxBurst = Math.min(3, steles);
            const numBurst = Math.max(1, Math.ceil(random() * maxBurst));
            actor.swordSteles = steles - numBurst;
            actor.baoxueActive = 3;
            actor.baoxueBurst = numBurst;
            actor.baoxueCooldown = 0;
            log(`[素锦] 爆血：爆开${numBurst}座剑碑，ATK +${numBurst * 2}（持续3回合）`, "special");
        },

        // ---------- 合纵：全队 +4 ATK，敌方禁用大招 ----------
        canUltimate(ctx) {
            const c = ctx.actor;
            return (c.sujinHeZongDmg || 0) >= 72 && !c.sujinHeZongUsed;
        },
        heZong(ctx) {
            const { actor, myTeam, enemyTeam, log } = ctx;
            actor.sujinHeZongUsed = true;
            actor.sujinHeZongDmg = 0;
            actor.heZongActive = 2;
            enemyTeam.heZongBlockTurns = 2;

            myTeam.getAliveChars().forEach(c => {
                c.heZongBuffTurns = 2;
                if (c !== actor) {
                    c.atk = Math.round((c.atk || 0) + 4);
                }
            });
            log(`[素锦] 合纵！全队 ATK+4 持续2回合，敌方禁用大招`, "special");
        },

        // ---------- 被动：回合开始生成剑碑 ----------
        onTurnStartSteles(ctx) {
            const { char, engine, log } = ctx;
            const team = engine._findTeamOf(char);
            // 触发神碑护主后，只有3心及以下才能继续生成
            if (char.sujinRevived && team && team.hearts > 3) return;
            // 爆血期间不可生成
            if ((char.baoxueActive || 0) > 0) return;
            // 爆血冷却期
            if ((char.baoxueCooldown || 0) > 0) {
                char.baoxueCooldown--;
                return;
            }
            if ((char.swordSteles || 0) < 7) {
                char.swordSteles = (char.swordSteles || 0) + 1;
                log(`[素锦] 生成1座剑碑（共${char.swordSteles}座）`, "buff");
            }
        },

        // ---------- 被动：回合开始按剑碑回血 ----------
        onTurnStartHeal(ctx) {
            const { char, log } = ctx;
            const steles = char.swordSteles || 0;
            if (steles <= 0) return;
            const heal = steles * 2;
            char.hp = Math.min(char.maxHp, char.hp + heal);
            log(`[素锦] 剑碑回血 ${heal}`, "heal");
        },

        // ---------- 被动：神碑护主（死亡拦截） ----------
        onDeath(ctx) {
            const { char, log } = ctx;
            if (char.sujinRevived) return null;
            const steles = char.swordSteles || 0;
            if (steles <= 0) return null;

            const reviveHp = steles * 5;
            char.swordSteles = 0;
            char.baoxueActive = 0;
            char.baoxueBurst = 0;
            char.baoxueCooldown = 2;
            char.sujinRevived = true;
            char.sujinHeZongDmg = 0;
            char.sujinHeZongUsed = false;
            char.hp = Math.min(char.maxHp, reviveHp);

            log(`[素锦] 神碑护主！${steles}座剑碑碎裂，复活并回复 ${reviveHp} 点HP`, "special");
            return { preventDeath: true };
        },

        // ---------- 合纵伤害累积（在 applyDamage 里每段命中触发） ----------
        onDamageDealt(ctx) {
            const { char, dmg, isTrue, isPoison } = ctx;
            if (char.sujinHeZongUsed) return;
            if (isPoison) return;
            char.sujinHeZongDmg = (char.sujinHeZongDmg || 0) + dmg;
        }
    }
});