const term = document.getElementById('terminal-content');
const autoScrollCb = document.getElementById('auto-scroll');
const btnClear = document.getElementById('btn-clear');
const elLiveStatus = document.getElementById('live-status');

// Elements Quản Lý Multi-Account
const accountsTbody = document.getElementById('accounts-tbody');
const statTotal = document.getElementById('stat-total');
const statOn = document.getElementById('stat-on');
const statOff = document.getElementById('stat-off');
const statSync = document.getElementById('stat-sync');
const selectActiveAcc = document.getElementById('select-active-acc');
const btnSyncNow = document.getElementById('btn-sync-now');

// Modal Elements
const btnOpenAddModal = document.getElementById('btn-open-add-modal');
const modalAddAcc = document.getElementById('modal-add-acc');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelAdd = document.getElementById('btn-cancel-add');
const formAddAcc = document.getElementById('form-add-acc');

let currentAccounts = [];
let currentSelectedEmail = null;
let togglingEmails = new Set();
const accountLogsCache = new Map(); // email.toLowerCase() -> Array<LogEntry>
let currentBuildId = null;

const formatNumber = (num) => {
  return num != null ? new Intl.NumberFormat('vi-VN').format(num) : '--';
};

const colorizeText = (text) => {
  text = text.replace(/\[Nội Vụ\]/g, '<span class="tag-noivu">[Nội Vụ]</span>');
  text = text.replace(/\[Cung Vụ\]/g, '<span class="tag-cungvu">[Cung Vụ]</span>');
  text = text.replace(/\[Phúc Lợi\]/g, '<span class="tag-phucloi">[Phúc Lợi]</span>');
  text = text.replace(/\[Hệ Thống\]/g, '<span class="tag-hethong">[Hệ Thống]</span>');
  text = text.replace(/\[Sync\]/g, '<span class="tag-hethong">[Sync]</span>');
  text = text.replace(/\[User Action\]/g, '<span class="tag-cungvu">[User Action]</span>');
  text = text.replace(/\[OK\]|\[✓\]/g, '<span class="tag-ok">[OK]</span>');
  text = text.replace(/\[X\]/g, '<span class="tag-err">[X]</span>');
  text = text.replace(/Thu hoạch thành công/g, '<span style="color: #10B981">Thu hoạch thành công</span>');
  text = text.replace(/Mất kết nối/g, '<span style="color: #EF4444">Mất kết nối</span>');
  text = text.replace(/\(\+([\d.,]+)\s([^)]+)\)/g, '(<span style="color: #FBBF24">+$1 $2</span>)');
  return text;
};

