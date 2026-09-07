require('dotenv').config();

/**
 * Core Service: NoteManager
 * Quản lý đọc/ghi và đồng bộ danh sách tài khoản qua Web Note (Render)
 */

class NoteManager {
  constructor(options = {}) {
    this.noteUrl = options.noteUrl || process.env.NOTE_URL || 'https://van900379.onrender.com/notes/hhgl-dat';
    this.loginUrl = options.loginUrl || process.env.NOTE_LOGIN_URL || 'https://van900379.onrender.com/auth/login';
    this.saveUrl = options.saveUrl || process.env.NOTE_SAVE_URL || 'https://van900379.onrender.com/notes/admin/manager/action/save';
    this.notePassword = options.notePassword || process.env.NOTE_PASSWORD || '';
    const fallbackId = this.noteUrl ? (this.noteUrl.split('/').pop() || 'hhgl-dat') : 'hhgl-dat';
    this.noteId = options.noteId || process.env.NOTE_ID || fallbackId;
    this.noteTitle = options.noteTitle || process.env.NOTE_TITLE || fallbackId;

    this.sessionCookie = null;
    this.sessionCookieExpiresAt = 0; // Timestamp hết hạn (ms)
    this.loginPromise = null; // Mutex lock chống spam login đồng thời
    this.lastFetchedAccounts = [];
    this.lastFetchTime = 0;
  }

  /**
   * Giải mã các ký tự HTML Entities phổ biến
   */
  decodeHtmlEntities(str) {
    if (!str) return '';
    return str
      .replace(/&#34;|&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .trim();
  }

  /**
   * Đảm bảo session cookie hợp lệ trước khi thực hiện thao tác ghi
   * Tự động tái đăng nhập nếu session đã hết hạn hoặc sắp hết hạn (trong vòng 2 phút)
   */
  async ensureValidSession(force = false) {
    const isExpired = !this.sessionCookie || Date.now() >= (this.sessionCookieExpiresAt - 120000);
    if (force || isExpired) {
      await this.login(force);
    }
    return this.sessionCookie;
  }

  /**
   * Đăng nhập trang quản trị Web Note để lấy session cookie
   * Có Mutex Lock và tự động trích xuất thời hạn Max-Age từ Header Set-Cookie
   */
  async login(force = false) {
    if (!force && this.sessionCookie && Date.now() < (this.sessionCookieExpiresAt - 120000)) {
      return this.sessionCookie;
    }

    // Nếu đang có một tiến trình đăng nhập khác đang chạy, cùng chờ kết quả đó
    if (this.loginPromise) {
      return await this.loginPromise;
    }

    this.loginPromise = (async () => {
      try {
        if (!this.notePassword) {
          throw new Error('Chưa cấu hình mật khẩu Web Note (NOTE_PASSWORD) trong tệp .env!');
        }
        console.log('[NoteManager] Đang xác thực phiên quản trị Web Note...');
        const res = await fetch(this.loginUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/149.0.0.0 Safari/537.36'
          },
          body: new URLSearchParams({ password: this.notePassword }).toString(),
          redirect: 'manual'
        });

        const setCookie = res.headers.get('set-cookie');
        if (setCookie) {
          const cookieMatch = setCookie.match(/note_session=[^;]+/);
          if (cookieMatch) {
            this.sessionCookie = cookieMatch[0];

            // Trích xuất Max-Age từ Set-Cookie (mặc định 3600s = 1h nếu không tìm thấy)
            let maxAgeSeconds = 3600;
            const maxAgeMatch = setCookie.match(/Max-Age=(\d+)/i);
            if (maxAgeMatch) {
              maxAgeSeconds = parseInt(maxAgeMatch[1], 10) || 3600;
            }

            this.sessionCookieExpiresAt = Date.now() + (maxAgeSeconds * 1000);
            const expireDate = new Date(this.sessionCookieExpiresAt).toLocaleTimeString('vi-VN');
            console.log(`[NoteManager] Đăng nhập Web Note thành công. Phiên có hiệu lực đến: ${expireDate} (Max-Age: ${maxAgeSeconds}s)`);
            return this.sessionCookie;
          }
        }

        const rawCookie = res.headers.get('set-cookie');
        if (rawCookie) {
          this.sessionCookie = rawCookie.split(';')[0];
          this.sessionCookieExpiresAt = Date.now() + (3600 * 1000);
          return this.sessionCookie;
        }

        throw new Error('Không tìm thấy cookie phiên sau khi đăng nhập Web Note.');
      } catch (err) {
        console.error('[NoteManager] Lỗi đăng nhập Web Note:', err.message);
        throw err;
      } finally {
        this.loginPromise = null;
      }
    })();

