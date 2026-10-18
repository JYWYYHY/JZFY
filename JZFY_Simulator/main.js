let autoEngine = new AutoEngine();
let manualEngine = new ManualEngine();
let currentMode = 'auto';
let lastBatchResults = null;

window.onload = () => {
    const charNames = ["无", ...Object.keys(CHARACTERS)];

    // 自动战斗下拉框
    const autoSelectors = ['p1-c1', 'p1-c2', 'p1-c3', 'p2-c1', 'p2-c2', 'p2-c3'];
    autoSelectors.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        charNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name; option.text = name;
            select.appendChild(option);
        });
    });
    document.getElementById('p1-c1').value = "G哥";
    document.getElementById('p1-c2').value = "鸡汤";
    document.getElementById('p1-c3').value = "墩子";
    document.getElementById('p2-c1').value = "素锦";
    document.getElementById('p2-c2').value = "01";
    document.getElementById('p2-c3').value = "吃颗桃桃";

    // 手动模式下拉框
    const manualSelectors = ['m-c1', 'm-c2', 'm-c3'];
    manualSelectors.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        charNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name; option.text = name;
            select.appendChild(option);
        });
    });
    document.getElementById('m-c1').value = "G哥";
    document.getElementById('m-c2').value = "无";
    document.getElementById('m-c3').value = "无";

    // 绑定
    autoEngine.onLog = logMessage;
    autoEngine.onUpdateUI = updateAutoUI;
    autoEngine.onEnd = onAutoEnd;
    manualEngine.onLog = logMessage;
    manualEngine.onUpdateUI = updateManualUI;

    const btnStart = document.getElementById('btn-start');
    const btnManualStart = document.getElementById('btn-manual-start');
    const btnReset = document.getElementById('btn-reset');
    const btnPause = document.getElementById('btn-pause');
    const btnBatch = document.getElementById('btn-batch');
    const btnApplyDummy = document.getElementById('btn-apply-dummy');
    const btnResetStats = document.getElementById('btn-reset-stats');

    if (btnStart) btnStart.addEventListener('click', startAutoBattle);
    if (btnManualStart) btnManualStart.addEventListener('click', startManualBattle);
    if (btnReset) btnReset.addEventListener('click', resetAll);

    // 暂停/恢复
    if (btnPause) btnPause.addEventListener('click', () => {
        if (!autoEngine.isRunning()) return;
        if (autoEngine.isPaused()) {
            autoEngine.resume();
            btnPause.innerText = "⏸ 暂停";
        } else {
            autoEngine.pause();
            btnPause.innerText = "▶ 继续";
        }
    });

    // 批量模拟
    if (btnBatch) btnBatch.addEventListener('click', runBatchSimulate);

    // 手动：应用木桩设置
    if (btnApplyDummy) btnApplyDummy.addEventListener('click', () => {
        if (!manualEngine.myTeam) {
            alert("请先点击 [开始测试] 初始化战斗。");
            return;
        }
        const count = Math.max(1, Math.min(3, parseInt(document.getElementById('dummy-count').value) || 1));
        const hp = Math.max(1, parseInt(document.getElementById('dummy-hp').value) || 9999);
        manualEngine.setDummyConfig(count, hp);
    });

    // 手动：重置统计
    if (btnResetStats) btnResetStats.addEventListener('click', () => {
        if (!manualEngine.myTeam) return;
        manualEngine.resetStats();
    });
};

function switchMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    const target = document.querySelector(`.mode-tab[onclick="switchMode('${mode}')"]`);
    if (target) target.classList.add('active');

    if (mode === 'auto') {
        document.getElementById('auto-controls').style.display = 'flex';
        document.getElementById('manual-controls').style.display = 'none';
        document.getElementById('panel-title').innerText = "自动战斗实时状态";
    } else {
        document.getElementById('auto-controls').style.display = 'none';
        document.getElementById('manual-controls').style.display = 'flex';
        document.getElementById('panel-title').innerText = "手动测试实时状态";
    }
    resetAll();
}

