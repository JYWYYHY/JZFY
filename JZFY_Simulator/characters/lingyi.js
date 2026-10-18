CharacterRegistry.register({
    id: "lingyi",
    name: "01",
    hp: 60,
    atk: 4,
    skills: [
        {
            name: "普攻", cost: -1,
            effects: [{ type: "damage", ratio: 1.0, target: "lowest", lifesteal: true }]
        },
        {
            name: "槐木啊", cost: 1,
            effects: [{ type: "damage", ratio: 0.2, target: "single", lifesteal: true }]
        },
        {
            name: "小槐木", cost: 1,
            effects: [{ type: "custom", hook: "smallTree" }]
        },
        {
            name: "你们全是槐木", cost: 0, isUltimate: true,
            ultimateCondition: { type: "always" },
            effects: [{ type: "custom", hook: "allTrees" }]
        }
    ],
    hooks: {
        smallTree(ctx) {
            const { actor, log } = ctx;
            actor.atk += 2;
            log(`[01] 小槐木：ATK 提升至 ${actor.atk}`, "buff");
        },
        allTrees(ctx) {
            const { actor, myTeam, log } = ctx;
            actor.atk += 16;
            log(`[01] 你们全是槐木：ATK 提升至 ${actor.atk}`, "special");
        }
    }
});