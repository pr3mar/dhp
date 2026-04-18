// --- HOLIDAY ENGINE ---
function getEaster(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = Math.floor((h + l - 7 * m + 114) / 31), p = (h + l - 7 * m + 114) % 31;
  return new Date(year, n - 1, p + 1);
}

function getDanishHolidays(year) {
  const easter = getEaster(year);
  const addDays = (d, days) => new Date(d.getTime() + days * 86400000);
  const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  
  const hols = [
    `${year}-01-01`, // Nytårsdag
    fmtDate(addDays(easter, -3)), // Skærtorsdag
    fmtDate(addDays(easter, -2)), // Langfredag
    fmtDate(addDays(easter, 1)),  // 2. Påskedag
    `${year}-05-01`, // 1. maj (Labour Day)
    fmtDate(addDays(easter, 39)), // Kristi Himmelfartsdag
    fmtDate(addDays(easter, 50)), // 2. Pinsedag
    `${year}-06-05`, // Grundlovsdag (Constitution Day)
    `${year}-12-24`, // Juleaftensdag
    `${year}-12-25`, // Juledag
    `${year}-12-26`, // 2. Juledag
    `${year}-12-31`  // Nytårsaftensdag
  ];
  if (year < 2024) hols.push(fmtDate(addDays(easter, 26))); // Store Bededag
  return hols;
}

function calculateWorkingDays(startStr, endStr) {
  if (!startStr) return 0;
  if (!endStr) return 1;
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (start > end) return 0;
  
  const sy = start.getFullYear(), ey = end.getFullYear();
  let hols = [];
  for (let y = sy; y <= ey; y++) hols.push(...getDanishHolidays(y));
  
  let days = 0;
  let curr = new Date(start);
  while (curr <= end) {
    const wd = curr.getDay();
    const dStr = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;
    if (wd !== 0 && wd !== 6 && !hols.includes(dStr)) days++;
    curr.setDate(curr.getDate() + 1);
  }
  return days;
}

function autoExpandYearsForDate(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const mIdx = d.getMonth();
  const accrualStart = mIdx >= 8 ? y : y - 1;
  let maxYear = Math.max(...SETTINGS.years.map(ys => ys.accrualStartYear));
  let minYear = Math.min(...SETTINGS.years.map(ys => ys.accrualStartYear));
  let changed = false;
  while (maxYear < accrualStart) {
     maxYear++;
     SETTINGS.years.push({ accrualStartYear: maxYear, entitlement: 25 });
     changed = true;
  }
  while (minYear > accrualStart) {
     minYear--;
     SETTINGS.years.unshift({ accrualStartYear: minYear, entitlement: 25 });
     changed = true;
  }
  return changed;
}

function getDynStatus(e) {
  if (e.type === 'Remote work') return 'Remote work';
  if (!e.startDate) return 'Planned';
  const d = new Date(e.startDate);
  const t = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
  return d <= t ? 'Used' : 'Planned';
}

// --- CORE LOGIC ---
function calculateMonthAccrual(baseEntitlement, mDate) {
  if (!SETTINGS.employmentStartDate) return baseEntitlement / 12;
  
  const empStart = new Date(SETTINGS.employmentStartDate);
  const monthEnd = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0); 
  
  if (monthEnd < empStart) return 0; 
  
  if (empStart.getFullYear() === mDate.getFullYear() && empStart.getMonth() === mDate.getMonth()) {
    const daysInMonth = monthEnd.getDate();
    const daysEmployed = daysInMonth - empStart.getDate() + 1;
    const dailyRate = (baseEntitlement / 12) / 30;
    const accrued = daysEmployed * dailyRate;
    return Math.min(accrued, baseEntitlement / 12);
  }
  
  return baseEntitlement / 12;
}