const appendLog = (log) => {
  const div = document.createElement('div');
  div.className = 'log-entry' + (log.type === 'error' ? ' log-error' : '');
  const safeText = (log.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  div.innerHTML = `<span class="log-time">[${log.time}]</span> ${colorizeText(safeText)}`;
  term.appendChild(div);
  
  if (autoScrollCb.checked) {
    term.scrollTop = term.scrollHeight;
  }
};

btnClear.addEventListener('click', () => {
  term.innerHTML = '';
  const curEmail = (currentSelectedEmail || '').toLowerCase();
  if (curEmail) {
    accountLogsCache.set(curEmail, []);
  }
});

// Render Danh Sách Tài Khoản và Nút Toggle Bật/Tắt
const renderAccounts = (accounts, selectedEmail) => {
  currentAccounts = (accounts || []).slice();
  currentAccounts.sort((a, b) => {
    if (a.noteIndex !== undefined && b.noteIndex !== undefined) {
      return a.noteIndex - b.noteIndex;
    }
    return 0;
  });
  if (selectedEmail) currentSelectedEmail = selectedEmail;

  // Cập nhật thống kê
  const total = currentAccounts.length;
  const countOn = currentAccounts.filter(a => a.enabled).length;
  const countOff = total - countOn;

  if (statTotal) statTotal.textContent = total;
  if (statOn) statOn.textContent = countOn;
  if (statOff) statOff.textContent = countOff;

  const statTotalBadge = document.getElementById('stat-total-badge');
  if (statTotalBadge) statTotalBadge.textContent = total;

  // Cập nhật dropdown chọn tài khoản xem chi tiết
  if (selectActiveAcc) {
    selectActiveAcc.innerHTML = '<option value="">-- Chọn tài khoản xem --</option>';
    currentAccounts.forEach(acc => {
      const opt = document.createElement('option');
      opt.value = acc.email;
      opt.textContent = `${acc.email} (${acc.playerName || 'Bot'})`;
      if (acc.email === currentSelectedEmail) {
        opt.selected = true;
      }
      selectActiveAcc.appendChild(opt);
    });
  }

  // Cập nhật huy hiệu trạng thái của tài khoản đang chọn
  const activeAccStatusBadge = document.getElementById('active-acc-status-badge');
  if (activeAccStatusBadge) {
    const curAcc = currentAccounts.find(a => a.email === currentSelectedEmail);
    if (curAcc) {
      if (curAcc.state === 'RUNNING') {
        activeAccStatusBadge.className = 'badge badge-running';
        activeAccStatusBadge.innerHTML = '<span class="dot dot-green"></span> Đang chạy 24/7';
      } else if (curAcc.state === 'STARTING') {
        activeAccStatusBadge.className = 'badge badge-starting';
        activeAccStatusBadge.innerHTML = '<span class="dot dot-yellow"></span> Đang kết nối...';
      } else if (curAcc.state === 'ERROR') {
        activeAccStatusBadge.className = 'badge badge-error';
        activeAccStatusBadge.innerHTML = '<span class="dot dot-red"></span> Lỗi login';
      } else {
        activeAccStatusBadge.className = 'badge badge-stopped';
        activeAccStatusBadge.innerHTML = '<span class="dot dot-gray"></span> Tạm dừng';
      }
    }
  }

  // Render Table Rows nếu trang có bảng accountsTbody
  if (!accountsTbody) return;

  if (currentAccounts.length === 0) {
    accountsTbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-4 text-muted">
          Chưa có tài khoản nào trong Web Note. Bấm <b>"Thêm Tài Khoản"</b> để bắt đầu.
        </td>
      </tr>`;
    return;
  }

  let html = '';
  currentAccounts.forEach(acc => {
    const isSelected = acc.email === currentSelectedEmail;
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

    // Nút Bật/Tắt
    const toggleChecked = acc.enabled ? 'checked' : '';
    const toggleLabel = acc.enabled ? '<span class="badge badge-on">ON</span>' : '<span class="badge badge-off">OFF</span>';

    html += `
      <tr style="${isSelected ? 'background: rgba(59, 130, 246, 0.08);' : ''}">
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
          ${isSelected ? '<span style="font-size: 0.75rem; color: var(--accent-blue);">● Đang xem thẻ</span>' : ''}
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
            <button class="btn btn-secondary btn-sm" onclick="window.handleSelectAcc('${acc.email}')" title="Xem thẻ nhân vật này">
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

// Xử lý Bật/Tắt tài khoản
window.handleToggle = async (email, isChecked) => {
  togglingEmails.add(email);
  renderAccounts(currentAccounts, currentSelectedEmail);

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

// Xử lý Chọn tài khoản để xem
window.handleSelectAcc = async (email) => {
  if (!email) return;
  currentSelectedEmail = email;
  renderAccounts(currentAccounts, email);

  // Hiển thị trạng thái đang chuyển đổi
  elLiveStatus.innerHTML = colorizeText(`Đang tải dữ liệu tài khoản [${email}]...`);

  // Render ngay log từ cache nếu có
  term.innerHTML = '';
  const emailKey = email.toLowerCase();
  const cached = accountLogsCache.get(emailKey);
  if (cached && cached.length > 0) {
    cached.forEach(appendLog);
  } else {
    const div = document.createElement('div');
    div.className = 'log-line text-muted py-2';
    div.textContent = `[${new Date().toLocaleTimeString('vi-VN')}] Đang tải lịch sử logs của tài khoản ${email}...`;
    term.appendChild(div);
  }

  try {
    const res = await fetch('/api/accounts/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    });
    const json = await res.json();
    if (json.success) {
      if (json.playerState) {
        updatePlayerState(json.playerState);
      }
      if (json.statusMsg) {
        elLiveStatus.innerHTML = colorizeText(json.statusMsg.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
      }
      if (Array.isArray(json.logs)) {
        term.innerHTML = '';
        accountLogsCache.set(emailKey, json.logs.slice());
        json.logs.forEach(appendLog);
      }
    }
  } catch (err) {
    console.error('Lỗi khi chọn tài khoản:', err);
  }
};

selectActiveAcc.addEventListener('change', (e) => {
  if (e.target.value) {
    window.handleSelectAcc(e.target.value);
  }
});

// Xử lý Xóa tài khoản
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

// Đồng bộ ngay lập tức
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
  } catch (e) {
    alert('Lỗi đồng bộ: ' + e.message);
  } finally {
    btnSyncNow.disabled = false;
    btnSyncNow.innerHTML = '<span class="icon">🔄</span> Đồng Bộ Note Ngay';
  }
});

// Modal Thêm Tài Khoản (nếu có trên trang)
if (btnOpenAddModal && modalAddAcc) {
  btnOpenAddModal.addEventListener('click', () => {
    modalAddAcc.style.display = 'flex';
    document.getElementById('input-add-email').focus();
  });

  const closeModal = () => {
    modalAddAcc.style.display = 'none';
    if (formAddAcc) formAddAcc.reset();
  };
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (btnCancelAdd) btnCancelAdd.addEventListener('click', closeModal);

  modalAddAcc.addEventListener('click', (e) => {
    if (e.target === modalAddAcc) closeModal();
  });
}

if (formAddAcc) {
  formAddAcc.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('input-add-email').value.trim();
    const password = document.getElementById('input-add-pass').value.trim();
    const status = document.getElementById('input-add-status').value;
    const server = document.getElementById('input-add-server').value.trim();

    if (!email || !password) return;

    try {
      const res = await fetch('/api/accounts/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          password: password,
          status: status,
          serverId: server ? parseInt(server) : null
        })
      });
      const json = await res.json();
      if (json.success) {
        if (typeof closeModal === 'function') closeModal();
      } else {
        alert('Lỗi thêm tài khoản: ' + (json.error || 'Lỗi không xác định'));
      }
    } catch (err) {
      alert('Lỗi gửi yêu cầu: ' + err.message);
    }
  });
}

