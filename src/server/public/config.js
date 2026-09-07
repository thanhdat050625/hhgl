// Config Page Controller for Hoàng Hậu Cát Tường

const accountsTbody = document.getElementById('accounts-tbody');
const statTotal = document.getElementById('stat-total');
const statOn = document.getElementById('stat-on');
const statOff = document.getElementById('stat-off');
const statSync = document.getElementById('stat-sync');
const btnSyncNow = document.getElementById('btn-sync-now');

const filterSearch = document.getElementById('filter-search');
const countAll = document.getElementById('count-all');
const countOn = document.getElementById('count-on');
const countOff = document.getElementById('count-off');
const pillBtns = document.querySelectorAll('.pill-btn');

// Modal Elements
const btnOpenAddModal = document.getElementById('btn-open-add-modal');
const modalAddAcc = document.getElementById('modal-add-acc');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelAdd = document.getElementById('btn-cancel-add');
const formAddAcc = document.getElementById('form-add-acc');

const headerNoteLink = document.getElementById('header-note-link');
const cardNoteLink = document.getElementById('card-note-link');

let currentAccounts = [];
let togglingEmails = new Set();
let activeFilter = 'all';
let searchQuery = '';

const formatNumber = (num) => {
  return num != null ? new Intl.NumberFormat('vi-VN').format(num) : '--';
};

const renderFilteredAccounts = () => {
  let filtered = currentAccounts.slice();

  // Lọc theo trạng thái Bật / Tắt
  if (activeFilter === 'on') {
    filtered = filtered.filter(a => a.enabled);
  } else if (activeFilter === 'off') {
    filtered = filtered.filter(a => !a.enabled);
  }

  // Lọc theo tìm kiếm từ khóa
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(a => 
      (a.email && a.email.toLowerCase().includes(q)) ||
      (a.playerName && a.playerName.toLowerCase().includes(q)) ||
      (a.serverName && a.serverName.toLowerCase().includes(q)) ||
      String(a.serverId).includes(q)
    );
  }

  if (filtered.length === 0) {
    accountsTbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-4 text-muted">
          ${searchQuery ? 'Không tìm thấy tài khoản nào khớp với từ khóa tìm kiếm.' : 'Chưa có tài khoản nào trong danh sách. Bấm <b>"Thêm Tài Khoản"</b> để bắt đầu.'}
        </td>
      </tr>`;
    return;
  }

  let html = '';
  filtered.forEach(acc => {
    const isBusy = togglingEmails.has(acc.email);

    // Huy hiệu trạng thái runtime
    let stateBadge = '';
    if (acc.state === 'RUNNING') {
      stateBadge = `<span class="badge badge-running"><span class="dot dot-green"></span> Đang chạy 24/7</span>`;
    } else if (acc.state === 'STARTING') {
      stateBadge = `<span class="badge badge-starting"><span class="dot dot-yellow"></span> Đang kết nối...</span>`;
    } else if (acc.state === 'ERROR') {
      stateBadge = `<span class="badge badge-error" title="${acc.lastError || ''}"><span class="dot dot-red"></span> Lỗi login</span>`;
    } else {
      stateBadge = `<span class="badge badge-stopped"><span class="dot dot-gray"></span> Tạm dừng</span>`;
    }

    const toggleChecked = acc.enabled ? 'checked' : '';
    const toggleLabel = acc.enabled ? '<span class="badge badge-on">ON</span>' : '<span class="badge badge-off">OFF</span>';

    html += `
      <tr>
        <td>
          <div class="toggle-wrapper">
            <label class="switch ${isBusy ? 'loading' : ''}">
              <input type="checkbox" ${toggleChecked} ${isBusy ? 'disabled' : ''} onchange="window.handleToggle('${acc.email}', this.checked)">
              <span class="slider"></span>
            </label>
            ${toggleLabel}
          </div>
        </td>
        <td>
          <div style="font-weight: 600; color: #fff;">${acc.email}</div>
        </td>
        <td>
          <span style="color: var(--text-muted);">${acc.serverName || '--'}</span>
          <span style="font-size: 0.75rem; color: #64748B;">(${acc.serverId})</span>
        </td>
        <td>
          <span style="font-weight: 600; color: var(--accent-gold);">${acc.playerName || '--'}</span>
        </td>
        <td>
          <div>Cấp: <b style="color: #fff;">${acc.playerLv || '--'}</b></div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Lực chiến: ${formatNumber(acc.power)}</div>
        </td>
        <td>
          ${stateBadge}
        </td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn btn-secondary btn-sm" onclick="window.viewOnDashboard('${acc.email}')" title="Xem chi tiết trên Dashboard">
              👁️ Xem
            </button>
            <button class="btn btn-danger-outline btn-sm" onclick="window.handleDeleteAcc('${acc.email}')" title="Xóa khỏi Note">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  accountsTbody.innerHTML = html;
};

