// effect-handlers.js
// 声明式效果执行器：引擎调用 runEffects(skill.effects, ctx) 执行一个技能。
// 必须在 engine.js 之前引入。

(function (global) {

// ---------------- 目标解析 ----------------
function resolveTarget(spec, ctx) {
    const { actor, target, enemyTeam, myTeam } = ctx;
    const enemies = enemyTeam ? enemyTeam.getAliveChars() : [];
    const allies = myTeam ? myTeam.getAliveChars() : [];

    switch (spec) {
        case "self":       return actor;
        case "same":
        case "single":     return target || enemies[0];
        case "lowest":     return [...enemies].sort((a, b) => a.hp - b.hp)[0] || target;
        case "highest":    return [...enemies].sort((a, b) => b.hp - a.hp)[0] || target;
        case "lowestAlly": return [...allies].sort((a, b) => a.hp - b.hp)[0] || actor;
        case "team":
        case "enemyTeam":  return null;
        default:           return target || enemies[0];
    }
}

// ---------------- 效果处理器 ----------------
const EFFECT_HANDLERS = {

    damage(ctx) {
        const { actor, enemyTeam, myTeam, effect, engine } = ctx;
        const ratio = effect.ratio != null ? effect.ratio : 0;
        const baseDmg = Math.max(1, Math.round(actor.atk * ratio));

        let targets;
        if (effect.target === "enemyTeam") {
            targets = enemyTeam.getAliveChars();
        } else {
            const t = resolveTarget(effect.target, ctx);
            targets = t ? [t] : [];
        }
        if (targets.length === 0) return;

        let dmg = baseDmg;
        if (effect.execute && targets.length === 1) {
            const t = targets[0];
            if (t.hp <= t.maxHp * 0.3) {
                dmg = t.hp;
                engine.log(`[${actor.name}] 触发处决！`, "special");
            }
        }

        let totalDealt = 0;
        targets.forEach(t => {
            const actual = engine.applyDamage(actor, t, dmg, enemyTeam, myTeam);
            totalDealt += actual || 0;
        });

        if (effect.lifesteal && totalDealt > 0) {
            actor.hp = Math.min(actor.maxHp, actor.hp + totalDealt);
            engine.log(`[吸血] ${actor.name} 回复 ${totalDealt} 点HP`, "heal");
        }

        ctx.lastDamage = dmg;
        ctx.lastTargets = targets;
    },

    heal(ctx) {
        const { myTeam, effect, engine } = ctx;
        const val = effect.value || 0;

        let targets;
        if (effect.target === "team") {
            targets = myTeam.getAliveChars();
        } else if (effect.target === "lowestAlly") {
            const t = [...myTeam.getAliveChars()].sort((a, b) => a.hp - b.hp)[0];
            targets = t ? [t] : [];
        } else {
            const t = resolveTarget(effect.target, ctx);
            targets = t ? [t] : [];
        }

        targets.forEach(t => {
            t.hp = Math.min(t.maxHp, t.hp + val);
            engine.log(`[治疗] ${t.name} 回复 ${val} 点HP`, "heal");
        });
    },

    shield(ctx) {
        const { myTeam, effect, engine } = ctx;
        const val = effect.value || 0;

        let targets;
        if (effect.target === "team") {
            targets = myTeam.getAliveChars();
        } else {
            const t = resolveTarget(effect.target, ctx);
            targets = t ? [t] : [];
        }

        targets.forEach(t => { t.shield += val; });
        engine.log(`[${ctx.actor.name}] 为 ${targets.map(t => t.name).join("、")} 提供 ${val} 点护盾`, "buff");
    },

    poison(ctx) {
        const { enemyTeam, effect, actor, engine } = ctx;
        const turns = effect.turns || 3;

        const targets = (effect.target === "enemyTeam")
            ? enemyTeam.getAliveChars()
            : [resolveTarget(effect.target, ctx)].filter(Boolean);

        targets.forEach(t => {
            t.poisonTurns = turns;
            t.poisonSource = actor;
        });
        engine.log(`[${actor.name}] 使 ${targets.map(t => t.name).join("、")} 中毒 ${turns} 回合！`, "special");
    },

    buff(ctx) {
        const { effect, actor, engine } = ctx;
        const fn = actor.hooks && actor.hooks[effect.hook];
        if (typeof fn === "function") fn(ctx);
        else engine.log(`[警告] ${actor.name} 缺少 buff hook: ${effect.hook}`, "system");
    },

    debuff(ctx) {
        const { enemyTeam, effect, engine, actor } = ctx;
        const dec = effect.value || 0;

        if (effect.target === "enemyTeam") {
            enemyTeam.getAliveChars().forEach(e => { e.atk = Math.max(1, e.atk - dec); });
            engine.log(`[${actor.name}] 敌方全体 ATK 降低 ${dec}`, "buff");
        }
    },

    custom(ctx) {
        const { effect, actor, engine } = ctx;
        const fn = actor.hooks && actor.hooks[effect.hook];
        if (typeof fn === "function") fn(ctx);
        else engine.log(`[警告] ${actor.name} 缺少 hook: ${effect.hook}`, "system");
    }
};

// ---------------- 主执行器 ----------------
function runEffects(effects, ctx) {
    if (!Array.isArray(effects)) return;
    for (const effect of effects) {
        const handler = EFFECT_HANDLERS[effect.type];
        if (!handler) {
            ctx.engine.log(`[警告] 未知效果类型: ${effect.type}`, "system");
            continue;
        }
        ctx.effect = effect;
        handler(ctx);
        // 每个效果之后重解析 target，避免打死之后引用失效
        ctx.target = resolveTarget(effect.target, ctx);
    }
}

global.EFFECT_HANDLERS = EFFECT_HANDLERS;
global.runEffects = runEffects;
global.resolveTarget = resolveTarget;

})(window);