// Cập nhật giá trị tài nguyên với hiệu ứng nháy
const updateResourceValue = (elId, value) => {
  const el = document.getElementById(elId);
  if (!el) return;
  const formatted = formatNumber(value);
  if (el.textContent !== formatted && el.textContent !== '--') {
    el.classList.remove('resource-updated');
    void el.offsetWidth;
    el.classList.add('resource-updated');
  }
  el.textContent = formatted;
};

const updateCungVanValue = (exp, nexp) => {
  const el = document.getElementById('r-cungvan');
  if (!el) return;
  const formatted = `${formatNumber(exp)} / ${formatNumber(nexp)}`;
  if (el.textContent !== formatted && el.textContent !== '-- / --') {
    el.classList.remove('resource-updated');
    void el.offsetWidth;
    el.classList.add('resource-updated');
  }
  el.textContent = formatted;
};

// Cập nhật Thẻ Nhân Vật & Tài Nguyên
const updatePlayerState = (data) => {
  if (!data) return;

  if (data.isReady && data.playerData) {
    document.getElementById('player-loading').style.display = 'none';
    document.getElementById('player-info').style.display = 'block';
    
    document.getElementById('p-name').textContent = data.playerData.name;
    document.getElementById('p-server').textContent = `Server: ${data.serverName} (${data.serverId})`;
    document.getElementById('p-level').textContent = data.rankName ? `${data.rankName} (Lv.${data.playerData.lv})` : `Lv.${data.playerData.lv}`;
    
    updateResourceValue('r-gold', data.resources?.gold);
    updateResourceValue('r-silver', data.resources?.silver);
    updateResourceValue('r-food', data.resources?.food);
    updateResourceValue('r-soldier', data.resources?.soldier);
    
    const exp = data.resources?.exp || 0;
    const nexp = data.resources?.nexp || 0;
    const pct = nexp > 0 ? Math.min(100, Math.round((exp / nexp) * 100)) : 100;
    
    updateCungVanValue(exp, nexp);
    document.getElementById('p-exp-bar').style.width = `${pct}%`;
    document.getElementById('p-exp-text').textContent = `${formatNumber(exp)} / ${formatNumber(nexp)} EXP (${pct}%)`;
  } else {
    document.getElementById('player-loading').style.display = 'block';
    document.getElementById('player-loading').textContent = data.email ? `Tài khoản ${data.email} chưa vào game hoặc đang tắt.` : 'Chọn một tài khoản để xem chi tiết...';
    document.getElementById('player-info').style.display = 'none';

    updateResourceValue('r-gold', '--');
    updateResourceValue('r-silver', '--');
    updateResourceValue('r-food', '--');
    updateResourceValue('r-soldier', '--');
    document.getElementById('r-cungvan').textContent = '-- / --';
  }
};

