// --- ACTIONS ---
function updateStartDate(val) {
  SETTINGS.employmentStartDate = val || null;
  render();
}

function addYear() {
  const lastYear = SETTINGS.years[SETTINGS.years.length - 1].accrualStartYear;
  SETTINGS.years.push({ accrualStartYear: lastYear + 1, entitlement: 25 });
  render();
}

function removeLastYear() {
  if (SETTINGS.years.length <= 1) return;
  SETTINGS.years.pop();
  render();
}

function updateYearSetting(idx, field, val) { SETTINGS.years[idx][field] = val; render(); }
function updateRemoteYear(calYear, val) { SETTINGS.remoteYears[String(calYear)] = parseFloat(val) || 0; render(); }

function updateEntry(id, field, value) {
  const e = entries.find(e => e.id === id);
  if (!e) return;
  e[field] = value;
  render();
}

function updateEntryDate(id, field, value) {
  const e = entries.find(e => e.id === id);
  if (!e) return;
  e[field] = value;
  
  if (field === 'startDate') {
    const d = new Date(value);
    e.month = MN[d.getMonth()] + ' ' + d.getFullYear();
    if (!e.endDate || e.endDate < value) e.endDate = value;
    autoExpandYearsForDate(value);
  } else if (field === 'endDate') {
    if (e.startDate && value < e.startDate) e.startDate = value;
  }
  
  if (e.startDate && e.endDate) {
    const d = calculateWorkingDays(e.startDate, e.endDate);
    if (d > 0) e.days = d;
  }
  
  render();
}

function addEntry() {
  let desc = document.getElementById('f-desc').value.trim();
  const startDate = document.getElementById('f-start').value;
  let endDate = document.getElementById('f-end').value;
  const type = document.getElementById('f-type').value;
  
  if (!startDate) return alert("Start Date is required.");
  if (!endDate) return alert("End Date is required.");
  
  if (endDate < startDate) {
    endDate = startDate;
  }
  
  const d = new Date(startDate);
  const month = MN[d.getMonth()] + ' ' + d.getFullYear();
  
  if (!desc) {
    desc = `Holiday ${month}`;
  }
  
  const days = calculateWorkingDays(startDate, endDate);
  if (days <= 0 && type === 'Holiday') {
    return alert("This date range contains 0 working days.");
  }
  
  entries.push({ id: nextId++, desc, startDate, endDate, month, type, days: days > 0 ? days : 1 });
  
  document.getElementById('f-desc').value = '';
  document.getElementById('f-start').value = '';
  document.getElementById('f-end').value = '';
  
  autoExpandYearsForDate(startDate);
  render();
}

function deleteEntry(id) {
  if (confirm("Are you sure you want to delete this holiday entry?")) {
    entries = entries.filter(e => e.id !== id);
    render();
  }
}

function importCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const lines = e.target.result.split('\n').map(l => l.trim()).filter(l => l);
    if (!lines.length) return alert('Empty file.');
    const header = lines[0].split(',').map(h => h.replace(/"/g,'').trim().toLowerCase());
    
    const iStart = header.findIndex(h => h.includes('start'));
    const iEnd = header.findIndex(h => h.includes('end'));
    const iMonth = header.findIndex(h => h.includes('month'));
    const iDesc = header.findIndex(h => h.includes('desc'));
    const iType = header.findIndex(h => h.includes('type') || h.includes('status'));
    const iDays = header.findIndex(h => h.includes('day'));
    
    if (iDesc < 0 || iType < 0 || iDays < 0 || (iStart < 0 && iMonth < 0)) {
      return alert('Could not find required columns (Description, Start Date/Month, Type, Days).');
    }
    
    const parsed = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].match(/("([^"]*)"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) || [];
      const get = idx => (cols[idx] || '').replace(/^"|"$/g,'').trim();
      const desc = get(iDesc), typeStr = get(iType);
      const days = parseFloat(get(iDays));
      let startDate = iStart >= 0 ? get(iStart) : '';
      let endDate = iEnd >= 0 ? get(iEnd) : startDate;
      
      if (!startDate && iMonth >= 0) {
         const monthStr = get(iMonth);
         const parts = monthStr.split(' ');
         if (parts.length === 2) {
           const y = parseInt(parts[1]);
           const mIdx = MN.findIndex(m => m.toLowerCase() === parts[0].toLowerCase());
           if (y && mIdx >= 0) {
             startDate = `${y}-${String(mIdx+1).padStart(2,'0')}-01`;
             endDate = startDate;
           }
         }
      }
      
      const isRemote = typeStr.toLowerCase().includes('remote');
      const type = isRemote ? 'Remote work' : 'Holiday';
      
      if (desc && startDate && !isNaN(days) && days > 0) {
        if (!endDate) endDate = startDate;
        const d = new Date(startDate);
        const month = MN[d.getMonth()] + ' ' + d.getFullYear();
        parsed.push({ desc, startDate, endDate, month, type, days });
        autoExpandYearsForDate(startDate);
      }
    }
    
    if (!parsed.length) return alert(`No valid rows found.`);
    if (confirm(`Found ${parsed.length} valid row(s).\n\nOK = replace log, Cancel = merge/append.`)) {
      entries = parsed.map((e, i) => ({ id: i+1, ...e }));
      nextId = entries.length + 1;
    } else {
      for (const p of parsed) {
        if (!entries.some(e => e.desc===p.desc && e.startDate===p.startDate && e.type===p.type && e.days===p.days)) {
          entries.push({ id: nextId++, ...p });
        }
      }
    }
    event.target.value = '';
    render();
  };
  reader.readAsText(file);
}

function exportCSV() {
  const rows = [['Description','Start Date','End Date','Type','Days']];
  const sorted = [...entries].sort((a,b) => new Date(a.startDate) - new Date(b.startDate) || a.id - b.id);
  for (const e of sorted) rows.push([`"${e.desc.replace(/"/g,'""')}"`, e.startDate, e.endDate, e.type, e.days]);
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'holiday_log.csv'; a.click();
  URL.revokeObjectURL(url);
}

// Init
render();
