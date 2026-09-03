/**
 * 🏛️ ServiceRegistry: Bộ quản lý, nạp động và định tuyến gói tin cho tất cả Services
 */

const domains = require('../domains');

class ServiceRegistry {
  constructor(client) {
    this.client = client;
    this.services = new Map();
    this.menuMap = new Map();
    this.msgIdRouteMap = new Map();

    this.autoRegisterAll();
  }

  register(ServiceClass) {
    if (typeof ServiceClass !== 'function' || ServiceClass.name === 'BaseService') {
      return;
    }

    const instance = new ServiceClass(this.client);
    this.services.set(instance.id, instance);

    // Đăng ký menu option nếu có
    if (instance.menuOption) {
      this.menuMap.set(instance.menuOption, instance);
    }

    // Đăng ký định tuyến msgId
    if (Array.isArray(instance.listenedMsgIds)) {
      for (const msgId of instance.listenedMsgIds) {
        if (!this.msgIdRouteMap.has(msgId)) {
          this.msgIdRouteMap.set(msgId, new Set());
        }
        this.msgIdRouteMap.get(msgId).add(instance);
      }
    }

    return instance;
  }

  autoRegisterAll() {
    for (const exportKey of Object.keys(domains)) {
      if (exportKey !== 'BaseService' && exportKey.endsWith('Service')) {
        this.register(domains[exportKey]);
      }
    }
  }

  get(id) {
    return this.services.get(id);
  }

  getByMenuOption(optionNumber) {
    return this.menuMap.get(Number(optionNumber));
  }

  getAll() {
    return Array.from(this.services.values());
  }

  getByDomain(domain) {
    return this.getAll().filter(s => s.domain === domain);
  }

  /**
   * Định tuyến gói tin server tự động tới các services liên quan
   */
  dispatchPacket(pkt) {
    if (!pkt || !pkt.msgId) return;
    const targets = this.msgIdRouteMap.get(pkt.msgId);
    if (targets && targets.size > 0) {
      for (const svc of targets) {
        try {
          svc.onPacket(pkt.msgId, pkt.data);
        } catch (e) {
          console.error(`[ServiceRegistry] Lỗi dispatch gói tin ${pkt.msgId} tới service ${svc.id}:`, e.message);
        }
      }
    }
  }
}

module.exports = ServiceRegistry;
