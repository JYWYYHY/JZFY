CharacterRegistry.register({
    id: "jianyun",
    name: "剪云",
    hp: 42,
    atk: 0,

    skills: [
        {
            name: "检索HP", cost: -1,
            effects: [{ type: "custom", hook: "basicSearch" }]
        },
        {
            name: "更改HP", cost: 1,
            effects: [{ type: "custom", hook: "changeHP" }]
        },
        {
            name: "【 】", cost: 1,
            effects: [{ type: "custom", hook: "mark" }]
        },
        {
            name: "获得管理员权限", cost: 0, isUltimate: true,
            ultimateCondition: { type: "custom", hook: "canUltimate" },
            effects: [{ type: "custom", hook: "adminPrivilege" }]
        }
    ],

    hooks: {
        canUltimate(ctx) {
            const a = ctx.actor;
            // 管理员状态下不再重复进入
            if (a.adminPrivilege > 0) return false;
            return (a.jianyunFragments || 0) >= 7;
        },

        // ---- 普攻：检索HP ----
        basicSearch(ctx) {
            const { actor, target, enemyTeam, myTeam, applyDamage, log } = ctx;

            // 强化版：蝶火燎原
            if (actor.adminPrivilege > 0) {
                actor.adminPrivilege = 0;
                const enemies = enemyTeam.getAliveChars();
                const per = enemies.length > 0 ? Math.max(1, Math.round(27 / enemies.length)) : 0;
                log(`[剪云] 蝶火燎原：27 均摊真伤，每人 ${per}`, "special");
                enemies.forEach(e => applyDamage(actor, e, per, enemyTeam, myTeam, { isTrue: true }));
                return;
            }

            if (!target) return;
            applyDamage(actor, target, 7, enemyTeam, myTeam, { isTrue: true });
            actor.jianyunFragments = (actor.jianyunFragments || 0) + 1;
            log(`[剪云] 检索HP：7 真伤，+1 碎片（当前 ${actor.jianyunFragments}）`, "special");

            // 『 』标记额外触发
            if (target.marked) {
                applyDamage(actor, target, 3, enemyTeam, myTeam, { isTrue: true });
                log(`[剪云] 『 』标记触发，额外 3 真伤`, "special");
            }
        },

        // ---- 一技能：更改HP ----
        changeHP(ctx) {
            const { actor, target, myTeam, log } = ctx;

            // 强化版：新月盈满
            if (actor.adminPrivilege > 0) {
                actor.jianyunFragments = Math.max(0, (actor.jianyunFragments || 0) - 1);
                actor.adminPrivilege = 0;
                myTeam.getAliveChars().forEach(c => {
                    c.xinYueTurns = 3;
                });
                log(`[剪云] 新月盈满：全队获得 3 回合回血 3/回合`, "heal");
                return;
            }

            const ally = (target && target.uid !== actor.uid) ? target : actor;
            const maxLimit = ally.uid === actor.uid ? 50 : ally.maxHp;
            ally.hp = Math.min(maxLimit, ally.hp + 7);
            actor.jianyunFragments = (actor.jianyunFragments || 0) + 1;
            log(`[剪云] 更改HP：${ally.name} 回 7 血，+1 碎片（当前 ${actor.jianyunFragments}）`, "heal");
        },

        // ---- 二技能：【 】 ----
        mark(ctx) {
            const { actor, target, enemyTeam, myTeam, applyDamage, log } = ctx;

            // 强化版：搬疾运厄（放逐 2 回合）
            if (actor.adminPrivilege > 0) {
                actor.jianyunFragments = Math.max(0, (actor.jianyunFragments || 0) - 3);
                actor.adminPrivilege = 0;
                if (target) {
                    target.offFieldTurns = 2;
                    log(`[剪云] 搬疾运厄：${target.name} 被放逐 2 回合`, "special");
                }
                return;
            }

            if (!target) return;
            applyDamage(actor, target, 3, enemyTeam, myTeam);
            // 清空所有已有标记，只标记一个
            enemyTeam.chars.concat(myTeam.chars).forEach(c => { c.marked = false; });
            target.marked = true;
            log(`[剪云] 【 】：${target.name} 被标记`, "special");
        },

        // ---- 大招：获得管理员权限 ----
        adminPrivilege(ctx) {
            const { actor, log } = ctx;

            // 强化大招：解放！污染一颗心
            if (actor.adminPrivilege > 0) {
                actor.jianyunFragments = Math.max(0, (actor.jianyunFragments || 0) - 7);
                actor.adminPrivilege = 0;
                const oppSide = actor.side === "player" ? "ai" : "player";
                const oppTeam = ctx.engine[oppSide === "player" ? "p1" : "p2"]
                    || (oppSide === "player" ? ctx.myTeam : ctx.enemyTeam);
                if (oppTeam) {
                    oppTeam.hearts = Math.max(0, oppTeam.hearts - 1);
                    if (oppTeam.errorHearts !== undefined) oppTeam.errorHearts += 1;
                    log(`[剪云] 解放！污染了敌方一颗心（剩 ${oppTeam.hearts}）`, "special");
                }
                return;
            }

            actor.jianyunFragments = Math.max(0, (actor.jianyunFragments || 0) - 7);
            actor.adminPrivilege = 1;
            log(`[剪云] 获得管理员权限！下一次技能将被强化`, "special");
        },

        // ---- 被动：其他角色行动 +0.5 ----
        onAllyAction(ctx) {
            ctx.char.jianyunFragments = (ctx.char.jianyunFragments || 0) + 0.5;
        },

        // ---- 每回合开始回血新月盈满 ----
        onTurnStartXinYue(ctx) {
            const { char } = ctx;
            if ((char.xinYueTurns || 0) > 0) {
                char.hp = Math.min(char.maxHp, char.hp + 3);
                char.xinYueTurns--;
            }
        }
    }
});