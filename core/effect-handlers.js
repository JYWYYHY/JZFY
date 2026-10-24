/* ============================================================
 * core/effect-handlers.js
 *   · damage / heal / shield / poison / buff / custom
 * ============================================================ */

(function (global) {

function resolveTargets(spec, ctx) {
    const { actor, enemyTeam, myTeam } = ctx;
    switch (spec) {
        case "self":       return [actor];
        case "enemyTeam":  return enemyTeam ? enemyTeam.getAliveChars() : [];
        case "allyTeam":   return myTeam ? myTeam.getAliveChars() : [];
        case "lowestEnemy": {
            const es = enemyTeam ? enemyTeam.getAliveChars() : [];
            return es.length ? [es.sort((a,b)=>a.hp-b.hp)[0]] : [];
        }
        case "highestEnemy": {
            const es = enemyTeam ? enemyTeam.getAliveChars() : [];
            return es.length ? [es.sort((a,b)=>b.hp-a.hp)[0]] : [];
        }
        case "single":
        default: {
            if (ctx.target) return [ctx.target];
            const es = enemyTeam ? enemyTeam.getAliveChars() : [];
            return es.length ? [es[0]] : [];
        }
    }
}

const EFFECT_HANDLERS = {

    damage(ctx) {
        const { actor, effect, core, enemyTeam, myTeam } = ctx;
        const ratio = effect.ratio != null ? effect.ratio : 1.0;
        const baseDmg = Math.max(1, Math.round(actor.atk * ratio));
        const targets = resolveTargets(effect.target || "single", ctx);

        let totalDealt = 0;
        targets.forEach(t => {
            const actual = core.dealDamage(actor, t, baseDmg, enemyTeam, myTeam);
            totalDealt += actual || 0;
        });

        if (effect.lifesteal && totalDealt > 0) {
            actor.hp = Math.min(actor.maxHp, actor.hp + totalDealt);
            core.log(`[${actor.name}] 吸血 ${totalDealt} HP`, "heal");
        }

        ctx.lastDamage = baseDmg;
        ctx.lastTargets = targets;
    },

    heal(ctx) {
        const { effect, core, myTeam } = ctx;
        const value = effect.value || 0;
        const targets = resolveTargets(effect.target || "self", ctx);
        targets.forEach(t => {
            t.hp = Math.min(t.maxHp, t.hp + value);
            core.log(`[${t.name}] 回复 ${value} HP`, "heal");
        });
    },

    shield(ctx) {
        const { effect, core } = ctx;
        const value = effect.value || 0;
        const targets = resolveTargets(effect.target || "self", ctx);
        targets.forEach(t => { t.shield += value; });
        core.log(`[${ctx.actor.name}] 提供 ${value} 护盾`, "buff");
    },

    poison(ctx) {
        const { effect, core, actor } = ctx;
        const turns = effect.turns || 3;
        const targets = resolveTargets(effect.target || "enemyTeam", ctx);
        targets.forEach(t => {
            t.poisonTurns = turns;
            t.poisonSource = actor;
        });
        core.log(`[${actor.name}] 施加 ${turns} 回合中毒`, "special");
    },

    buff(ctx) {
        const { effect, actor, core } = ctx;
        const fn = actor.hooks[effect.hook];
        if (typeof fn === "function") fn(ctx);
        else core.log(`[警告] ${actor.name} 缺少 hook: ${effect.hook}`, "system");
    },

    custom(ctx) {
        const { effect, actor, core } = ctx;
        const fn = actor.hooks[effect.hook];
        if (typeof fn === "function") fn(ctx);
        else core.log(`[警告] ${actor.name} 缺少 hook: ${effect.hook}`, "system");
    },
};

function runEffects(effects, ctx) {
    if (!Array.isArray(effects)) return;
    for (const effect of effects) {
        const handler = EFFECT_HANDLERS[effect.type];
        if (!handler) {
            ctx.core.log(`[警告] 未知效果: ${effect.type}`, "system");
            continue;
        }
        ctx.effect = effect;
        try {
            handler(ctx);
        } catch (e) {
            console.error(`[core] 效果执行错误 (${effect.type}):`, e);
            ctx.core.log(`[错误] 效果 ${effect.type} 执行异常: ${e.message}`, "system");
        }
    }
}

global.EFFECT_HANDLERS = EFFECT_HANDLERS;
global.runEffects = runEffects;
global.resolveTargets = resolveTargets;

})(typeof window !== "undefined" ? window : global);