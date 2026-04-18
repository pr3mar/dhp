// --- RENDERERS ---
function render() {
  buildPools();
  computeLedger();
  saveData();

  renderSummaryCards();
  renderAlerts();
  renderPoolGrid();
  renderLog();
  renderAccTabs();
  renderAccGrid();
  renderSettings();
}

function renderSummaryCards() {
  const totalEntitlement = POOLS.reduce((s,p) => s + p.entitlement, 0);
  const used = entries.filter(e => getDynStatus(e) === 'Used').reduce((s,e) => s + e.days, 0);
  const planned = entries.filter(e => getDynStatus(e) === 'Planned').reduce((s,e) => s + e.days, 0);
  const unplanned = totalEntitlement - used - planned;
  
  const cy = TODAY.getFullYear();
  const remoteBudget = SETTINGS.remoteYears[String(cy)] || 0;
  const remoteUsed = entries.filter(e => e.type === 'Remote work' && (new Date(e.startDate).getFullYear() === cy)).reduce((s,e) => s + e.days, 0);
  const remoteLeft = remoteBudget - remoteUsed;

  document.getElementById('c-avail').textContent = fmt(totalEntitlement);
  document.getElementById('c-used').textContent = fmt(used);
  document.getElementById('c-planned').textContent = fmt(planned);
  document.getElementById('c-remaining').textContent = fmt(unplanned);
  document.getElementById('c-remote').textContent = fmt(remoteLeft);

  document.getElementById('card-remaining').className = 'card remaining' + (unplanned < 0 ? ' danger' : unplanned < 2 ? ' warn' : '');
  document.getElementById('card-remote').className = 'card remote' + (remoteLeft < 0 ? ' danger' : remoteLeft < 5 ? ' warn' : '');
}

function renderAlerts() {
  const msgs = [];
  const cy = TODAY.getFullYear();
  const remoteBudget = SETTINGS.remoteYears[String(cy)] || 0;
  const remoteUsed = entries.filter(e => e.type === 'Remote work' && (new Date(e.startDate).getFullYear() === cy)).reduce((s,e) => s + e.days, 0);
  const remoteLeft = remoteBudget - remoteUsed;

  const totalEntitlement = POOLS.reduce((s,p) => s + p.entitlement, 0);
  const used = entries.filter(e => getDynStatus(e) === 'Used').reduce((s,e) => s + e.days, 0);
  const planned = entries.filter(e => getDynStatus(e) === 'Planned').reduce((s,e) => s + e.days, 0);
  const unplanned = totalEntitlement - used - planned;

  if (unplanned < 0) msgs.push({ cls: 'danger', icon: '⚠️', text: `Over-planned by ${fmt(Math.abs(unplanned))} days across all pools.` });
  else if (unplanned < 2) msgs.push({ cls: 'warn', icon: '⚠️', text: `Almost fully planned — only ${fmt(unplanned)} days left globally.` });

  for (const p of POOLS) {
    if (TODAY < p.useby) {
      const remaining = p.entitlement - p.spent.Used - p.spent.Planned;
      const daysToExpiry = (p.useby - TODAY) / (1000 * 60 * 60 * 24);
      if (remaining > 0.05 && daysToExpiry < 180) { 
        msgs.push({ cls: 'warn', icon: '⏳', text: `${fmt(remaining)} day(s) from the ${p.id} pool expire on Dec 31, ${p.useby.getFullYear()} — plan them before then.` });
      }
    }
  }

  if (remoteLeft < 0) msgs.push({ cls: 'danger', icon: '🚨', text: `Remote work ${cy}: over budget by ${fmt(Math.abs(remoteLeft))} days.` });

  document.getElementById('alerts-box').innerHTML = msgs.map(m => 
    `<div class="alert ${m.cls}"><span>${m.icon}</span> <span>${m.text}</span></div>`
  ).join('');
}