    return await this.loginPromise;
  }

  /**
   * Tải nội dung thô từ URL Note công khai
   */
  async fetchRawContent() {
    const res = await fetch(this.noteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/149.0.0.0 Safari/537.36',
        'Cache-Control': 'no-cache, no-store'
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} khi đọc ${this.noteUrl}`);
    }

    const html = await res.text();
    const match = html.match(/<div class="content-text">([\s\S]*?)<\/div>/i);
    if (!match) {
      // Nếu không khớp regex div, thử tìm textarea (trường hợp trang edit) hoặc lấy toàn bộ text nếu trang trả raw
      if (html.startsWith('[') || html.startsWith('{')) {
        return this.decodeHtmlEntities(html);
      }
      throw new Error('Không tìm thấy nội dung note trong thẻ content-text.');
    }

    return this.decodeHtmlEntities(match[1]);
  }

  /**
   * Bóc tách nội dung text note thành danh sách tài khoản
   * Hỗ trợ đa dạng format: Array of Arrays, Array of Objects, Object with accounts, Regex fallback
   */
  parseAccounts(rawText) {
    if (!rawText || !rawText.trim() || rawText.trim() === '{}' || rawText.trim() === '[]') {
      return [];
    }

    const cleanText = rawText.trim();
    let parsedData = null;

    try {
      parsedData = JSON.parse(cleanText);
    } catch (_) {
      // Nếu JSON.parse lỗi (do người dùng gõ sai cú pháp ngoặc), chuyển sang regex fallback
    }

    const accounts = [];

    // Helper chuẩn hóa trạng thái
    const isStatusOn = (status) => {
      const s = String(status || '').trim().toLowerCase();
      return ['on', '1', 'true', 'run', 'start', 'active', 'bat'].includes(s);
    };

    if (Array.isArray(parsedData)) {
      for (const item of parsedData) {
        if (Array.isArray(item)) {
          // Format: ["email", "pass", "on/off", serverId?]
          const [email, password, status, serverId] = item;
          if (email && password !== undefined) {
            const on = isStatusOn(status);
            accounts.push({
              email: String(email).trim(),
              password: String(password).trim(),
              status: on ? 'on' : 'off',
              enabled: on,
              serverId: serverId ? parseInt(serverId) : null
            });
          }
        } else if (item && typeof item === 'object') {
          // Format: { email, pass/password, status/action, serverId? }
          const email = item.email || item.user || item.username;
          const password = item.pass || item.password || item.passwd;
          const status = item.status || item.state || item.action || (item.enabled ? 'on' : 'off');
          const serverId = item.serverId || item.server;
          if (email && password !== undefined) {
            const on = isStatusOn(status);
            accounts.push({
              email: String(email).trim(),
              password: String(password).trim(),
              status: on ? 'on' : 'off',
              enabled: on,
              serverId: serverId ? parseInt(serverId) : null
            });
          }
        }
      }
    } else if (parsedData && typeof parsedData === 'object') {
      // Format: { accounts: [...] } hoặc { data: [...] }
      const list = parsedData.accounts || parsedData.data || parsedData.list || parsedData.accs;
      if (Array.isArray(list)) {
        return this.parseAccounts(JSON.stringify(list));
      }
    }

    // Nếu đã bóc tách được bằng JSON.parse
    if (accounts.length > 0) {
      return accounts;
    }

    // REGEX FALLBACK: Quét các cặp ngoặc [email, pass, on/off, optional_server]
    // Hỗ trợ cả trường hợp người dùng gõ {[email, pass, on], [email2, pass2, off]}
    const itemRegex = /\[\s*["']?([^,"'\]\s]+)["']?\s*,\s*["']?([^,"'\]\s]+)["']?\s*,\s*["']?([^,"'\]\s]+)["']?(?:\s*,\s*["']?([^,"'\]\s]*)["']?)?\s*\]/g;
    let m;
    while ((m = itemRegex.exec(cleanText)) !== null) {
      const email = m[1].trim();
      const password = m[2].trim();
      const status = m[3].trim();
      const serverId = m[4] ? parseInt(m[4].trim()) : null;

      if (email && password) {
        const on = isStatusOn(status);
        accounts.push({
          email: email,
          password: password,
          status: on ? 'on' : 'off',
          enabled: on,
          serverId: isNaN(serverId) ? null : serverId
        });
      }
    }

    return accounts;
  }

  /**
   * Lấy danh sách tài khoản hiện tại từ Web Note
   */
  async getAccounts() {
    const raw = await this.fetchRawContent();
    const accounts = this.parseAccounts(raw);
    this.lastFetchedAccounts = accounts;
    this.lastFetchTime = Date.now();
    return accounts;
  }

  /**
   * Lưu nội dung raw string vào Web Note trên Render
   * Tự động kiểm tra hạn session, tự động login lại nếu hết hạn và thử lại an toàn
   */
  async saveRawContent(contentStr) {
    await this.ensureValidSession();

    const postData = async (cookie) => {
      const body = new URLSearchParams({
        note_id: this.noteId,
        title: this.noteTitle,
        content: contentStr
      });

      return await fetch(this.saveUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/149.0.0.0 Safari/537.36'
        },
        body: body.toString(),
        redirect: 'manual'
      });
    };

    let res = await postData(this.sessionCookie);

    // Kiểm tra nếu session hết hạn: Server Render redirect về /auth/login hoặc trả về 401/403
    const loc = res.headers.get('location') || '';
    const isSessionExpired = res.status === 401 || res.status === 403 || (res.status === 302 && loc.includes('/auth/login'));

    if (isSessionExpired) {
      console.warn('[NoteManager] Phát hiện session Web Note đã hết hạn khi lưu. Đang tự động đăng nhập lại phiên mới...');
      await this.ensureValidSession(true); // Ép buộc đăng nhập lại
      res = await postData(this.sessionCookie);
    }

    // Khi lưu thành công, server trả về 200 hoặc 302 redirect tới trang note (không phải /auth/login)
    const newLoc = res.headers.get('location') || '';
    const isSuccess = (res.status === 200 || res.status === 302) && !newLoc.includes('/auth/login');

    if (!isSuccess) {
      throw new Error(`Lưu Web Note thất bại. HTTP Status: ${res.status} Location: ${newLoc}`);
    }

    return true;
  }

  /**
   * Lưu danh sách accounts chuẩn hóa dạng JSON mảng vào Note
   */
  async saveAccounts(accountsList) {
    const data = accountsList.map(a => {
      const row = [a.email, a.password, a.enabled ? 'on' : 'off'];
      if (a.serverId) row.push(a.serverId);
      return row;
    });

    // Mỗi tài khoản 1 dòng gọn gàng, dễ nhìn
    const rows = data.map(row => '  [' + row.map(v => JSON.stringify(v)).join(', ') + ']');
    const jsonStr = '[\n' + rows.join(',\n') + '\n]';
    await this.saveRawContent(jsonStr);
    this.lastFetchedAccounts = accountsList;
    return true;
  }

  /**
   * Bật/Tắt (Toggle) trạng thái của 1 tài khoản và cập nhật ngay lên Note
   */
  async toggleAccount(email, explicitStatus = null) {
    const accounts = await this.getAccounts();
    const target = accounts.find(a => a.email.toLowerCase() === email.toLowerCase());

    if (!target) {
      throw new Error(`Không tìm thấy tài khoản ${email} trong Web Note.`);
    }

    if (explicitStatus !== null && explicitStatus !== undefined) {
      const isStatusOn = ['on', '1', 'true', 'run', 'start', 'active', 'bat'].includes(String(explicitStatus).toLowerCase());
      target.enabled = isStatusOn;
      target.status = isStatusOn ? 'on' : 'off';
    } else {
      target.enabled = !target.enabled;
      target.status = target.enabled ? 'on' : 'off';
    }

    await this.saveAccounts(accounts);
    return { account: target, allAccounts: accounts };
  }

  /**
   * Thêm tài khoản mới vào Note
   */
  async addAccount(email, password, status = 'on', serverId = null) {
    const accounts = await this.getAccounts();
    const existing = accounts.find(a => a.email.toLowerCase() === email.toLowerCase());
    const on = ['on', '1', 'true', 'run', 'start', 'active', 'bat'].includes(String(status).toLowerCase());

    if (existing) {
      existing.password = password;
      existing.enabled = on;
      existing.status = on ? 'on' : 'off';
      if (serverId) existing.serverId = parseInt(serverId);
    } else {
      accounts.push({
        email: email.trim(),
        password: password.trim(),
        status: on ? 'on' : 'off',
        enabled: on,
        serverId: serverId ? parseInt(serverId) : null
      });
    }

    await this.saveAccounts(accounts);
    return accounts;
  }

  /**
   * Xóa tài khoản khỏi Note
   */
  async deleteAccount(email) {
    let accounts = await this.getAccounts();
    accounts = accounts.filter(a => a.email.toLowerCase() !== email.toLowerCase());
    await this.saveAccounts(accounts);
    return accounts;
  }
}

module.exports = NoteManager;
