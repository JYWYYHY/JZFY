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
            name: "墩墩墩墩", cost: 1,
            effects: [{ type: "shield", value: 8, target: "team" }]
        },
        {
            name: "通透世界", cost: 1,
            effects: [{ type: "custom", hook: "domain" }]
        },
        {
            name: "墩子？", cost: 0, isUltimate: true,
            ultimateCondition: { type: "custom", hook: "canUltimate" },
            effects: [{ type: "custom", hook: "atkHomogenize" }]
        }
    ],

    hooks: {
        canUltimate(ctx) {
            return ctx.actor.teamDmgTaken >= 120;
        },
        domain(ctx) {
            const { actor, myTeam, log } = ctx;
            actor.domainTurns = 3;
            myTeam.getAliveChars().forEach(c => { c.shield += 1; });
            log(`[墩子] 展开[通透世界]领域，持续3回合，全队获得1点护盾。`, "special");
        },
        atkHomogenize(ctx) {
            const { actor, enemyTeam, myTeam, log } = ctx;
            actor.teamDmgTaken = 0;
            enemyTeam.getAliveChars().forEach(e => { e.atk = actor.baseAtk; });
            log(`[墩子] 敌方全体攻击力被同化为 ${actor.baseAtk}！`, "special");
            const ally = myTeam.getAliveChars().sort((a, b) => a.hp - b.hp)[0];
            if (ally) {
                ally.shield += 20;
                log(`[墩子] 为 ${ally.name} 提供20点护盾。`, "buff");
            }
        },
        // 致命伤害替死
        onAllyLethal(ctx) {
            const { char, victim, log } = ctx;
            if (char.zunziPassiveUsed) return false;
            char.zunziPassiveUsed = true;
            log(`[墩子] 触发被动[不动明王]，替 ${victim.name} 承受致命伤害！`, "special");
            return true;
        },
        // 队伍级 5% 减伤（引擎通过 getTeamDamageReduction 查询）
        getTeamDamageReduction() {
            return 0.05;
        },
        // 队伍受伤事件（引擎通过 onTeamDamageTaken 通知）
        onTeamDamageTaken(ctx) {
            ctx.char.teamDmgTaken += ctx.dmg;
        }
    }
});