function renderPoolGrid() {
  const cards = POOLS.map(p => {
    const used = p.spent.Used;
    const planned = p.spent.Planned;
    const remaining = p.entitlement - used - planned;
    const accrued = poolAvailableNow(p);
    
    const usedPct = Math.min(100, p.entitlement > 0 ? (used / p.entitlement) * 100 : 0);
    const plannedPct = Math.min(100 - usedPct, p.entitlement > 0 ? (planned / p.entitlement) * 100 : 0);
    
    const isExpired = TODAY > p.useby;
    
    return `<div class="pool-card">
      <div class="pool-title">
        <span>Pool ${p.id}</span>
        <span>${isExpired ? '<span style="color:var(--danger)">Expired</span>' : `use by Dec ${p.useby.getFullYear()}`}</span>
      </div>
      <div class="pool-row"><span>Entitlement</span><span class="pool-val">${fmt(p.entitlement)}</span></div>
      <div class="progress-bar">
        <div style="width:${usedPct}%; background:var(--used);"></div>
        <div style="width:${plannedPct}%; background:var(--planned);"></div>
        <div style="width:${Math.max(0, 100 - usedPct - plannedPct)}%; background:var(--success);"></div>
      </div>
      <div class="pool-row"><span>Accrued so far</span><span class="pool-val" style="color:var(--primary)">${fmt(accrued)}</span></div>
      <div class="pool-row"><span>Used</span><span class="pool-val" style="color:var(--used)">${fmt(used)}</span></div>
      <div class="pool-row"><span>Planned</span><span class="pool-val" style="color:var(--planned)">${fmt(planned)}</span></div>
      <div class="pool-row" style="margin-top: 8px; border-top: 1px solid var(--surface-border); padding-top: 8px;">
        <span style="font-weight:600">Remaining</span>
        <span class="pool-val" style="color:${remaining < 0 ? 'var(--danger)' : 'var(--success)'}">${fmt(remaining)}</span>
      </div>
    </div>`;
  });

  const remYearRows = Object.keys(SETTINGS.remoteYears).sort().map(cy => {
    const budget = SETTINGS.remoteYears[cy];
    const used = entries.filter(e => e.type === 'Remote work' && new Date(e.startDate).getFullYear() === parseInt(cy)).reduce((s,e) => s + e.days, 0);
    const left = budget - used;
    const pct = Math.min(100, budget > 0 ? (used/budget)*100 : 0);
    return `<div style="margin-bottom:12px;">
      <div class="pool-row" style="font-weight:600; color:var(--text); margin-bottom: 2px;">
        <span>${cy}</span><span>${fmt(used)} / ${budget}</span>
      </div>
      <div class="progress-bar" style="margin: 4px 0;">
        <div style="width:${pct}%; background:var(--primary);"></div>
      </div>
      <div class="pool-row" style="font-size: 12px;">
        <span>remaining</span><span style="font-weight:600; color:${left < 0 ? 'var(--danger)' : 'var(--text)'}">${fmt(left)}</span>
      </div>
    </div>`;
  }).join('');

  const remCard = `<div class="pool-card">
    <div class="pool-title"><span>Remote Work</span><span>per calendar year</span></div>
    ${remYearRows}
  </div>`;

  document.getElementById('pool-grid').innerHTML = cards.join('') + remCard;
}

function renderLog() {
  const sorted = [...entries].sort((a,b) => new Date(a.startDate) - new Date(b.startDate) || a.id - b.id);

  document.getElementById('log-list').innerHTML = sorted.map(e => {
    const isRemote = e.type === 'Remote work';
    const dynStatus = getDynStatus(e);
    const bal = balanceAtEntry(e);
    const balCls = bal === null ? '' : bal < 0 ? 'bal-bad' : bal < 2 ? 'bal-warn' : 'bal-ok';
    
    const statusTag = `<span class="tag ${dynStatus === 'Used' ? 'used' : dynStatus === 'Planned' ? 'planned' : 'remote'}">${dynStatus}</span>`;
    
    let allocStr = 'No pool deductions';
    if (!isRemote && e.allocations && e.allocations.length > 0) {
      allocStr = e.allocations.map(a => `${fmt(a.days)}d from ${a.poolId}`).join('\n');
    }

    const infoHover = isRemote ? '' : `<span class="info-icon" title="${allocStr}">i</span>`;

    return `<div class="log-entry">
      <div class="log-entry-main">
        <div class="log-entry-top">
          <input class="table-input log-desc" value="${e.desc.replace(/"/g,'&quot;')}" onchange="updateEntry(${e.id},'desc',this.value)">
          <div class="log-entry-controls">
            <select class="table-input" style="font-size: 13px; font-weight:500; width: auto;" onchange="updateEntry(${e.id},'type',this.value)">
              <option value="Holiday" ${e.type==='Holiday'?'selected':''}>Holiday</option>
              <option value="Remote work" ${e.type==='Remote work'?'selected':''}>Remote work</option>
            </select>
            ${statusTag}
          </div>
        </div>
        <div class="log-entry-bottom">
          <div class="log-entry-dates">
            <input type="date" class="table-input date-input" value="${e.startDate}" onchange="updateEntryDate(${e.id},'startDate',this.value)">
            <span style="color:var(--text-muted);font-size:12px;">to</span>
            <input type="date" class="table-input date-input" value="${e.endDate}" onchange="updateEntryDate(${e.id},'endDate',this.value)">
          </div>
          
          <div style="display:flex; align-items:center; gap: 4px; background:#f1f5f9; padding:2px 8px; border-radius:12px;">
            <span style="font-weight:600; color:var(--text);"><input type="number" min="0.5" max="365" step="0.5" class="table-input" style="width:45px; padding:0; text-align:right; font-weight:600; border:none; background:transparent;" value="${e.days}" onchange="updateEntry(${e.id},'days',parseFloat(this.value))"></span>
            <span style="font-size: 12px;">days</span>
          </div>
          
          <div class="log-balance">
            <span style="font-size:12px; color:var(--text-muted)">Bal:</span> ${isRemote ? `<span style="color:var(--primary);font-weight:600;margin-left:4px;">Remote</span>` : `<span class="${balCls}" style="font-weight:600;margin-left:4px;">${fmt(bal)}</span>`}
            ${infoHover}
          </div>
        </div>
      </div>
      <button class="btn-danger-text log-delete-btn" onclick="deleteEntry(${e.id})" title="Delete">×</button>
    </div>`;
  }).join('');
}