function startAutoBattle() {
    const p1 = [document.getElementById('p1-c1').value, document.getElementById('p1-c2').value, document.getElementById('p1-c3').value].filter(n => n && n !== "无" && CHARACTERS[n]);
    const p2 = [document.getElementById('p2-c1').value, document.getElementById('p2-c2').value, document.getElementById('p2-c3').value].filter(n => n && n !== "无" && CHARACTERS[n]);

    if (p1.length !== 3 || p2.length !== 3) {
        alert("自动战斗模式需要双方各选择3名角色！");
        return;
    }

    autoEngine.stop();
    const logEl = document.getElementById('log');
    if (logEl) logEl.innerHTML = "";

    const btnStart = document.getElementById('btn-start');
    if (btnStart) btnStart.disabled = true;

    const btnPause = document.getElementById('btn-pause');
    if (btnPause) {
        btnPause.style.display = 'inline-block';
        btnPause.innerText = "⏸ 暂停";
    }

    const statsBody = document.getElementById('stats-body');
    if (statsBody) statsBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">模拟中...</td></tr>';

    autoEngine.init(p1, p2);
    autoEngine.start();
}

function startManualBattle() {
    const rawPlayers = [
        document.getElementById('m-c1').value,
        document.getElementById('m-c2').value,
        document.getElementById('m-c3').value
    ];
    const players = rawPlayers.filter(n => n && n !== "无" && CHARACTERS[n]);

    const dummyCount = parseInt(document.getElementById('dummy-count').value) || 1;
    const dummyHp = parseInt(document.getElementById('dummy-hp').value) || 9999;

    if (players.length === 0) {
        alert("请至少选择一个玩家角色！");
        return;
    }

    const logEl = document.getElementById('log');
    if (logEl) logEl.innerHTML = "";

    const btnManualStart = document.getElementById('btn-manual-start');
    if (btnManualStart) btnManualStart.disabled = true;

    const statsBody = document.getElementById('stats-body');
    if (statsBody) statsBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">手动测试中...</td></tr>';

    lastBatchResults = null;

    manualEngine.init(players, dummyCount, dummyHp);
}

function resetAll() {
    autoEngine.stop();
    autoEngine.p1 = null; autoEngine.p2 = null;
    manualEngine.myTeam = null; manualEngine.dummyTeam = null;
    lastBatchResults = null;

    const logEl = document.getElementById('log');
    if (logEl) logEl.innerHTML = "准备就绪，请点击开始...";

    const winnerEl = document.getElementById('stat-winner');
    if (winnerEl) winnerEl.innerText = "准备中";

    const turnsEl = document.getElementById('stat-turns');
    if (turnsEl) turnsEl.innerText = "0";

    const p1Chars = document.getElementById('p1-chars');
    if (p1Chars) p1Chars.innerHTML = "";

    const p2Chars = document.getElementById('p2-chars');
    if (p2Chars) p2Chars.innerHTML = "";

    const p1Hearts = document.getElementById('p1-hearts');
    if (p1Hearts) p1Hearts.innerText = "5";

    const p2Hearts = document.getElementById('p2-hearts');
    if (p2Hearts) p2Hearts.innerText = "5";

    const p1Sp = document.getElementById('p1-sp');
    if (p1Sp) p1Sp.innerText = "3";

    const p2Sp = document.getElementById('p2-sp');
    if (p2Sp) p2Sp.innerText = "3";

    const btnStart = document.getElementById('btn-start');
    if (btnStart) btnStart.disabled = false;

    const btnManualStart = document.getElementById('btn-manual-start');
    if (btnManualStart) btnManualStart.disabled = false;

    const btnPause = document.getElementById('btn-pause');
    if (btnPause) btnPause.style.display = 'none';

    const statsBody = document.getElementById('stats-body');
    if (statsBody) statsBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">等待数据...</td></tr>';
}

function logMessage({ msg, type }) {
    const logBox = document.getElementById('log');
    if (!logBox) return;
    const p = document.createElement('div');
    p.className = `log-${type}`;
    p.innerHTML = msg;
    logBox.appendChild(p);
    logBox.scrollTop = logBox.scrollHeight;
}

