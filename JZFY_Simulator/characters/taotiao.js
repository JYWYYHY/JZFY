CharacterRegistry.register({
    id: "taotiao",
    name: "吃颗桃挑",
    hp: 69,
    atk: 0,

    skills: [
        {
            name: "普攻", cost: -1,
            effects: [{ type: "custom", hook: "basicPercent" }]
        },
        {
            name: "血潮", cost: 1,
            effects: [{ type: "custom", hook: "bloodTide" }]
        },
        {
            name: "吃个桃桃(形态一)", cost: 1,
            effects: [{ type: "custom", hook: "taoForm1" }]
        },
        {
            name: "狂欢之夜", cost: 0, isUltimate: true,
            ultimateCondition: { type: "custom", hook: "canUltimate" },
            effects: [{ type: "custom", hook: "carnival" }]
        }
    ],

    hooks: {
        basicPercent(ctx) {
            const { actor, target, enemyTeam, myTeam, applyDamage } = ctx;
            if (!target) return;
            const dmg = Math.max(1, Math.round(target.hp * 0.1));
            applyDamage(actor, target, dmg, enemyTeam, myTeam);
        },
        bloodTide(ctx) {
            const { actor, myTeam, log } = ctx;
            actor.hp = Math.max(1, actor.hp - 10);
            myTeam.getAliveChars().forEach(c => {
                c.hp = Math.min(c.maxHp, c.hp + 15);
            });
            log(`[吃颗桃挑] 血潮：扣自身10血，全队回15血`, "heal");
        },
        taoForm1(ctx) {
            const { actor, enemyTeam, myTeam, applyDamage, log } = ctx;
            actor.hp = Math.max(1, actor.hp - 10);
            enemyTeam.getAliveChars().forEach(e => {
                applyDamage(actor, e, 5, enemyTeam, myTeam);
            });
            log(`[吃颗桃挑] 形态一：扣自身10血，敌全体5真伤`, "special");
        },
        canUltimate(ctx) {
            const { engine, actor } = ctx;
            const team = engine._findTeamOf(actor);
            const sideId = team ? team.id : null;
            return sideId && (engine.globalDamageTaken?.[sideId] || 0) >= 91;
        },
        carnival(ctx) {
            const { actor, enemyTeam, log } = ctx;
            actor.hp = Math.min(actor.maxHp, 30);
            enemyTeam.skillPoints = 0;
            enemyTeam.getAliveChars().forEach(e => {
                e.fearTurns = 2;
            });
            log(`[吃颗桃挑] 狂欢之夜：自身变30血，敌方技能点清零，施加2轮恐惧`, "special");
        }
    }
});