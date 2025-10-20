// DOM Elements
const els = {
  loginScreen: document.getElementById('loginScreen'),
  loginForm: document.getElementById('loginForm'),
  loginError: document.getElementById('loginError'),
  app: document.getElementById('app'),
  tableBody: document.querySelector('#inventoryTable tbody'),
  searchInput: document.getElementById('searchInput'),
  addNewBtn: document.getElementById('addNewBtn'),
  modal: document.getElementById('modal'),
  modalClose: document.getElementById('modalClose'),
  recordForm: document.getElementById('recordForm'),
  cancelBtn: document.getElementById('cancelBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  selectAll: document.getElementById('selectAll'),
  bulkActionBar: document.getElementById('bulkActionBar'),
  selectedCount: document.getElementById('selectedCount'),
  bulkEditBtn: document.getElementById('bulkEditBtn'),
  bulkDeleteBtn: document.getElementById('bulkDeleteBtn'),
  pagination: document.getElementById('pagination'),
  recordCount: document.getElementById('recordCount'),
  totalCount: document.getElementById('totalCount'),
  shareHandoverBtn: document.getElementById('shareHandoverBtn')
};

const FIELD_LABELS = {
  ticketNumber: 'Ticket',
  operatorName: 'Operator',
  shift: 'Shift',
  region: 'Region',
  date: 'Date',
  source: 'Source',
  caseDetails: 'Case Details',
  actionTaken: 'Action Taken',
  remark: 'Remark',
  timestamp: 'Date Modified'
};

let data = [];
let filteredData = [];
let currentPage = 1;
const recordsPerPage = 20;
let selectedRows = new Set();

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 3000);
}

