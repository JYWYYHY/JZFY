CharacterRegistry.register({
    id: "gge",
    name: "G哥",
    hp: 48,
    atk: 8,

    skills: [
        {
            name: "普攻", cost: -1,
            effects: [
                { type: "damage", ratio: 1.0, target: "lowest" },
                { type: "custom", hook: "checkExtraTurn" }
            ]
        },
        {
            name: "来单", cost: 1,
            effects: [
                { type: "custom", hook: "enterDuel" },
                { type: "damage", ratio: 0.5, target: "single" },
                { type: "custom", hook: "checkExtraTurn" }
            ]
        },
        {
            name: "肘飞来", cost: 1,
            effects: [
                { type: "damage", ratio: 1.2, target: "single" },
                { type: "custom", hook: "checkExtraTurn" }
            ]
        },
        {
            name: "燃尽了", cost: 0, isUltimate: true,
            ultimateCondition: { type: "custom", hook: "canBurnout" },
            effects: [
                { type: "custom", hook: "burnoutCost" },
                { type: "damage", ratio: 4.0, target: "single" },
                { type: "heal", value: 8, target: "team" },
                { type: "custom", hook: "burnoutOverflow" },
                { type: "custom", hook: "checkExtraTurn" }
            ]
        }
    ],

    hooks: {
        // 大招条件：累积造成 72 伤害 或 累积受到 64 伤害
        // 造成伤害用 stats.totalDmg 差值（上次大招时的快照 = lastUltDmg）
        canBurnout(ctx) {
            const c = ctx.actor;
            const dealt = (c.stats.totalDmg || 0) - (c.lastUltDmg || 0);
            const taken = c.ggeDmgTaken || 0;
            return dealt >= 72 || taken >= 64;
        },

        // 来单：进入决斗
        enterDuel(ctx) {
            const { actor, target, log } = ctx;
            if (!target) return;
            actor.duelTarget = target;
            actor.duelRounds = 4;
            actor.atk += 2;
            log(`[G哥] 进入决斗状态，ATK提升至 ${actor.atk}`, "buff");
        },

        // 燃尽了：降血、清空计数
        burnoutCost(ctx) {
            const { actor, log } = ctx;
            actor.lastUltDmg = actor.stats.totalDmg;   // 快照当前累积伤害
            actor.ggeDmgTaken = 0;                     // 清空受伤计数
            if (actor.hp > 5) actor.hp = 5;
            log(`[G哥] 释放大招[燃尽了]，生命值降低至5点！`, "special");
        },

        // 燃尽了：溢出伤害 50% 分摊
        burnoutOverflow(ctx) {
            const { actor, enemyTeam, myTeam, lastTargets, lastDamage, log, applyDamage } = ctx;
            const target = lastTargets && lastTargets[0];
            if (!target || !target.isDead) return;
            const overkill = (lastDamage || 0) - target.maxHp;
            if (overkill <= 0) return;
            const aoe = Math.round(overkill * 0.5);
            if (aoe <= 0) return;
            log(`[G哥] 大招溢出 ${overkill}，对敌方全体造成 ${aoe} 点分摊伤害！`, "special");
            enemyTeam.getAliveChars().forEach(e =>
                applyDamage(actor, e, aoe, enemyTeam, myTeam)
            );
        },

        // 再来再来：决斗期击杀 → 回5血 + 额外回合
        checkExtraTurn(ctx) {
            const { actor, engine, enemyTeam, myTeam, lastTargets, log } = ctx;
            if (actor.duelRounds <= 0 || actor.hasExtraTurn) return;
            const target = lastTargets && lastTargets[0];
            if (!target || !target.isDead) return;

            actor.hasExtraTurn = true;
            actor.hp = Math.min(actor.maxHp, actor.hp + 5);
            log(`[G哥] 触发被动[再来再来]，回复5血并获得额外回合！`, "buff");
            try {
                engine.takeAction(myTeam, actor, enemyTeam);
            } finally {
                actor.hasExtraTurn = false;
            }
        },

        // 被击杀：决斗敌 ATK-2
        onDeath(ctx) {
            const { char, log } = ctx;
            if (char.duelTarget && !char.duelTarget.isDead) {
                char.duelTarget.atk = Math.max(1, char.duelTarget.atk - 2);
                log(`[G哥] 阵亡，决斗敌方(${char.duelTarget.name}) ATK降低2点。`, "death");
            }
        },

        // 受伤：累积 ggeDmgTaken，供大招条件使用
        onDamageTaken(ctx) {
            const { char, dmg } = ctx;
            char.ggeDmgTaken = (char.ggeDmgTaken || 0) + dmg;
        }
    }
});