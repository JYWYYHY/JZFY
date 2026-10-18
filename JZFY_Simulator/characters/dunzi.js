CharacterRegistry.register({
    id: "dunzi",
    name: "墩子",
    hp: 72,
    atk: 2,

    skills: [
        {
            name: "普攻", cost: -1,
            effects: [{ type: "damage", ratio: 1.0, target: "lowest" }]
        },
        {
            name: "墩↗墩↘墩↗墩↘", cost: 1,
            effects: [{ type: "shield", value: 6, target: "team" }]
        },
        {
            name: "通透世界", cost: 1,
            effects: [{ type: "custom", hook: "domain" }]
        },
        {
            name: "墩子？墩子。墩子！", cost: 0, isUltimate: true,
            ultimateCondition: { type: "custom", hook: "canUltimate" },
            effects: [{ type: "custom", hook: "atkHomogenize" }]
        }
    ],

    hooks: {
        canUltimate(ctx) {
            return (ctx.actor.teamDmgTaken || 0) >= 120;
        },
        domain(ctx) {
            const { actor, myTeam, log } = ctx;
            actor.domainTurns = 3;
            myTeam.getAliveChars().forEach(c => { c.shield += 1; });
            log(`[墩子] 展开[通透世界]，持续3回合，全队获1点护盾`, "special");
        },
        atkHomogenize(ctx) {
            const { actor, enemyTeam, myTeam, target, log } = ctx;
            actor.teamDmgTaken = 0;
            enemyTeam.getAliveChars().forEach(e => {
                e.atk = actor.atk;
                e.baseAtk = actor.atk;
            });
            log(`[墩子] 敌方全体 ATK 降至 ${actor.atk}`, "special");
            if (target) {
                target.shield += 20;
                log(`[墩子] 为 ${target.name} 提供20点护盾`, "buff");
            }
        },
        onAllyLethal(ctx) {
            const { char, victim, log } = ctx;
            if (char.zunziPassiveUsed) return false;
            char.zunziPassiveUsed = true;
            log(`[墩子] 触发[不动明王]，替 ${victim.name} 承受致命伤害`, "special");
            return true;
        },
        getTeamDamageReduction() {
            return 0.05;
        },
        onTeamDamageTaken(ctx) {
            ctx.char.teamDmgTaken += ctx.dmg;
        }
    }
});