const updateStats = (accounts) => {
  currentAccounts = accounts || [];
  const total = currentAccounts.length;
  const countOnVal = currentAccounts.filter(a => a.enabled).length;
  const countOffVal = total - countOnVal;

  statTotal.textContent = total;
  statOn.textContent = countOnVal;
  statOff.textContent = countOffVal;

  countAll.textContent = total;
  countOn.textContent = countOnVal;
  countOff.textContent = countOffVal;

  renderFilteredAccounts();
};

// Tìm kiếm & Lọc
filterSearch.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  renderFilteredAccounts();
});

pillBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    pillBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.getAttribute('data-filter');
    renderFilteredAccounts();
  });
});

// Chuyển sang Dashboard xem chi tiết tài khoản
window.viewOnDashboard = (email) => {
  window.location.href = `/?email=${encodeURIComponent(email)}`;
};

// Toggle Bật/Tắt
window.handleToggle = async (email, isChecked) => {
  togglingEmails.add(email);
  renderFilteredAccounts();

  try {
    const res = await fetch('/api/accounts/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        status: isChecked ? 'on' : 'off'
      })
    });
    const json = await res.json();
    if (!json.success) {
      alert('Không thể cập nhật trạng thái: ' + (json.error || 'Lỗi không xác định'));
    }
  } catch (err) {
    alert('Lỗi kết nối khi gửi yêu cầu Bật/Tắt: ' + err.message);
  } finally {
    togglingEmails.delete(email);
  }
};

// Xóa tài khoản
window.handleDeleteAcc = async (email) => {
  if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản ${email} khỏi Web Note?`)) {
    return;
  }

  try {
    const res = await fetch('/api/accounts/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    });
    const json = await res.json();
    if (!json.success) {
      alert('Lỗi xóa tài khoản: ' + (json.error || 'Lỗi không xác định'));
    }
  } catch (err) {
    alert('Lỗi kết nối khi xóa: ' + err.message);
  }
};

// Đồng bộ ngay
btnSyncNow.addEventListener('click', async () => {
  btnSyncNow.disabled = true;
  btnSyncNow.innerHTML = '<span class="icon">⏳</span> Đang đồng bộ...';

  try {
    const res = await fetch('/api/sync', { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      statSync.textContent = 'Vừa đồng bộ xong!';
      setTimeout(() => { statSync.textContent = '10s/lần'; }, 3000);
    }
  } catch (err) {
    alert('Lỗi khi gửi yêu cầu đồng bộ: ' + err.message);
  } finally {
    btnSyncNow.disabled = false;
    btnSyncNow.innerHTML = '<span class="icon">🔄</span> Đồng Bộ Note Ngay';
  }
});

// Modal Thêm tài khoản
btnOpenAddModal.addEventListener('click', () => {
  modalAddAcc.style.display = 'flex';
  document.getElementById('input-add-email').focus();
});

const closeModal = () => {
  modalAddAcc.style.display = 'none';
  formAddAcc.reset();
};

btnCloseModal.addEventListener('click', closeModal);
btnCancelAdd.addEventListener('click', closeModal);

modalAddAcc.addEventListener('click', (e) => {
  if (e.target === modalAddAcc) closeModal();
});

formAddAcc.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('input-add-email').value.trim();
  const password = document.getElementById('input-add-pass').value.trim();
  const status = document.getElementById('input-add-status').value;
  const serverId = parseInt(document.getElementById('input-add-server').value) || 1105;

  if (!email || !password) {
    alert('Vui lòng nhập đầy đủ Email và Mật khẩu!');
    return;
  }

  const btnSubmit = formAddAcc.querySelector('button[type="submit"]');
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Đang lưu...';

  try {
    const res = await fetch('/api/accounts/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, status, serverId })
    });
    const json = await res.json();
    if (json.success) {
      closeModal();
    } else {
      alert('Không thể thêm tài khoản: ' + (json.error || 'Lỗi không xác định'));
    }
  } catch (err) {
    alert('Lỗi kết nối khi thêm tài khoản: ' + err.message);
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Lưu & Đồng Bộ Note';
  }
});

// Realtime SSE Connection
const connectSSE = () => {
  const evtSource = new EventSource('/events');

  evtSource.addEventListener('init', (e) => {
    const data = JSON.parse(e.data);
    updateStats(data.accounts);

    if (data.noteUrl) {
      if (headerNoteLink) headerNoteLink.href = data.noteUrl;
      if (cardNoteLink) cardNoteLink.href = data.noteUrl;
    }
    if (data.syncStatus && statSync) {
      statSync.textContent = data.syncStatus;
    }
  });

  evtSource.addEventListener('accounts_update', (e) => {
    const data = JSON.parse(e.data);
    updateStats(data.accounts);
    if (data.syncStatus && statSync) {
      statSync.textContent = data.syncStatus;
    }
  });

  evtSource.onerror = () => {
    statSync.textContent = 'Mất kết nối SSE, đang thử lại...';
  };
};

connectSSE();
