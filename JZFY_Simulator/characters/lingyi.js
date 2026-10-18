CharacterRegistry.register({
    id: "lingyi",
    name: "01",
    hp: 54,
    atk: 4,

    skills: [
        {
            name: "普攻", cost: -1,
            effects: [
                { type: "damage", ratio: 1.0, target: "lowest" },
                { type: "heal", value: 5, target: "self" }
            ]
        },
        {
            name: "棍木啊", cost: 1,
            effects: [{ type: "damage", ratio: 1.0, target: "enemyTeam" }]
        },
        {
            name: "小棍木来喽", cost: 1,
            effects: [{ type: "custom", hook: "summonSticks" }]
        },
        {
            name: "槐木之主", cost: 0, isUltimate: true,
            ultimateCondition: { type: "custom", hook: "canUltimate" },
            effects: [{ type: "custom", hook: "bigStick" }]
        }
    ],

    passives: [
        { trigger: "turnStart", interval: 1, hook: "onTurnStartStickRegen" }
    ],

    hooks: {
        canUltimate(ctx) {
            const { actor, engine } = ctx;
            const team = engine._findTeamOf(actor);
            return team && team.getAliveChars().length === 1;
        },
        summonSticks(ctx) {
            const { actor, log } = ctx;
            if (!actor.huaiMuHp) actor.huaiMuHp = [];
            if (actor.huaiMuHp.length > 0) {
                actor.huaiMuHp = actor.huaiMuHp.map(h => Math.min(12, h + 4));
            }
            while (actor.huaiMuHp.length < 2) actor.huaiMuHp.push(12);
            log(`[01] 召唤棍木 x${actor.huaiMuHp.length}`, "special");
        },
        bigStick(ctx) {
            const { actor, log } = ctx;
            actor.bigHuaiMu = { hp: 36 };
            actor.maxHp = Math.round(actor.maxHp + 20);
            actor.hp = Math.round(actor.hp + 20);
            log(`[01] 召唤巨大棍木（36HP），maxHp+20 hp+20`, "special");
        },
        onTurnStartStickRegen(ctx) {
            const { char, engine, log } = ctx;
            if (char.huaiMuHp && char.huaiMuHp.length > 0) {
                char.huaiMuHp = char.huaiMuHp.map(h => Math.min(12, h + 2));
            }
            if (char.bigHuaiMu) {
                char.bigHuaiMu.hp = Math.min(36, char.bigHuaiMu.hp + 5);
                char.hp = Math.min(char.maxHp, char.hp + 5);
            } else if (char.huaiMuHp && char.huaiMuHp.length > 0) {
                const team = engine._findTeamOf(char);
                const aliveAllies = team ? team.getAliveChars().length - 1 : 0;
                const healAmt = char.huaiMuHp.length * (aliveAllies > 0 ? 1 : 2);
                char.hp = Math.min(char.maxHp, char.hp + healAmt);
            }
        },
        onDamageTaken(ctx) {
            const { char, dmg, log } = ctx;
            if (!char.huaiMuHp || char.huaiMuHp.length === 0) return;
            let remaining = dmg;
            let absorbed = 0;
            while (remaining > 0 && char.huaiMuHp.length > 0) {
                const firstHp = char.huaiMuHp[0];
                if (firstHp >= remaining) {
                    char.huaiMuHp[0] = firstHp - remaining;
                    absorbed += remaining;
                    remaining = 0;
                } else {
                    absorbed += firstHp;
                    remaining -= firstHp;
                    char.huaiMuHp.shift();
                }
            }
            if (absorbed > 0) {
                // 引擎在 onDamageTaken 之后才扣血，这里 +absorbed 相当于预支血量，净效果 = 实际扣血
                char.hp = char.hp + absorbed;
                log(`[01] 棍木吸收了 ${absorbed} 点伤害`, "buff");
            }
        },
        onDeath(ctx) {
            const { char, engine, log } = ctx;
            // 死时：不复活、队友死加攻血
            const team = engine._findTeamOf(char);
            if (team) {
                team.getAliveChars().forEach(ally => {
                    ally.maxHp = Math.round(ally.maxHp + 15);
                    ally.atk = Math.round(ally.atk + 2);
                    ally.hp = Math.round(Math.min(ally.maxHp, ally.hp + 6));
                });
                log(`[01] 亡[你们全都是棍木]：队友血上限+15, ATK+2, 回复6HP`, "special");
            }
        }
    }
});