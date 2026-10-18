CharacterRegistry.register({
    id: "luokong",
    name: "落空",
    hp: 58,
    atk: 4,

    skills: [
        {
            name: "普攻", cost: -1,
            effects: [{ type: "damage", ratio: 0.5, target: "enemyTeam" }]
        },
        {
            name: "希冀不能落空", cost: 1,
            effects: [{ type: "custom", hook: "xiJi" }]
        },
        {
            name: "宝贝回家", cost: 1,
            effects: [
                { type: "damage", ratio: 0.5, target: "single" },
                { type: "custom", hook: "darkRoom" }
            ]
        },
        {
            name: "我们三个真厉害", cost: 0, isUltimate: true,
            ultimateCondition: { type: "custom", hook: "canUltimate" },
            effects: [{ type: "custom", hook: "yaoQi" }]
        }
    ],

    hooks: {
        canUltimate(ctx) {
            return (ctx.actor.shuaiQi || 0) >= 15;
        },
        xiJi(ctx) {
            const { actor, myTeam, log } = ctx;
            const ally = myTeam.getAliveChars().sort((a, b) => a.hp - b.hp)[0];
            if (!ally) return;
            const before = ally.xiJiStacks || 0;
            ally.xiJiStacks = Math.min(2, before + 2);
            ally.atk += (ally.xiJiStacks - before) * 2;
            log(`[落空] ${ally.name} 获得2层[希冀]（ATK+${2 * ally.xiJiStacks}）`, "buff");
        },
        darkRoom(ctx) {
            const { actor, target, log } = ctx;
            if (!target) return;
            target.darkRoomTurns = 2;
            target.darkRoomSource = actor;
            target.darkRoomDmgTaken = 0;
            log(`[落空] ${target.name} 进入小黑屋（易伤 10%，2回合）`, "special");
        },
        onDarkRoomClear(ctx) {
            const { engine, char, target, dmgTaken, log } = ctx;
            const heal = Math.round(dmgTaken * 0.1);
            if (heal > 0) {
                const team = engine._findTeamOf(char);
                team.getAliveChars().forEach(a => a.hp = Math.min(a.maxHp, a.hp + heal));
                log(`[落空] 小黑屋清除，全队回复 ${heal}`, "heal");
            }
            char.shuaiQi = (char.shuaiQi || 0) + 5;
        },
        yaoQi(ctx) {
            const { actor, myTeam, log } = ctx;
            actor.shuaiQi = 0;
            myTeam.getAliveChars().forEach(c => { c.buffWoYe = 2; });
            log(`[落空] 消耗15点耍起，全队获得[我也要玩]`, "special");
        },
        onAllyConsumedXiJi(ctx) {
            ctx.char.shuaiQi = (ctx.char.shuaiQi || 0) + 2;
        },
        onDeath(ctx) {
            const { team, log } = ctx;
            team.getAliveChars().forEach(c => { c.buffTurns = Math.max(c.buffTurns || 0, 2); });
            log(`[落空] 阵亡被动[我相信你]，全队减伤 10%×2回合`, "special");
        }
onLowHpBasicAttack(ctx) {
    const { char, team, engine, log } = ctx;
    if (char.lowHpBasicLastTurn && engine.turn - char.lowHpBasicLastTurn < 3) return;
    char.lowHpBasicLastTurn = engine.turn;
    team.skillPoints = Math.min(5, team.skillPoints + 1);
    log(`[落空] 低血被动触发，额外 +1 技能点`, "buff");
}
    }
});