// === Compression for Shareable URLs ===
function compressToUrlSafeBase64(data) {
  const json = JSON.stringify(data);
  const compressed = btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (match, p1) => {
    return String.fromCharCode('0x' + p1);
  }));
  return compressed.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function decompressFromUrlSafeBase64(str) {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function generateHandoverUrl(records) {
  const compressed = compressToUrlSafeBase64(records);
  const baseUrl = window.location.origin + '/h/';
  const id = Math.random().toString(36).substring(2, 8);
  return `${baseUrl}${id}#${compressed}`;
}

function showRecordDetail(index) {
  const record = data[index];
  if (!record) return;

  let detailModal = document.getElementById('detailModal');
  if (!detailModal) {
    detailModal = document.createElement('div');
    detailModal.id = 'detailModal';
    detailModal.className = 'detail-modal hidden';
    detailModal.innerHTML = `
      <div class="detail-modal-content">
        <button class="detail-close" aria-label="Close detail">&times;</button>
        <div id="detailFields"></div>
      </div>
    `;
    document.body.appendChild(detailModal);

    const closeBtn = detailModal.querySelector('.detail-close');
    closeBtn.addEventListener('click', () => {
      detailModal.classList.add('hidden');
    });

    detailModal.addEventListener('click', e => {
      if (e.target === detailModal) {
        detailModal.classList.add('hidden');
      }
    });
  }

  const detailFields = detailModal.querySelector('#detailFields');
  detailFields.innerHTML = '';

  const fields = [
    { key: 'ticketNumber', label: 'Ticket' },
    { key: 'operatorName', label: 'Operator' },
    { key: 'shift', label: 'Shift' },
    { key: 'region', label: 'Region' },
    { key: 'date', label: 'Date' },
    { key: 'source', label: 'Source' },
    { key: 'caseDetails', label: 'Case Details', wide: true },
    { key: 'actionTaken', label: 'Action Taken', wide: true },
    { key: 'remark', label: 'Remark', wide: true },
    { key: 'timestamp', label: 'Date Modified' }
  ];

  fields.forEach(field => {
    const div = document.createElement('div');
    div.setAttribute('data-label', field.label);
    if (field.wide) {
      div.className = 'detail-wide';
      div.textContent = record[field.key] || '';
    } else {
      div.className = 'detail-field';
      div.textContent = record[field.key] || '';
    }
    detailFields.appendChild(div);
  });

  detailModal.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  const storedData = localStorage.getItem('inventoryRecords');
  if (storedData) {
    data = JSON.parse(storedData);
    data.forEach(rec => {
      if (rec.id == null) rec.id = generateId();
    });
  } else {
    data = [
      {
        id: generateId(),
        ticketNumber: "TK001",
        operatorName: "John Doe",
        shift: "Morning",
        region: "Region 1",
        date: "2025-10-14",
        source: "Email",
        caseDetails: "Case details text here...",
        actionTaken: "Action taken here...",
        remark: "Remark is very long...",
        timestamp: new Date().toISOString()
      }
    ];
    localStorage.setItem('inventoryRecords', JSON.stringify(data));
  }
  filteredData = [...data];
  filteredData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (localStorage.getItem('isLoggedIn') === 'true') {
    els.loginScreen.classList.add('hidden');
    els.app.classList.remove('hidden');
    renderTable();
    els.searchInput.focus();
  }

  els.tableBody.addEventListener('click', (e) => {
    if (e.target.closest('td:first-child')) return;
    if (window.matchMedia('(min-width: 801px)').matches) return;
    const row = e.target.closest('tr');
    if (row && row.dataset.id) {
      const id = row.dataset.id;
      const index = data.findIndex(rec => rec.id === id);
      if (index !== -1) showRecordDetail(index);
    }
  });

  if (els.shareHandoverBtn) {
    els.shareHandoverBtn.addEventListener('click', async () => {
      try {
        els.shareHandoverBtn.disabled = true;
        els.shareHandoverBtn.textContent = 'Generating...';

        const recordsToShare = filteredData.map(rec => ({
          ticketNumber: rec.ticketNumber,
          operatorName: rec.operatorName,
          shift: rec.shift,
          region: rec.region,
          date: rec.date,
          source: rec.source,
          caseDetails: rec.caseDetails,
          actionTaken: rec.actionTaken,
          remark: rec.remark,
          timestamp: rec.timestamp
        }));

        const url = generateHandoverUrl(recordsToShare);
        await navigator.clipboard.writeText(url);
        showToast('✅ Shareable link copied! Paste in WhatsApp.');
      } catch (err) {
        console.error('Handover share error:', err);
        showToast('Failed to generate link.', 'error');
      } finally {
        els.shareHandoverBtn.disabled = false;
        els.shareHandoverBtn.textContent = 'Share Handover';
      }
    });
  }
});

function saveData() {
  try {
    localStorage.setItem('inventoryRecords', JSON.stringify(data));
  } catch (e) {
    showToast('Storage full! Cannot save data.', 'error');
    console.error('LocalStorage error:', e);
  }
}

els.loginForm.addEventListener('submit', e => {
  e.preventDefault();
  const { username, password } = els.loginForm;
  if (username.value.trim() === "admin" && password.value.trim() === "admin") {
    localStorage.setItem('isLoggedIn', 'true');
    els.loginScreen.classList.add('hidden');
    els.app.classList.remove('hidden');
    renderTable();
    els.searchInput.focus();
  } else {
    els.loginError.textContent = "Invalid username or password.";
  }
});

els.logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('isLoggedIn');
  els.app.classList.add('hidden');
  els.loginScreen.classList.remove('hidden');
  els.loginForm.reset();
  els.loginError.textContent = "";
});

