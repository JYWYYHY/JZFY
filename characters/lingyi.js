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
            name: "棍木之主", cost: 0, isUltimate: true,
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

        // 召唤2根棍木（如果已有则先回满+4，未满2则补满）
        summonSticks(ctx) {
            const { actor, log } = ctx;
            if (!actor.huaiMuHp) actor.huaiMuHp = [];
            if (actor.huaiMuHp.length > 0) {
                actor.huaiMuHp = actor.huaiMuHp.map(h => Math.min(12, h + 4));
            }
            while (actor.huaiMuHp.length < 2) actor.huaiMuHp.push(12);
            log(`[01] 召唤棍木 x${actor.huaiMuHp.length}`, "special");
            // ATK 加成
            const bonus = actor.huaiMuHp.length;
            const base = actor.def ? actor.def.atk : 4;
            actor.atk = base + bonus + (actor.bigHuaiMu ? 6 : 0);
        },

        bigStick(ctx) {
            const { actor, log } = ctx;
            actor.bigHuaiMu = { hp: 36 };
            actor.maxHp = Math.round(actor.maxHp + 20);
            actor.hp = Math.round(actor.hp + 20);
            log(`[01] 召唤巨大棍木（36HP），maxHp+20 hp+20`, "special");
            const bonus = (actor.huaiMuHp ? actor.huaiMuHp.length : 0) + 6;
            const base = actor.def ? actor.def.atk : 4;
            actor.atk = base + bonus;
        },

        // 回合开始：棍木回血，01 按棍木数量回血
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

        // 死亡：清空棍木 + 不复活 + 队友加攻血
        onDeath(ctx) {
            const { char, engine, log } = ctx;
            const team = engine._findTeamOf(char);
            if (team) {
                team.getAliveChars().forEach(ally => {
                    ally.maxHp = Math.round(ally.maxHp + 15);
                    ally.atk += 2;
                    ally.hp = Math.min(ally.maxHp, ally.hp + 6);
                });
                log(`[01] 亡[你们全都是棍木]：队友血上限+15, ATK+2, +6HP`, "special");
            }
            // 清空棍木
            char.huaiMuHp = [];
            char.bigHuaiMu = null;
            return { noHeartLoss: false, noRevive: true };
        }
    }
});