function buildPools() {
  POOLS = SETTINGS.years.map(ys => {
    const sy = ys.accrualStartYear;
    const ey = sy + 1;
    const poolMonths = genMonths(sy, 9, 12);
    
    let effectiveEntitlement = ys.entitlement;
    if (SETTINGS.employmentStartDate) {
      const empStart = new Date(SETTINGS.employmentStartDate);
      const poolStart = new Date(sy, 8, 1);
      const poolEnd = new Date(ey, 7, 31);
      
      if (empStart >= poolStart && empStart <= poolEnd) {
         effectiveEntitlement = poolMonths.reduce((sum, am) => sum + calculateMonthAccrual(ys.entitlement, am.date), 0);
      } else if (empStart > poolEnd) {
         effectiveEntitlement = 0;
      }
    }

    return {
      id: `${sy}/${String(ey).slice(2)}`,
      accrualStartYear: sy,
      entitlement: effectiveEntitlement,
      baseEntitlement: ys.entitlement,
      accrualMonths: poolMonths,
      validMonths: genMonths(sy, 9, 16),
      useby: new Date(ey, 11, 31, 23, 59, 59),
      spent: { Used: 0, Planned: 0 }
    };
  });
  if (!accTab || !POOLS.find(p => p.id === accTab)) accTab = POOLS[0].id;

  const seen = new Set();
  ALL_MONTHS = [];
  for (const p of POOLS) {
    for (const m of p.validMonths) {
      if (!seen.has(m.label)) { seen.add(m.label); ALL_MONTHS.push(m); }
    }
  }
  ALL_MONTHS.sort((a,b) => a.date - b.date);

  const calYears = new Set(ALL_MONTHS.map(m => m.date.getFullYear()));
  for (const y of calYears) {
    if (!(String(y) in SETTINGS.remoteYears)) SETTINGS.remoteYears[String(y)] = 30;
  }
  for (const k of Object.keys(SETTINGS.remoteYears)) {
    if (!calYears.has(parseInt(k))) delete SETTINGS.remoteYears[k];
  }
}

function monthDate(label) {
  const m = ALL_MONTHS.find(m => m.label === label);
  return m ? m.date : null;
}

function poolAccruedByMonth(pool, monthLabel) {
  const mDate = monthDate(monthLabel);
  if (!mDate) return 0;
  if (mDate >= new Date(pool.accrualStartYear + 1, 8, 1)) return pool.entitlement; 
  
  let accrued = 0;
  for (const am of pool.accrualMonths) {
    if (am.date < mDate) {
      accrued += calculateMonthAccrual(pool.baseEntitlement, am.date);
    }
  }
  return Math.min(accrued, pool.entitlement);
}

function poolAvailableNow(pool) {
  const currentMonthDate = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
  if (currentMonthDate >= new Date(pool.accrualStartYear + 1, 8, 1)) return pool.entitlement;
  
  let accrued = 0;
  for (const am of pool.accrualMonths) {
    if (am.date < currentMonthDate) {
      accrued += calculateMonthAccrual(pool.baseEntitlement, am.date);
    }
  }
  return Math.min(accrued, pool.entitlement);
}

function computeLedger() {
  POOLS.forEach(p => p.spent = { Used: 0, Planned: 0 });
  const sortedEntries = [...entries].sort((a,b) => new Date(a.startDate) - new Date(b.startDate) || a.id - b.id);

  for (const e of sortedEntries) {
    if (e.type === 'Remote work') continue;
    let needed = e.days;
    e.allocations = [];
    const dynStatus = getDynStatus(e);
    
    const validPools = POOLS
      .filter(p => p.validMonths.some(m => m.label === e.month))
      .sort((a,b) => a.accrualStartYear - b.accrualStartYear);
      
    for (const p of validPools) {
      if (needed <= 0) break;
      const totalSpent = p.spent.Used + p.spent.Planned;
      const avail = p.entitlement - totalSpent;
      if (avail > 0) {
        const take = Math.min(needed, avail);
        p.spent[dynStatus] += take;
        e.allocations.push({ poolId: p.id, days: take });
        needed -= take;
      }
    }
    
    if (needed > 0 && validPools.length > 0) {
      const p = validPools[validPools.length - 1];
      p.spent[dynStatus] += needed;
      e.allocations.push({ poolId: p.id, days: needed });
      needed = 0;
    }
    e.unfunded = needed; 
  }
}

function balanceAtEntry(e) {
  if (e.type === 'Remote work') return null;
  
  const validPoolIds = POOLS.filter(p => p.validMonths.some(m => m.label === e.month)).map(p => p.id);
  const totalAccrued = POOLS.filter(p => validPoolIds.includes(p.id)).reduce((sum, p) => sum + poolAccruedByMonth(p, e.month), 0);
  
  let totalSpent = 0;
  const sortedEntries = [...entries].sort((a,b) => new Date(a.startDate) - new Date(b.startDate) || a.id - b.id);
  
  for (const e2 of sortedEntries) {
    if (e2.type === 'Remote work') continue;
    
    for (const alloc of e2.allocations || []) {
      if (validPoolIds.includes(alloc.poolId)) {
        totalSpent += alloc.days;
      }
    }
    
    if (e2.id === e.id) break;
  }
  
  return totalAccrued - totalSpent;
}