function renderTable() {
  const startIndex = (currentPage - 1) * recordsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + recordsPerPage);
  
  els.recordCount.textContent = filteredData.length;
  els.totalCount.textContent = data.length;

  els.tableBody.innerHTML = "";
  
  if (paginatedData.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 11;
    cell.style.textAlign = 'center';
    cell.style.padding = '30px';
    cell.style.color = '#666';
    cell.textContent = filteredData.length === 0 
      ? 'No records found. Try a different search.' 
      : 'No records on this page.';
    row.appendChild(cell);
    els.tableBody.appendChild(row);
    renderPagination();
    updateBulkActionBar();
    return;
  }

  paginatedData.forEach(record => {
    const row = document.createElement('tr');
    row.dataset.id = record.id;

    const checkCell = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.id = record.id;
    checkbox.checked = selectedRows.has(record.id);
    checkbox.addEventListener('change', handleRowSelect);
    checkCell.appendChild(checkbox);
    row.appendChild(checkCell);
    
    const fields = [
      { key: 'ticketNumber', label: 'Ticket' },
      { key: 'operatorName', label: 'Operator' },
      { key: 'shift', label: 'Shift' },
      { key: 'region', label: 'Region' },
      { key: 'date', label: 'Date' },
      { key: 'source', label: 'Source' },
      { key: 'caseDetails', label: 'Case Details' },
      { key: 'actionTaken', label: 'Action Taken' },
      { key: 'remark', label: 'Remark' }
    ];

    fields.forEach(({ key, label }) => {
      const cell = document.createElement('td');
      cell.textContent = record[key] || '';
      cell.setAttribute('data-label', label);
      if (['caseDetails', 'actionTaken', 'remark'].includes(key)) {
        cell.classList.add('wide-col');
        cell.setAttribute('col-title', record[key] || '');
      }
      row.appendChild(cell);
    });

    const timeCell = document.createElement('td');
    timeCell.textContent = new Date(record.timestamp).toLocaleString();
    timeCell.setAttribute('data-label', 'Date Modified');
    row.appendChild(timeCell);

    els.tableBody.appendChild(row);
  });

  renderPagination();
  updateBulkActionBar();
}

function renderPagination() {
  const totalPages = Math.ceil(filteredData.length / recordsPerPage);
  els.pagination.innerHTML = '';
  
  if (totalPages <= 1) return;

  if (currentPage > 1) {
    const prev = document.createElement('button');
    prev.textContent = '«';
    prev.addEventListener('click', () => { currentPage--; renderTable(); });
    els.pagination.appendChild(prev);
  }

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    if (i === currentPage) btn.classList.add('active');
    btn.addEventListener('click', () => { currentPage = i; renderTable(); });
    els.pagination.appendChild(btn);
  }

  if (currentPage < totalPages) {
    const next = document.createElement('button');
    next.textContent = '»';
    next.addEventListener('click', () => { currentPage++; renderTable(); });
    els.pagination.appendChild(next);
  }
}

function handleRowSelect(e) {
  const id = e.target.dataset.id;
  if (e.target.checked) {
    selectedRows.add(id);
  } else {
    selectedRows.delete(id);
  }
  updateBulkActionBar();
}

els.selectAll.addEventListener('change', () => {
  const checkboxes = document.querySelectorAll('#inventoryTable tbody input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.checked = els.selectAll.checked;
    const id = cb.dataset.id;
    if (els.selectAll.checked) {
      selectedRows.add(id);
    } else {
      selectedRows.delete(id);
    }
  });
  updateBulkActionBar();
});

function updateBulkActionBar() {
  const count = selectedRows.size;
  if (count > 0) {
    els.bulkActionBar.classList.remove('hidden');
    els.selectedCount.textContent = `${count} record${count === 1 ? '' : 's'} selected`;
  } else {
    els.bulkActionBar.classList.add('hidden');
    els.selectAll.checked = false;
  }
}

els.bulkEditBtn.addEventListener('click', () => {
  if (selectedRows.size !== 1) {
    showToast('Please select exactly one record to edit.', 'error');
    return;
  }
  const id = Array.from(selectedRows)[0];
  const index = data.findIndex(rec => rec.id === id);
  if (index === -1) return;
  openModal(index);
});

