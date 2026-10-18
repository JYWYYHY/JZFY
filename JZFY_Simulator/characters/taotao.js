CharacterRegistry.register({
    id: "taotao",
    name: "吃颗桃桃",
    hp: 69,
    atk: 7,
    skills: [
        {
            name: "普攻", cost: -1,
            effects: [{ type: "damage", ratio: 1.0, target: "lowest" }]
        },
        {
            name: "回溯", cost: 1,
            effects: [{ type: "heal", value: 15, target: "lowestAlly" }]
        },
        {
            name: "吃个桃桃", cost: 1,
            effects: [{ type: "damage", ratio: 0.5, target: "single" }]
        },
        {
            name: "狂欢之夜", cost: 0, isUltimate: true,
            ultimateCondition: { type: "always" },
            effects: [{ type: "debuff", value: 30, target: "enemyTeam" }]
        }
    ]
});