// ================= 批量模拟 =================
function runBatchSimulate() {
    const p1 = [document.getElementById('p1-c1').value, document.getElementById('p1-c2').value, document.getElementById('p1-c3').value].filter(n => n && n !== "无" && CHARACTERS[n]);
    const p2 = [document.getElementById('p2-c1').value, document.getElementById('p2-c2').value, document.getElementById('p2-c3').value].filter(n => n && n !== "无" && CHARACTERS[n]);

    if (p1.length !== 3 || p2.length !== 3) {
        alert("批量模拟需要双方各选择3名角色！");
        return;
    }

    const rounds = Math.max(1, Math.min(1000, parseInt(document.getElementById('batch-rounds').value) || 100));
    const seedInput = document.getElementById('batch-seed').value;
    const seed = seedInput === "" ? null : (parseInt(seedInput) || null);

    // 停止当前战斗
    autoEngine.stop();
    const btnPause = document.getElementById('btn-pause');
    if (btnPause) btnPause.style.display = 'none';

    const logEl = document.getElementById('log');
    if (logEl) logEl.innerHTML = "";

    logMessage({ msg: `<span style="color:#00bcd4">[批量模拟] 开始 ${rounds} 场... (种子: ${seed == null ? "随机" : seed})</span>`, type: "system" });

    // 让浏览器有机会渲染日志
    setTimeout(() => {
        const results = autoEngine.batchSimulate(p1, p2, rounds, seed);
        lastBatchResults = results;
        displayBatchResults(results);
    }, 30);
}

function displayBatchResults(r) {
    const tbody = document.getElementById('stats-body');
    const turnsEl = document.getElementById('stat-turns');
    const winnerEl = document.getElementById('stat-winner');

    if (turnsEl) turnsEl.innerText = `批量 ${r.rounds} 场`;
    if (winnerEl) {
        winnerEl.style.fontSize = '12px';
        winnerEl.innerHTML =
            `红 <b style="color:#ff8a80">${r.redWinRate}</b><br>` +
            `蓝 <b style="color:#82b1ff">${r.blueWinRate}</b><br>` +
            `平 <b>${r.drawRate}</b>`;
    }

    logMessage({ msg: `[批量模拟] 完成 ${r.rounds} 场，用时 ${r.elapsedMs}ms，种子: ${r.seed}`, type: "system" });
    logMessage({ msg: `[批量模拟] 红方 ${r.redWin} 胜 (${r.redWinRate}) | 蓝方 ${r.blueWin} 胜 (${r.blueWinRate}) | 平局 ${r.draw} (${r.drawRate})`, type: "system" });
    logMessage({ msg: `[批量模拟] 回合: 平均 ${r.avgTurns}，最短 ${r.minTurns}，最长 ${r.maxTurns}`, type: "system" });

    if (!tbody) return;
    tbody.innerHTML = '';

    const renderChar = (stats, teamName, cls) => {
        Object.keys(stats).forEach(name => {
            const s = stats[name];
            tbody.innerHTML += `<tr>
                <td class="${cls}">${teamName}</td>
                <td><b>${name}</b></td>
                <td class="log-dmg">${s.avgDmg}</td>
                <td>${s.avgDps}</td>
                <td class="log-death">${s.avgDeaths}</td>
                <td>${s.avgUlts} 次</td>
            </tr>`;
        });
    };
    renderChar(r.redChars, "红方", "td-red");
    renderChar(r.blueChars, "蓝方", "td-blue");

    // 每个角色也在日志里输出一份，方便复制
    const dump = (stats, prefix) => {
        Object.keys(stats).forEach(name => {
            const s = stats[name];
            logMessage({
                msg: `[批量模拟] ${prefix} ${name}: 均伤 ${s.avgDmg}, DPS ${s.avgDps}, 均死 ${s.avgDeaths}, 均大招 ${s.avgUlts}`,
                type: "system"
            });
        });
    };
    dump(r.redChars, "红");
    dump(r.blueChars, "蓝");
}

