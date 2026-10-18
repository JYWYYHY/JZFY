CharacterRegistry.register({
    id: "jitang",
    name: "鸡汤",
    hp: 60,
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
            effects: [{ type: "custom", hook: "poisonSingle" }]
        },
        {
            name: "浸泡", cost: 0, isUltimate: true,
            ultimateCondition: { type: "custom", hook: "canUltimate" },
            effects: [{ type: "custom", hook: "poisonUltimate" }]
        }
    ],

    passives: [
        { trigger: "turnStart", interval: 3, hook: "onTurnStartHeal" }
    ],

    hooks: {
        // 被动：每 3 回合全队回 8 HP
        onTurnStartHeal(ctx) {
            const { team, log } = ctx;
            team.getAliveChars().forEach(ally => {
                ally.hp = Math.min(ally.maxHp, ally.hp + 8);
            });
            log(`[鸡汤] 被动触发，全队回复8点HP。`, "heal");
        },

        // 毒伤结算时累加腐蚀计数
        onCorrosionDealt(ctx) {
            const { char, dmg } = ctx;
            char.corrosionCount = (char.corrosionCount || 0) + dmg;
            char.corrosionHistory.push(dmg);
            while (char.corrosionHistory.length > 6) char.corrosionHistory.shift();
            char.corrosionRecord = char.corrosionHistory.reduce((a, b) => a + b, 0);
        },

        // 鸡汤来喽：额外 150% ATK 腐蚀伤害，并计入累积
        poisonSingle(ctx) {
            const { actor, target, enemyTeam, myTeam, applyDamage, log } = ctx;
            const dmg = Math.round(actor.atk * 1.5);
            log(`[鸡汤] 释放[鸡汤来喽]，造成额外150%腐蚀伤害！`, "special");

            // 手动计入腐蚀累积
            actor.corrosionCount = (actor.corrosionCount || 0) + dmg;
            actor.corrosionHistory.push(dmg);
            while (actor.corrosionHistory.length > 6) actor.corrosionHistory.shift();
            actor.corrosionRecord = actor.corrosionHistory.reduce((a, b) => a + b, 0);

            applyDamage(actor, target, dmg, enemyTeam, myTeam);
        },

        // 大招条件：累积 50 腐蚀伤害
        canUltimate(ctx) {
            return (ctx.actor.corrosionCount || 0) >= 50;
        },

        // 浸泡：记录值 100% 由敌方均摊，并回 1 技能点
        poisonUltimate(ctx) {
            const { actor, enemyTeam, myTeam, applyDamage, log } = ctx;
            actor.corrosionCount = 0;

            const totalRecord = actor.corrosionRecord || 0;
            const enemies = enemyTeam.getAliveChars();
            const perDmg = enemies.length > 0
                ? Math.max(1, Math.round(totalRecord / enemies.length))
                : 0;

            log(`[鸡汤] 释放大招[浸泡]，记录伤害 ${totalRecord}，均摊每人 ${perDmg}！`, "special");
            enemies.forEach(e => applyDamage(actor, e, perDmg, enemyTeam, myTeam));

            myTeam.skillPoints = Math.min(5, myTeam.skillPoints + 1);
            actor.corrosionHistory = [];
            actor.corrosionRecord = 0;
        }
    }
});