function renderAccTabs() {
  document.getElementById('acc-tabs').innerHTML = POOLS.map(p =>
    `<button class="ytab ${p.id===accTab?'active':''}" onclick="setAccTab('${p.id}')">${p.id}</button>`
  ).join('');
}

function setAccTab(id) { accTab = id; render(); }

function renderAccGrid() {
  const pool = POOLS.find(p => p.id === accTab);
  if (!pool) return;
  document.getElementById('acc-grid').innerHTML = pool.accrualMonths.map(m => {
    const isPast = m.date < new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
    const isCurr = m.date.getMonth()===TODAY.getMonth() && m.date.getFullYear()===TODAY.getFullYear();
    const cls = isCurr ? 'mo current' : isPast ? 'mo past' : 'mo future';
    
    const usedH = entries.filter(e=>e.month===m.label && getDynStatus(e)==='Used' && e.type==='Holiday').reduce((s,e)=>s+e.days,0);
    const planH = entries.filter(e=>e.month===m.label && getDynStatus(e)==='Planned' && e.type==='Holiday').reduce((s,e)=>s+e.days,0);
    const remoteH = entries.filter(e=>e.month===m.label && e.type==='Remote work').reduce((s,e)=>s+e.days,0);
    
    let dots = '';
    if (usedH)   dots += `<span style="color:var(--used)">${fmt(usedH)}d used</span> `;
    if (planH)   dots += `<span style="color:var(--planned)">${fmt(planH)}d plan</span> `;
    if (remoteH) dots += `<span style="color:var(--primary)">${fmt(remoteH)}d remote</span>`;
    
    const monthAccrual = calculateMonthAccrual(pool.baseEntitlement, m.date);

    return `<div class="${cls}">
      <div class="mo-name">${m.label}</div>
      <div class="mo-days" style="color: ${monthAccrual>0 ? 'var(--success)' : 'var(--text-muted)'}">Earns ${monthAccrual.toFixed(2)}</div>
      <div style="font-size: 10px; color: var(--text-muted); margin-bottom: 8px;">Available 1st next mo.</div>
      ${dots ? `<div class="mo-usage">${dots}</div>` : ''}
    </div>`;
  }).join('');
}

function renderSettings() {
  const layout = document.getElementById('settings-layout');
  
  // Holiday Pools Card
  let poolsHtml = `<div class="settings-card">
    <h3>Holiday Entitlements</h3>
    <div class="settings-grid" style="margin-bottom: 16px;">
      <div class="settings-row">
        <div class="settings-row-col">
          <label>Employment Start Date</label>
          <span class="settings-hint">Used for proportional accrual in your first year</span>
        </div>
        <div><input type="date" value="${SETTINGS.employmentStartDate || ''}" onchange="updateStartDate(this.value)"></div>
      </div>
  `;
  poolsHtml += SETTINGS.years.map((ys, i) => {
    const p = POOLS[i];
    return `<div class="settings-row">
      <div class="settings-row-col">
        <label>${p.id} Base Entitlement</label>
        <span class="settings-hint">Default yearly total. Use by Dec 31, ${p.useby.getFullYear()}</span>
      </div>
      <div><input type="number" min="1" max="60" step="1" value="${ys.entitlement}" onchange="updateYearSetting(${i},'entitlement',parseFloat(this.value)||25)" style="width: 80px;"></div>
    </div>`;
  }).join('');
  poolsHtml += `</div>
    <div class="settings-actions">
      <button class="btn" onclick="addYear()">+ Add year</button>
      <button class="btn" onclick="removeLastYear()">− Remove last year</button>
    </div>
  </div>`;

  // Remote Work Card
  let remoteHtml = `<div class="settings-card">
    <h3>Remote Work Budgets</h3>
    <div class="settings-grid">`;
  remoteHtml += Object.keys(SETTINGS.remoteYears).sort().map(cy => {
    return `<div class="settings-row">
      <div class="settings-row-col">
        <label>Budget for ${cy}</label>
        <span class="settings-hint">Calendar year ${cy}</span>
      </div>
      <div><input type="number" min="0" max="365" step="1" value="${SETTINGS.remoteYears[cy]}" onchange="updateRemoteYear(${cy},this.value)" style="width: 80px;"></div>
    </div>`;
  }).join('');
  remoteHtml += `</div></div>`;

  layout.innerHTML = poolsHtml + remoteHtml;
}
