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
                { type: "damage", ratio: 0.5, target: "same" },
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
                { type: "damage", ratio: 4.0, target: "same" },
                { type: "custom", hook: "burnoutOverflow" },
                { type: "heal", value: 8, target: "team" }
            ]
        }
    ],

    hooks: {
        canBurnout(ctx) {
            const c = ctx.actor;
            return (c.ggeDmgDealt || 0) >= 72 || (c.ggeDmgTaken || 0) >= 64;
        },
        enterDuel(ctx) {
            const { actor, target, log } = ctx;
            if (!target || actor.duelRounds > 0) return;
            actor.duelTarget = target;
            actor.duelRounds = 4;
            actor.atk += 2;
            log(`[G哥] 进入决斗，ATK 提升至 ${actor.atk}`, "buff");
        },
        burnoutCost(ctx) {
            const { actor, log } = ctx;
            actor.ggeDmgDealt = 0;
            actor.ggeDmgTaken = 0;
            if (actor.hp > 5) actor.hp = 5;
            log(`[G哥] 释放[燃尽了]，生命降至5点`, "special");
        },
        burnoutOverflow(ctx) {
            const { actor, enemyTeam, myTeam, lastTargets, lastDamage, log, applyDamage } = ctx;
            const target = lastTargets && lastTargets[0];
            if (!target || !target.isDead) return;
            const overkill = (lastDamage || 0) - target.maxHp;
            if (overkill <= 0) return;
            const aoe = Math.round(overkill * 0.5);
            if (aoe <= 0) return;
            log(`[G哥] 大招溢出 ${overkill}，全体分摊 ${aoe}`, "special");
            enemyTeam.getAliveChars().forEach(e => applyDamage(actor, e, aoe, enemyTeam, myTeam));
        },
        checkExtraTurn(ctx) {
            const { actor, engine, enemyTeam, myTeam, lastTargets, log } = ctx;
            if (actor.duelRounds <= 0 || actor.hasExtraTurn) return;
            const target = lastTargets && lastTargets[0];
            if (!target || !target.isDead) return;
            actor.hasExtraTurn = true;
            actor.hp = Math.min(actor.maxHp, actor.hp + 5);
            log(`[G哥] 被动[再来再来]触发，回复5血并获得额外回合`, "buff");
            try { engine.takeAction(myTeam, actor, enemyTeam); }
            finally { actor.hasExtraTurn = false; }
        },
        onDeath(ctx) {
            const { char, log } = ctx;
            if (char.duelTarget && !char.duelTarget.isDead) {
                char.duelTarget.atk = Math.max(1, char.duelTarget.atk - 2);
                log(`[G哥] 阵亡，决斗敌方 ATK-2`, "death");
            }
        },
        onDamageTaken(ctx) {
            const { char, dmg } = ctx;
            char.ggeDmgTaken = (char.ggeDmgTaken || 0) + dmg;
        }
    }
});