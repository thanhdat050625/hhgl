/**
 * 🏛️ Base Service Class cho tất cả các Domain Services
 * Tuân thủ 100% Server-Authoritative State Sync
 */

class BaseService {
  constructor(client, metadata = {}) {
    this.client = client;
    this.id = metadata.id || this.constructor.name.replace('Service', '').toLowerCase();
    this.domain = metadata.domain || 'general';
    this.name = metadata.name || this.id;
    this.menuOption = metadata.menuOption || null;
    this.listenedMsgIds = metadata.listenedMsgIds || [];
  }

  send(msgId, payload = {}) {
    return this.client.send(msgId, payload);
  }

  sleep(ms) {
    return this.client.sleep(ms);
  }

  sleepRandom(minSec = 1, maxSec = 3) {
    return this.client.sleepRandom(minSec, maxSec);
  }

  async waitFor(conditionFn, maxMs = 1500, intervalMs = 50) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      if (conditionFn()) return true;
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return Boolean(conditionFn());
  }

  get playerData() {
    return this.client.playerData;
  }

  get workList() {
    return this.client.workList;
  }

  get logger() {
    return this.client.logger || console;
  }

  /**
   * Hook xử lý gói tin được dispatch tự động từ GameClient
   */
  onPacket(msgId, data) {
    // Override trong service con nếu cần xử lý trực tiếp
  }

  /**
   * Phương thức thực thi hành động chính của Service
   */
  async execute() {
    throw new Error(`Service ${this.id} chưa triển khai phương thức execute()`);
  }
}

module.exports = BaseService;