// Kết nối Realtime SSE Stream
const connectSSE = () => {
  const evtSource = new EventSource('/events');
  
  evtSource.addEventListener('init', (e) => {
    const data = JSON.parse(e.data);

    if (data.buildId) {
      if (currentBuildId === null) {
        currentBuildId = data.buildId;
      } else if (currentBuildId !== data.buildId) {
        console.log('[Auto-Reload] Bản cập nhật mới phát hiện. Đang tải lại trang...');
        window.location.reload();
        return;
      }
    }

    term.innerHTML = '';
    const curEmail = (effectiveEmail || '').toLowerCase();
    if (data.logs) {
      if (curEmail) {
        accountLogsCache.set(curEmail, data.logs.slice());
      }
      data.logs.forEach(appendLog);
    }
    if (data.statusMsg) {
      elLiveStatus.innerHTML = colorizeText(data.statusMsg.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
    }
    const urlParams = new URLSearchParams(window.location.search);
    const targetEmail = urlParams.get('email');
    const effectiveEmail = targetEmail || data.selectedEmail;

    if (data.accounts) {
      renderAccounts(data.accounts, effectiveEmail);
      if (targetEmail && targetEmail !== data.selectedEmail) {
        window.handleSelectAcc(targetEmail);
      }
    }
    if (data.playerState) {
      updatePlayerState(data.playerState);
    }
    if (data.syncStatus) {
      statSync.textContent = data.syncStatus.length > 25 ? '10s/lần' : data.syncStatus;
    }
    if (data.noteUrl) {
      const headerNoteLink = document.getElementById('header-note-link');
      const cardNoteLink = document.getElementById('card-note-link');
      if (headerNoteLink) headerNoteLink.href = data.noteUrl;
      if (cardNoteLink) {
        cardNoteLink.href = data.noteUrl;
        const noteName = data.noteTitle || data.noteUrl.split('/').pop() || 'Web Note';
        cardNoteLink.textContent = noteName;
      }
    }
  });

  evtSource.addEventListener('log', (e) => {
    const log = JSON.parse(e.data);
    const curEmail = (currentSelectedEmail || '').toLowerCase();
    const logEmail = (log.email || '').toLowerCase();

    // Lưu log vào cache của tài khoản tương ứng
    if (logEmail) {
      if (!accountLogsCache.has(logEmail)) {
        accountLogsCache.set(logEmail, []);
      }
      const buf = accountLogsCache.get(logEmail);
      buf.push(log);
      if (buf.length > 300) buf.shift();
    }

    // Chỉ hiển thị lên terminal nếu log thuộc về tài khoản đang chọn HOẶC là log hệ thống chung
    if (!logEmail || logEmail === curEmail) {
      appendLog(log);
    }
  });

  evtSource.addEventListener('status_msg', (e) => {
    const data = JSON.parse(e.data);
    const curEmail = (currentSelectedEmail || '').toLowerCase();
    const msgEmail = (data.email || '').toLowerCase();

    // Chỉ cập nhật dòng đếm ngược nếu thông điệp này thuộc về tài khoản đang xem
    if (!msgEmail || msgEmail === curEmail) {
      elLiveStatus.innerHTML = colorizeText((data.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
    }
  });

  evtSource.addEventListener('accounts_update', (e) => {
    const data = JSON.parse(e.data);
    if (data.accounts) {
      renderAccounts(data.accounts, data.selectedEmail);
    }
    if (data.playerState) {
      updatePlayerState(data.playerState);
    }
    if (data.syncStatus) {
      statSync.textContent = data.syncStatus.length > 25 ? '10s/lần' : data.syncStatus;
    }
  });

  evtSource.addEventListener('player_state', (e) => {
    updatePlayerState(JSON.parse(e.data));
  });

  evtSource.onerror = (err) => {
    console.warn('SSE Disconnected, reconnecting in 3s...', err);
    evtSource.close();
    setTimeout(connectSSE, 3000);
  };
};

connectSSE();
