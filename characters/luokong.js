/* ============================================================
 * characters/luokong.js  —  落空
 * ============================================================ */

CharacterRegistry.register({
    id: "luokong",
    name: "落空",
    hp: 58,
    atk: 4,

    initialState: {
        shuaiQi: 0,
        _lowHpBasicLastTurn: 0,
    },

    skills: [
        {
            name: "普攻", cost: -1,
            targetType: "enemyTeam",
            effects: [{ type: "damage", ratio: 0.5, target: "enemyTeam" }]
        },
        {
            name: "希冀不能落空", cost: 1,
            targetType: "ally",
            effects: [{ type: "custom", hook: "xiJi" }]
        },
        {
            name: "宝贝回家", cost: 1,
            targetType: "single",
            effects: [
                { type: "damage", ratio: 0.5, target: "single" },
                { type: "custom", hook: "darkRoom" }
            ]
        },
        {
            name: "我们三个真厉害", cost: 0, isUltimate: true,
            targetType: "self",
            ultimateCondition: { type: "custom", hook: "canUltimate" },
            effects: [{ type: "custom", hook: "yaoQi" }]
        }
    ],

    hooks: {
        canUltimate(ctx) {
            return (ctx.actor.shuaiQi || 0) >= 15;
        },

        // 希冀：给血量最低的队友施加 2 层
        xiJi(ctx) {
            const { actor, target, myTeam, core } = ctx;
            const ally = target && !target.isDead
                ? target
                : myTeam.getAliveChars().sort((a, b) => a.hp - b.hp)[0];
            if (!ally) return;

            const before = ally.xiJiStacks || 0;
            ally.xiJiStacks = Math.min(2, before + 2);
            ally.atk += (ally.xiJiStacks - before) * 2;

            core.log(`[落空] 为 ${ally.name} 施加希冀（${ally.xiJiStacks} 层，ATK+${2 * ally.xiJiStacks}）`, "buff");
        },

        // 宝贝回家：伤害 + 小黑屋
        darkRoom(ctx) {
            const { actor, target, core } = ctx;
            if (!target || target.isDead) return;
            target.darkRoomTurns = 2;
            target.darkRoomSource = actor;
            target.darkRoomDmgTaken = 0;
            core.log(`[落空] ${target.name} 进入小黑屋（易伤 10%，2 回合）`, "special");
        },

        // 我们三个真厉害：清空耍起，全队获得"我也要玩"
        yaoQi(ctx) {
            const { actor, myTeam, core } = ctx;
            actor.shuaiQi = 0;
            myTeam.getAliveChars().forEach(c => { c.buffWoYe = 2; });
            core.log(`[落空] 消耗 15 点耍起，全队获得[我也要玩]`, "special");
        },

        // 队友消耗希冀时，落空 +2 耍起
        onAllyConsumedXiJi(ctx) {
            ctx.char.shuaiQi = (ctx.char.shuaiQi || 0) + 2;
        },

        // 小黑屋清除：全队按伤害 10% 回血，落空 +5 耍起
        onDarkRoomClear(ctx) {
            const { char, target, team, core } = ctx;
            const heal = Math.round((target.darkRoomDmgTaken || 0) * 0.1);
            if (heal > 0) {
                team.getAliveChars().forEach(a => {
                    a.hp = Math.min(a.maxHp, a.hp + heal);
                });
                core.log(`[落空] 小黑屋清除，全队回复 ${heal} 点生命`, "heal");
            }
            char.shuaiQi = (char.shuaiQi || 0) + 5;
        },

        // 死亡：全队获得祝福（10% 减伤，2 回合）
        onDeath(ctx) {
            const { team, core } = ctx;
            team.getAliveChars().forEach(c => {
                c.buffTurns = Math.max(c.buffTurns || 0, 2);
            });
            core.log(`[落空] 阵亡触发[我相信你]，全队获得 10% 减伤持续 2 回合`, "special");
        },

        // 低血普攻额外 +1 技能点（3 回合 CD）
        onBasicAttack(ctx) {
            const { char, team, core } = ctx;
            if (char.hp >= char.maxHp * 0.8) return;
            if (char._lowHpBasicLastTurn && core.round - char._lowHpBasicLastTurn < 3) return;
            char._lowHpBasicLastTurn = core.round;
            team.skillPoints = Math.min(5, team.skillPoints + 1);
            core.log(`[落空] 低血被动触发，额外 +1 技能点`, "buff");
        }
    }
});