els.bulkDeleteBtn.addEventListener('click', () => {
  if (selectedRows.size === 0) return;
  if (!confirm(`Delete ${selectedRows.size} record(s)?`)) return;

  const deletedRecords = JSON.parse(localStorage.getItem('deletedInventoryRecords') || '[]');
  const now = new Date().toISOString();

  const newDeleted = [];
  const newData = [];
  data.forEach(rec => {
    if (selectedRows.has(rec.id)) {
      newDeleted.push({ ...rec, deletedAt: now });
    } else {
      newData.push(rec);
    }
  });

  data = newData;
  deletedRecords.push(...newDeleted);
  localStorage.setItem('deletedInventoryRecords', JSON.stringify(deletedRecords));
  saveData();

  selectedRows.clear();
  currentPage = 1;
  filteredData = [...data];
  filteredData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  renderTable();
  showToast('Record(s) deleted.');
});

let searchTimeout;
els.searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const term = els.searchInput.value.trim().toLowerCase();
    filteredData = data.filter(item =>
      Object.values(item).some(val => String(val).toLowerCase().includes(term))
    );
    if (currentSort.key) {
      applySorting(currentSort.key, currentSort.asc);
    } else {
      filteredData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
    currentPage = 1;
    renderTable();
  }, 300);
});

let currentSort = { key: 'timestamp', asc: false };

function applySorting(key, asc) {
  filteredData.sort((a, b) => {
    if (key === 'timestamp') {
      const aTime = new Date(a[key]).getTime();
      const bTime = new Date(b[key]).getTime();
      return asc ? aTime - bTime : bTime - aTime;
    } else {
      const aVal = String(a[key]).toLowerCase();
      const bVal = String(b[key]).toLowerCase();
      if (aVal < bVal) return asc ? -1 : 1;
      if (aVal > bVal) return asc ? 1 : -1;
      return 0;
    }
  });
}

document.querySelector('#inventoryTable thead').addEventListener('click', e => {
  const th = e.target.closest('th[data-sort]');
  if (!th) return;
  
  const key = th.dataset.sort;
  if (currentSort.key === key) {
    currentSort.asc = !currentSort.asc;
  } else {
    currentSort.key = key;
    currentSort.asc = key === 'timestamp' ? false : true;
  }
  
  applySorting(currentSort.key, currentSort.asc);
  currentPage = 1;
  renderTable();
});

els.addNewBtn.addEventListener('click', () => openModal());
els.modalClose.addEventListener('click', closeModal);
els.cancelBtn.addEventListener('click', closeModal);

function openModal(index = null) {
  if (index !== null) {
    const rec = data[index];
    Object.keys(rec).forEach(key => {
      if (els.recordForm[key]) els.recordForm[key].value = rec[key];
    });
    els.recordForm.recordIndex.value = index;
    els.modal.querySelector('#modalTitle').textContent = "Edit Record";
  } else {
    els.recordForm.reset();
    els.recordForm.recordIndex.value = "";
    els.modal.querySelector('#modalTitle').textContent = "Add New Record";
    const today = new Date().toISOString().split('T')[0];
    if (els.date) els.date.value = today;
  }
  els.modal.classList.remove('hidden');
}

function closeModal() {
  els.modal.classList.add('hidden');
  els.recordForm.reset();
}

els.recordForm.addEventListener('submit', e => {
  e.preventDefault();
  if (!els.recordForm.checkValidity()) return;
  
  const formData = new FormData(els.recordForm);
  const index = formData.get('recordIndex');
  const nowIso = new Date().toISOString();
  
  const newRecord = {
    id: index !== "" ? data[parseInt(index, 10)].id : generateId(),
    ticketNumber: formData.get('ticketNumber').trim(),
    operatorName: formData.get('operatorName').trim(),
    shift: formData.get('shift'),
    region: formData.get('region').trim(),
    date: formData.get('date'),
    source: formData.get('source').trim(),
    caseDetails: formData.get('caseDetails').trim(),
    actionTaken: formData.get('actionTaken').trim(),
    remark: formData.get('remark').trim(),
    timestamp: nowIso
  };
  
  if (index !== "") {
    data[parseInt(index, 10)] = newRecord;
  } else {
    data.push(newRecord);
  }
  
  saveData();
  closeModal();
  filteredData = [...data];
  filteredData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  currentPage = 1;
  renderTable();
  showToast(index !== "" ? 'Record updated.' : 'Record added.');
});