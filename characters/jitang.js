CharacterRegistry.register({
    id: "jitang",
    name: "鸡汤",
    hp: 56,
    atk: 6,

    skills: [
        {
            name: "普攻", cost: -1,
            effects: [{ type: "damage", ratio: 1.0, target: "lowest" }]
        },
        {
            name: "毒化", cost: 1,
            effects: [
                { type: "damage", ratio: 0.5, target: "enemyTeam" },
                { type: "poison", turns: 3, target: "enemyTeam" }
            ]
        },
        {
            name: "鸡汤来喽", cost: 1,
            effects: [{ type: "damage", ratio: 1.2, target: "single" }]
        },
        {
            name: "浸泡在十公升的汤里", cost: 0, isUltimate: true,
            ultimateCondition: { type: "custom", hook: "canUltimate" },
            effects: [
                { type: "custom", hook: "ultCost" },
                { type: "custom", hook: "ultDamage" }
            ]
        }
    ],

    passives: [
        { trigger: "turnStart", interval: 3, hook: "onTurnStartHeal" }
    ],

hooks: {
    onTurnStartHeal(ctx) {
        const { team, log } = ctx;
        team.getAliveChars().forEach(ally => {
            ally.hp = Math.min(ally.maxHp, ally.hp + 4);
        });
        log(`[鸡汤] 被动触发，全队回复 4 HP`, "heal");
    },
    canUltimate(ctx) {
        const c = ctx.actor;
        const dealt = (c.stats.totalDmg || 0) - (c.lastUltDmg || 0);
        return dealt >= 70;
    },
    ultCost(ctx) {
        const { actor } = ctx;
        actor.lastUltDmg = actor.stats.totalDmg;
    },
    ultDamage(ctx) {
        const { actor, enemyTeam, myTeam, log, applyDamage, engine } = ctx;
        const enemies = enemyTeam.getAliveChars();
        const currentTurn = engine.turn;
        const historyMap = actor.soupHistory || {};
        let total = 0;
        for (let r = currentTurn - 3; r < currentTurn; r++) {
            total += historyMap[r] || 0;
        }
        const perDmg = enemies.length > 0 ? Math.max(1, Math.round(total * 0.6 / enemies.length)) : 0;
        log(`[鸡汤] 大招[浸泡]：前3轮伤害总和 ${total}，均摊每人 ${perDmg}`, "special");
        enemies.forEach(e => applyDamage(actor, e, perDmg, enemyTeam, myTeam));
        actor.soupHistory = {};
    },
    onDamageDealt(ctx) {
        const { char, dmg, engine, isTrue, isPoison } = ctx;
        if (isTrue || isPoison) return;
        if (!char.soupHistory) char.soupHistory = {};
        char.soupHistory[engine.turn] = (char.soupHistory[engine.turn] || 0) + dmg;
    }
}
});