// ================= 自动战斗 UI =================
function updateAutoUI(eng) {
    if (!eng.p1 || !eng.p2) return;

    const p1h = document.getElementById('p1-hearts'); if (p1h) p1h.innerText = eng.p1.hearts;
    const p2h = document.getElementById('p2-hearts'); if (p2h) p2h.innerText = eng.p2.hearts;
    const p1sp = document.getElementById('p1-sp'); if (p1sp) p1sp.innerText = eng.p1.skillPoints;
    const p2sp = document.getElementById('p2-sp'); if (p2sp) p2sp.innerText = eng.p2.skillPoints;

    const p1chars = document.getElementById('p1-chars'); if (p1chars) p1chars.innerHTML = renderAutoChars(eng.p1);
    const p2chars = document.getElementById('p2-chars'); if (p2chars) p2chars.innerHTML = renderAutoChars(eng.p2);

    const turnsEl = document.getElementById('stat-turns');
    if (turnsEl && !lastBatchResults) turnsEl.innerText = eng.turn;
}

function renderAutoChars(team) {
    let html = '';
    team.chars.forEach(c => {
        if (c.isDead) {
            html += `<div class="char-card dead"><div class="char-name">${c.name}</div><div style="color:#888;">阵亡等待复活</div></div>`;
        } else {
            html += `<div class="char-card">
                <div class="char-name">${c.name}</div>
                <div>HP: <span class="char-hp">${c.hp}</span>/${c.maxHp}</div>
                <div>ATK: ${c.atk}</div>
            </div>`;
        }
    });
    return html;
}

// ================= 手动 UI =================
function updateManualUI(eng) {
    if (!eng.myTeam || !eng.dummyTeam) return;

    const p1h = document.getElementById('p1-hearts'); if (p1h) p1h.innerText = eng.myTeam.hearts;
    const p2h = document.getElementById('p2-hearts'); if (p2h) p2h.innerText = "∞";
    const p1sp = document.getElementById('p1-sp'); if (p1sp) p1sp.innerText = eng.myTeam.skillPoints;
    const p2sp = document.getElementById('p2-sp'); if (p2sp) p2sp.innerText = "0";

    const currentActor = eng.getCurrentActor();

    const p1chars = document.getElementById('p1-chars');
    if (p1chars) p1chars.innerHTML = renderManualChars(eng.myTeam, currentActor);

    const p2chars = document.getElementById('p2-chars');
    if (p2chars) p2chars.innerHTML = renderDummies(eng.dummyTeam);

    const turnsEl = document.getElementById('stat-turns');
    if (turnsEl && !lastBatchResults) turnsEl.innerText = eng.turn;

    const winnerEl = document.getElementById('stat-winner');
    if (winnerEl && !lastBatchResults) {
        const allDummyDead = eng.dummyTeam.chars.every(c => c.isDead);
        const allPlayerDead = eng.myTeam.getAliveChars().length === 0;
        if (allPlayerDead) winnerEl.innerText = "玩家全灭";
        else if (allDummyDead) winnerEl.innerText = "木桩击破";
        else winnerEl.innerText = "测试中";
    }

    renderManualStats(eng);
}

function renderManualStats(eng) {
    const tbody = document.getElementById('stats-body');
    if (!tbody) return;
    if (lastBatchResults) return;   // 批量结果优先展示，不覆盖

    const turns = Math.max(1, eng.turn);

    const rowsOf = (team, teamName, cls) => {
        if (!team) return '';
        return team.chars.map(c => {
            const dps = Math.round(c.stats.totalDmg / turns);
            const ultFreq = c.stats.ults > 0 ? (turns / c.stats.ults).toFixed(1) + " 回合/次" : "未释放";
            return `<tr>
                <td class="${cls}">${teamName}</td>
                <td><b>${c.name}</b></td>
                <td class="log-dmg">${c.stats.totalDmg}</td>
                <td>${dps}</td>
                <td class="log-death">${c.stats.deaths}</td>
                <td>${ultFreq}</td>
            </tr>`;
        }).join('');
    };

    let html = "";
    html += rowsOf(eng.myTeam, "玩家", "td-red");
    html += rowsOf(eng.dummyTeam, "木桩", "td-blue");

    tbody.innerHTML = html || `<tr><td colspan="6" style="text-align:center;color:#888;">暂无数据</td></tr>`;
}

