// --- UTILS & CONSTANTS ---
const TODAY = new Date();
const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function currentHolidayYearStart() {
  return TODAY.getMonth() >= 8 ? TODAY.getFullYear() : TODAY.getFullYear() - 1;
}

function fmt(n) { return isNaN(n) || n === null ? '—' : (Math.round(n * 10) / 10).toFixed(2); }

function genMonths(sy, sm, count) {
  const out = []; let y = sy, m = sm;
  for (let i = 0; i < count; i++) {
    out.push({ date: new Date(y, m-1, 1), label: MN[m-1]+' '+y });
    if (++m > 12) { m=1; y++; }
  }
  return out;
}

// --- STATE MANAGEMENT (LocalStorage) ---
let SETTINGS = JSON.parse(localStorage.getItem('ht_settings')) || {
  employmentStartDate: null,
  years: [
    { accrualStartYear: currentHolidayYearStart(),     entitlement: 25 },
    { accrualStartYear: currentHolidayYearStart() + 1, entitlement: 25 },
  ],
  remoteYears: {}
};

let entries = JSON.parse(localStorage.getItem('ht_entries'));
if (!entries) {
  entries = [];
}

// Migration for legacy month/status format
entries = entries.map(e => {
  if (!e.startDate && e.month) {
    const parts = e.month.split(' ');
    if (parts.length === 2) {
      const mIdx = MN.findIndex(m => m.toLowerCase() === parts[0].toLowerCase());
      if (mIdx >= 0) {
        e.startDate = `${parts[1]}-${String(mIdx + 1).padStart(2, '0')}-01`;
        e.endDate = e.startDate;
      }
    }
  }
  if (e.startDate) {
    const d = new Date(e.startDate);
    e.month = MN[d.getMonth()] + ' ' + d.getFullYear();
  }
  if (!e.type) {
    e.type = e.status === 'Remote work' ? 'Remote work' : 'Holiday';
    delete e.status;
  }
  return e;
});

let nextId = Math.max(...entries.map(e => e.id), 0) + 1;

let POOLS = [];
let ALL_MONTHS = [];
let accTab = null;

function saveData() {
  localStorage.setItem('ht_settings', JSON.stringify(SETTINGS));
  localStorage.setItem('ht_entries', JSON.stringify(entries));
}
