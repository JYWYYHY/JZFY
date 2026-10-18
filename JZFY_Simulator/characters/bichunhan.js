CharacterRegistry.register({
    id: "bichunhan",
    name: "闭春寒",
    hp: 66,
    atk: 1,

    skills: [
        {
            name: "普攻", cost: -1,
            effects: [
                { type: "custom", hook: "tickBiSkills" },
                { type: "damage", ratio: 1.0, target: "enemyTeam" }
            ]
        },
        {
            name: "赞美七休日", cost: 1,
            effects: [
                { type: "custom", hook: "tickBiSkills" },
                { type: "custom", hook: "praiseSeven" }
            ]
        },
        {
            name: "王从天降，愤怒狰狞", cost: 1,
            effects: [
                { type: "custom", hook: "tickBiSkills" },
                { type: "custom", hook: "kingDescend" }
            ]
        },
        {
            name: "神临", cost: 0, isUltimate: true,
            ultimateCondition: { type: "custom", hook: "canUltimate" },
            effects: [
                { type: "custom", hook: "tickBiSkills" },
                { type: "custom", hook: "shenLin" }
            ]
        }
    ],

    hooks: {
        tickBiSkills(ctx) {
            ctx.actor.biSkills = (ctx.actor.biSkills || 0) + 1;
        },
        canUltimate(ctx) {
            return (ctx.actor.biSkills || 0) >= 5;
        },
        praiseSeven(ctx) {
            const { actor, target, enemyTeam, myTeam, log, applyDamage, engine } = ctx;
            if (!target) return;
            const r = engine.random();
            if (r < 0.6) {
                applyDamage(actor, target, Math.max(1, Math.round(actor.atk * 2)), enemyTeam, myTeam);
            } else if (r < 0.8) {
                applyDamage(actor, target, Math.max(1, Math.round(actor.atk * 4)), enemyTeam, myTeam);
                log(`[闭春寒] 赞美七休日触发 400% 伤害！`, "special");
            } else if (r < 0.99) {
                target.cannotAct = (target.cannotAct || 0) + 1;
                log(`[闭春寒] ${target.name} 放假 1 轮`, "special");
            } else {
                target.cannotAct = (target.cannotAct || 0) + 7;
                log(`[闭春寒] ${target.name} 放假 7 轮！`, "special");
            }
            actor.hp = Math.min(actor.maxHp, actor.hp + 8);
        },
        kingDescend(ctx) {
            const { actor, enemyTeam, myTeam, log, applyDamage } = ctx;
            const sumAtk = myTeam.getAliveChars().reduce((s, c) => s + c.atk, 0);
            const enemies = enemyTeam.getAliveChars();
            const perDmg = enemies.length > 0 ? Math.max(1, Math.round(sumAtk * 1.6 / enemies.length)) : 0;
            log(`[闭春寒] 王从天降：全队总攻 ${sumAtk}，均摊每人 ${perDmg}`, "special");
            enemies.forEach(e => applyDamage(actor, e, perDmg, enemyTeam, myTeam));
        },
        shenLin(ctx) {
            const { actor, target, enemyTeam, myTeam, engine, log } = ctx;
            if (!target) return;
            log(`[闭春寒] 神临：机制抹杀 ${target.name}！`, "special");
            // 无视一切直接死
            if (typeof engine.handleDeath === "function") {
                engine.handleDeath(target, enemyTeam, actor, "机制抹杀");
            } else {
                target.hp = 0;
            }
            actor.hp = Math.min(actor.maxHp, actor.hp + Math.round(actor.maxHp * 0.8));
            myTeam.skillPoints = Math.min(5, myTeam.skillPoints + 1);
            actor.biSkills = 0;
        },
        onDeath(ctx) {
            const { char, team, engine, log } = ctx;
            // 全队回15血、+4攻、回5技能点
            team.getAliveChars().forEach(c => {
                c.hp = Math.min(c.maxHp, c.hp + 15);
                c.atk += 4;
                c.baseAtk += 4;
            });
            team.skillPoints = Math.min(5, team.skillPoints + 5);
            log(`[闭春寒] 亡命之徒：全队回复 15HP、ATK+4、技能点+5`, "special");
            // 注意：不扣心 + 不可复活 需要引擎支持，见下方清单
        }
    }
});