function renderManualChars(team, currentActor) {
    let html = '';
    const currentName = currentActor ? currentActor.name : null;

    team.chars.forEach(c => {
        let cardClass = 'char-card';
        if (c.isDead) cardClass += ' dead';
        if (c.name === currentName) cardClass += ' active-turn';

        let content = `<div class="char-name">${c.name} ${c.name === currentName ? '👈 当前行动' : ''}</div>`;

        if (c.isDead) {
            content += '<div style="color:#888;">阵亡等待复活</div>';
        } else {
            content += `<div>HP: <span class="char-hp">${c.hp}</span>/${c.maxHp}</div>`;
            content += `<div>ATK: ${c.atk} | 护盾: ${c.shield}</div>`;

            let buffs = '';
            if (c.poisonTurns > 0) buffs += `<span class="tag" style="background:#3e1212">毒${c.poisonTurns}</span>`;
            if (c.duelRounds > 0) buffs += `<span class="tag" style="background:#b45309">决斗${c.duelRounds}</span>`;
            if (c.xiJiStacks > 0) buffs += `<span class="tag" style="background:#1e3a8a">希冀${c.xiJiStacks}</span>`;
            if (c.shuaiQi > 0) buffs += `<span class="tag" style="background:#6b21a8">耍起${c.shuaiQi}</span>`;
            if (c.domainTurns > 0) buffs += `<span class="tag" style="background:#065f46">领域${c.domainTurns}</span>`;

            if (buffs !== '') content += `<div class="char-buff">${buffs}</div>`;

            if (c.name === currentName) {
                let buttons = '';
                c.skills.forEach((s, i) => {
                    let costText = s.cost === -1 ? '+1' : s.cost;
                    buttons += '<button class="skill-btn" onclick="manualEngine.executeManualSkill(' + i + ')">'
                        + s.name + ' (耗:' + costText + ')</button>';
                });
                content += `<div class="skill-buttons">${buttons}</div>`;
            }
        }
        html += `<div class="${cardClass}">${content}</div>`;
    });
    return html;
}

function renderDummies(team) {
    let html = '';
    team.chars.forEach((c, i) => {
        let cardClass = c.hp <= 0 ? 'char-card dead' : 'char-card';
        const selected = manualEngine.targetIndex === i ? ' active-turn' : '';
        html += `<div class="${cardClass}${selected}" onclick="manualEngine.selectTarget(${i})" style="cursor:pointer;">
            <div class="char-name">${c.name}${manualEngine.targetIndex === i ? ' 🎯' : ''}</div>
            <div>HP: <span class="char-hp">${c.hp}</span>/${c.maxHp}</div>
            ${c.shield > 0 ? `<div>护盾: ${c.shield}</div>` : ''}
        </div>`;
    });
    return html;
}

// ================= 自动战斗结束 =================
function onAutoEnd(winner, turns) {
    const winnerEl = document.getElementById('stat-winner');
    if (winnerEl) winnerEl.innerText = winner;
    const turnsEl = document.getElementById('stat-turns');
    if (turnsEl) turnsEl.innerText = turns;

    const btnStart = document.getElementById('btn-start');
    if (btnStart) btnStart.disabled = false;
    const btnPause = document.getElementById('btn-pause');
    if (btnPause) btnPause.style.display = 'none';

    const tbody = document.getElementById('stats-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const renderStats = (team, teamName, className) => {
        team.chars.forEach(c => {
            let dps = c.stats.turnsAlive > 0 ? Math.round(c.stats.totalDmg / c.stats.turnsAlive) : 0;
            let ultFreq = c.stats.ults > 0 ? (turns / c.stats.ults).toFixed(1) + " 回合/次" : "未释放";
            tbody.innerHTML += `<tr>
                <td class="${className}">${teamName}</td>
                <td><b>${c.name}</b></td>
                <td class="log-dmg">${c.stats.totalDmg}</td>
                <td>${dps}</td>
                <td class="log-death">${c.stats.deaths}</td>
                <td>${ultFreq}</td>
            </tr>`;
        });
    };
    renderStats(autoEngine.p1, "红方", "td-red");
    renderStats(autoEngine.p2, "蓝方", "td-blue");
}