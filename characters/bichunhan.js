/* ============================================================
 * characters/bichunhan.js  —  闭春寒（core 格式）
 * ============================================================ */

CharacterRegistry.register({
    id: "bichunhan",
    name: "闭春寒",
    hp: 66,
    atk: 1,

    initialState: {
        biSkills: 0,
    },

    skills: [
        {
            name: "普攻",
            cost: -1,
            targetType: "enemyTeam",
            effects: [
                { type: "damage", ratio: 1.0, target: "enemyTeam" }
            ]
        },
        {
            name: "赞美七休日",
            cost: 1,
            targetType: "single",
            effects: [
                { type: "custom", hook: "praiseSeven" }
            ]
        },
        {
            name: "王从天降，愤怒狰狞",
            cost: 1,
            targetType: "enemyTeam",
            effects: [
                { type: "custom", hook: "kingDescend" }
            ]
        },
        {
            name: "神临",
            cost: 0,
            isUltimate: true,
            targetType: "single",
            ultimateCondition: { type: "custom", hook: "canUltimate" },
            effects: [
                { type: "custom", hook: "shenLin" }
            ]
        }
    ],

    hooks: {
        // 每次技能释放（非大招）biSkills++
        onSkillCast(ctx) {
            if (ctx.skillKey !== "ult") {
                ctx.actor.biSkills++;
            }
        },

        canUltimate(ctx) {
            return ctx.actor.biSkills >= 5;
        },

        // 赞美七休日：60% 200% / 20% 400% / 19% 放假1轮 / 1% 放假7轮，回8血
        praiseSeven(ctx) {
            const { actor, target, myTeam, enemyTeam, core, rng } = ctx;
            if (!target || target.isDead) return;

            const r = rng();
            if (r < 0.6) {
                core.dealDamage(actor, target, Math.max(1, Math.round(actor.atk * 2)), enemyTeam, myTeam);
                ctx.log(`[闭春寒] 赞美七休日：200% 伤害`, "special");
            } else if (r < 0.8) {
                core.dealDamage(actor, target, Math.max(1, Math.round(actor.atk * 4)), enemyTeam, myTeam);
                ctx.log(`[闭春寒] 赞美七休日：400% 伤害！`, "special");
            } else if (r < 0.99) {
                target.cannotAct = (target.cannotAct || 0) + 1;
                ctx.log(`[闭春寒] 赞美七休日：${target.name} 放假 1 轮`, "special");
            } else {
                target.cannotAct = (target.cannotAct || 0) + 7;
                ctx.log(`[闭春寒] 赞美七休日：${target.name} 放假 7 轮！`, "special");
            }
            actor.hp = Math.min(actor.maxHp, actor.hp + 8);
            ctx.log(`[闭春寒] 回复 8 HP`, "heal");
        },

        // 王从天降：全队总 ATK 的 160% 均摊给敌方
        kingDescend(ctx) {
            const { actor, myTeam, enemyTeam, core } = ctx;
            const sumAtk = myTeam.getAliveChars().reduce((s, c) => s + c.atk, 0);
            const enemies = enemyTeam.getAliveChars();
            if (enemies.length === 0) return;
            const perDmg = Math.max(1, Math.round(sumAtk * 1.6 / enemies.length));
            ctx.log(`[闭春寒] 王从天降：全队总攻 ${sumAtk}，均摊每人 ${perDmg}`, "special");
            enemies.forEach(e => core.dealDamage(actor, e, perDmg, enemyTeam, myTeam));
        },

        // 神临：机制抹杀 + 回80%血 + 回1技能点
        shenLin(ctx) {
            const { actor, target, myTeam, enemyTeam, core } = ctx;
            if (!target || target.isDead) return;

            ctx.log(`[闭春寒] 神临：机制抹杀 ${target.name}！`, "special");
            core.executeKill(target, enemyTeam, actor, "机制抹杀");

            // 战斗已结束就不要再执行后续逻辑
            if (core.isEnded) return;

            actor.hp = Math.min(actor.maxHp, actor.hp + Math.round(actor.maxHp * 0.8));
            ctx.log(`[闭春寒] 神临：回复 80% 生命`, "heal");

            myTeam.skillPoints = Math.min(5, myTeam.skillPoints + 1);
            actor.biSkills = 0;
        },

        // 死亡：全队回15血、+4攻、回5技能点，不扣心、不复活
        onDeath(ctx) {
            const { actor, team } = ctx;
            ctx.log(`[闭春寒] 亡命之徒：全队回复 15HP、ATK+4、技能点+5`, "special");
            team.getAliveChars().forEach(c => {
                c.hp = Math.min(c.maxHp, c.hp + 15);
                c.atk += 4;
                c.baseAtk += 4;
            });
            team.skillPoints = Math.min(5, team.skillPoints + 5);
            return { noHeartLoss: true, noRevive: true };
        }
    }
});