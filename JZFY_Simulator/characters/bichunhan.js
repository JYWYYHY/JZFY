CharacterRegistry.register({
    id: "bichunhan",
    name: "闭春寒",
    hp: 66,
    atk: 1,
    skills: [
        {
            name: "普攻", cost: -1,
            effects: [{ type: "damage", ratio: 1.0, target: "enemyTeam" }]
        },
        {
            name: "赞美七休", cost: 1,
            effects: [{ type: "damage", ratio: 0.6, target: "single" }]
        },
        {
            name: "王从天降", cost: 1,
            effects: [{ type: "damage", ratio: 0.8, target: "single" }]
        },
        {
            name: "神临了", cost: 0, isUltimate: true,
            ultimateCondition: { type: "always" },
            effects: [{ type: "damage", ratio: 99.0, target: "single", execute: true }]
        }
    ]
});