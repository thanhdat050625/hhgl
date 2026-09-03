const term = document.getElementById('terminal-content');
const autoScrollCb = document.getElementById('auto-scroll');
const btnClear = document.getElementById('btn-clear');
const elLiveStatus = document.getElementById('live-status');

const formatNumber = (num) => {
  return num != null ? new Intl.NumberFormat('vi-VN').format(num) : '--';
};

const colorizeText = (text) => {
  text = text.replace(/\[Nội Vụ\]/g, '<span class="tag-noivu">[Nội Vụ]</span>');
  text = text.replace(/\[Cung Vụ\]/g, '<span class="tag-cungvu">[Cung Vụ]</span>');
  text = text.replace(/\[Phúc Lợi\]/g, '<span class="tag-phucloi">[Phúc Lợi]</span>');
  text = text.replace(/\[Hệ Thống\]/g, '<span class="tag-hethong">[Hệ Thống]</span>');
  text = text.replace(/\[OK\]/g, '<span class="tag-ok">[OK]</span>');
  text = text.replace(/\[X\]/g, '<span class="tag-err">[X]</span>');
  text = text.replace(/Thu hoạch thành công/g, '<span style="color: #10B981">Thu hoạch thành công</span>');
  text = text.replace(/Mất kết nối/g, '<span style="color: #EF4444">Mất kết nối</span>');
  text = text.replace(/\(\+([\d.,]+)\s([^)]+)\)/g, '(<span style="color: #FBBF24">+$1 $2</span>)');
  return text;
};

const appendLog = (log) => {
  const div = document.createElement('div');
  div.className = 'log-entry';
  const safeText = log.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  div.innerHTML = `<span class="log-time">[${log.time}]</span> ${colorizeText(safeText)}`;
  term.appendChild(div);
  
  if (autoScrollCb.checked) {
    term.scrollTop = term.scrollHeight;
  }
};

btnClear.addEventListener('click', () => {
  term.innerHTML = '';
});

// Tự động căn chỉnh chiều cao Terminal bằng chính xác đáy Tài Nguyên Quốc Gia
const syncTerminalHeight = () => {
  const sidebar = document.querySelector('.sidebar');
  const banner = document.querySelector('.status-banner');
  const terminal = document.querySelector('.terminal');
  if (sidebar && banner && terminal) {
    if (window.innerWidth > 900) {
      const sidebarHeight = sidebar.offsetHeight;
      const bannerHeight = banner.offsetHeight;
      const bannerMargin = parseFloat(window.getComputedStyle(banner).marginBottom) || 16;
      const targetH = sidebarHeight - bannerHeight - bannerMargin;
      if (targetH > 150) {
        terminal.style.height = targetH + 'px';
      }
    } else {
      terminal.style.height = '450px';
    }
  }
};

if (window.ResizeObserver) {
  const ro = new ResizeObserver(() => {
    requestAnimationFrame(syncTerminalHeight);
  });
  const sidebarEl = document.querySelector('.sidebar');
  const bannerEl = document.querySelector('.status-banner');
  if (sidebarEl) ro.observe(sidebarEl);
  if (bannerEl) ro.observe(bannerEl);
}

window.addEventListener('resize', syncTerminalHeight);
window.addEventListener('load', syncTerminalHeight);

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

const updatePlayerState = (data) => {
  if (data.isReady && data.playerData) {
    document.getElementById('player-loading').style.display = 'none';
    document.getElementById('player-info').style.display = 'block';
    
    document.getElementById('p-name').textContent = data.playerData.name;
    document.getElementById('p-server').textContent = `Server: ${data.serverName} (${data.serverId})`;
    document.getElementById('p-level').textContent = data.rankName ? `${data.rankName} (Lv.${data.playerData.lv})` : `Lv.${data.playerData.lv}`;
    
    // Update resources with realtime animation
    updateResourceValue('r-gold', data.resources.gold);
    updateResourceValue('r-silver', data.resources.silver);
    updateResourceValue('r-food', data.resources.food);
    updateResourceValue('r-soldier', data.resources.soldier);
    
    // Update EXP Bar & Cung Van
    const exp = data.resources.exp;
    const nexp = data.resources.nexp;
    const pct = nexp > 0 ? Math.min(100, Math.round((exp / nexp) * 100)) : 100;
    
    updateCungVanValue(exp, nexp);
    document.getElementById('p-exp-bar').style.width = `${pct}%`;
    document.getElementById('p-exp-text').textContent = `${formatNumber(exp)} / ${formatNumber(nexp)} EXP (${pct}%)`;
    
    requestAnimationFrame(syncTerminalHeight);
  } else {
    document.getElementById('player-loading').style.display = 'block';
    document.getElementById('player-info').style.display = 'none';
    requestAnimationFrame(syncTerminalHeight);
  }
};

let currentBuildId = null;

const connectSSE = () => {
  const evtSource = new EventSource('/events');
  
  evtSource.addEventListener('init', (e) => {
    const data = JSON.parse(e.data);

    // Tự động reload trang nếu Render build bản mới
    if (data.buildId) {
      if (currentBuildId === null) {
        currentBuildId = data.buildId;
      } else if (currentBuildId !== data.buildId) {
        console.log('[Auto-Reload] Phát hiện phiên bản mới trên Render! Đang tải lại trang...');
        window.location.reload();
        return;
      }
    }

    term.innerHTML = '';
    if (data.logs) {
      data.logs.forEach(appendLog);
    }
    if (data.statusMsg) {
      elLiveStatus.innerHTML = colorizeText(data.statusMsg.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
    }
    if (data.playerState) {
      updatePlayerState(data.playerState);
    }
  });

  evtSource.addEventListener('log', (e) => {
    appendLog(JSON.parse(e.data));
  });

  evtSource.addEventListener('status_msg', (e) => {
    const data = JSON.parse(e.data);
    elLiveStatus.innerHTML = colorizeText(data.text.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  });

  evtSource.addEventListener('player_state', (e) => {
    updatePlayerState(JSON.parse(e.data));
  });

  evtSource.onerror = (err) => {
    console.error('SSE Error', err);
    evtSource.close();
    setTimeout(connectSSE, 3000);
  };
};

connectSSE();
