/**
 * Tool Tải Toàn Bộ Mã Nguồn & Cấu Hình Game về thư mục _source_game
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { CONFIG } = require('../config');

const TARGET_DIR = path.resolve(__dirname, '../../_source_game');

function extractZip(zipBuffer, outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let offset = 0;
  while (offset < zipBuffer.length - 4) {
    if (zipBuffer.readUInt32LE(offset) === 0x04034b50) {
      const compMethod = zipBuffer.readUInt16LE(offset + 8);
      const compSize = zipBuffer.readUInt32LE(offset + 18);
      const uncompSize = zipBuffer.readUInt32LE(offset + 22);
      const nameLen = zipBuffer.readUInt16LE(offset + 26);
      const extraLen = zipBuffer.readUInt16LE(offset + 28);
      
      const fileName = zipBuffer.subarray(offset + 30, offset + 30 + nameLen).toString('utf8');
      const dataOffset = offset + 30 + nameLen + extraLen;
      const compData = zipBuffer.subarray(dataOffset, dataOffset + compSize);

      if (fileName && !fileName.endsWith('/')) {
        let uncompressed;
        if (compMethod === 0) {
          uncompressed = compData;
        } else if (compMethod === 8) {
          uncompressed = zlib.inflateRawSync(compData);
        }

        if (uncompressed) {
          const filePath = path.join(outputDir, fileName);
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(filePath, uncompressed);
          console.log(`    📄 Đã giải nén: ${fileName} (${(uncompressed.length / 1024).toFixed(1)} KB)`);
        }
      }
      offset = dataOffset + compSize;
      continue;
    }
    offset++;
  }
}

function decryptCfg(buffer) {
  // Giải nén ZIP chứa file .cfg
  let offset = 0;
  while (offset < buffer.length - 4) {
    if (buffer.readUInt32LE(offset) === 0x04034b50) {
      const compMethod = buffer.readUInt16LE(offset + 8);
      const compSize = buffer.readUInt32LE(offset + 18);
      const nameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);
      
      const dataOffset = offset + 30 + nameLen + extraLen;
      const compData = buffer.subarray(dataOffset, dataOffset + compSize);

      let uncompressed = compMethod === 0 ? compData : zlib.inflateRawSync(compData);
      
      // XOR giải mã với (4617 & 0xFF) = 9
      const xorKey = 4617 & 0xFF;
      for (let i = 0; i < uncompressed.length; i++) {
        uncompressed[i] ^= xorKey;
      }
      return JSON.parse(uncompressed.toString('utf8'));
    }
    offset++;
  }
  throw new Error('Không đọc được file zip cấu hình');
}

async function downloadFullGame(version = CONFIG.CLIENT_VERSION) {
  console.log(`\n======================================================`);
  console.log(`🎮 BẮT ĐẦU TẢI TOÀN BỘ MÃ NGUỒN GAME VỀ _source_game`);
  console.log(`======================================================`);
  console.log(`📂 Thư mục đích: ${TARGET_DIR}`);
  console.log(`📦 Phiên bản   : ${version}`);

  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  }

  // 1. Tải index.html
  try {
    console.log(`\n[1/4] 🌐 Đang tải H5 Portal index.html...`);
    const h5Res = await fetch('https://yxgl-cdn.52look.com/yxgl/h5/index.html');
    const h5Html = await h5Res.text();
    fs.writeFileSync(path.join(TARGET_DIR, 'index.html'), h5Html, 'utf8');
    console.log(`  ✅ Đã lưu: _source_game/index.html`);
  } catch (e) {
    console.log(`  ⚠️ Lỗi tải index.html:`, e.message);
  }

  // 2. Tải js.zip (Tất cả mã nguồn JavaScript & Engine)
  try {
    console.log(`\n[2/4] 🗜️ Đang tải js.zip (Mã nguồn JS & Egret Engine)...`);
    const jsZipUrl = `https://yxgl-cdn.52look.com/yxgl/h5/${version}/resource/zip/js.zip`;
    const res = await fetch(jsZipUrl);
    const buf = Buffer.from(await res.arrayBuffer());
    console.log(`  📥 Đã tải: ${(buf.length / 1024 / 1024).toFixed(2)} MB. Bắt đầu giải nén...`);
    extractZip(buf, TARGET_DIR);
    console.log(`  ✅ Đã giải nén toàn bộ code JS vào _source_game/js/`);
  } catch (e) {
    console.log(`  ⚠️ Lỗi tải js.zip:`, e.message);
  }

  // 3. Tải init.cfg (Protobuf & Cấu hình khởi tạo)
  try {
    console.log(`\n[3/4] 📦 Đang tải và giải mã init.cfg (Protobuf & Schemas)...`);
    const initUrl = `https://yxgl-cdn.52look.com/yxgl/h5/${version}/resource/zip/init.cfg`;
    const res = await fetch(initUrl);
    const buf = Buffer.from(await res.arrayBuffer());
    const initData = decryptCfg(buf);
    
    const initDir = path.join(TARGET_DIR, 'config_init');
    if (!fs.existsSync(initDir)) fs.mkdirSync(initDir, { recursive: true });

    for (const key of Object.keys(initData)) {
      const filePath = path.join(initDir, `${key}.json`);
      fs.writeFileSync(filePath, JSON.stringify(initData[key], null, 2), 'utf8');
    }
    console.log(`  ✅ Đã bóc tách ${Object.keys(initData).length} bảng cấu hình vào _source_game/config_init/`);
  } catch (e) {
    console.log(`  ⚠️ Lỗi tải init.cfg:`, e.message);
  }

  // 4. Tải config.cfg (Toàn bộ dữ liệu bảng Game: Ải, Tùy Tùng, Hậu Cung, Nhiệm Vụ...)
  try {
    console.log(`\n[4/4] 📊 Đang tải và giải mã config.cfg (Toàn bộ database game)...`);
    const configUrl = `https://yxgl-cdn.52look.com/yxgl/h5/${version}/resource/zip/config.cfg`;
    const res = await fetch(configUrl);
    const buf = Buffer.from(await res.arrayBuffer());
    const configData = decryptCfg(buf);
    
    const tableDir = path.join(TARGET_DIR, 'config_tables');
    if (!fs.existsSync(tableDir)) fs.mkdirSync(tableDir, { recursive: true });

    for (const key of Object.keys(configData)) {
      const filePath = path.join(tableDir, `${key}.json`);
      fs.writeFileSync(filePath, JSON.stringify(configData[key], null, 2), 'utf8');
    }
    console.log(`  ✅ Đã bóc tách ${Object.keys(configData).length} bảng dữ liệu vào _source_game/config_tables/`);
  } catch (e) {
    console.log(`  ⚠️ Lỗi tải config.cfg:`, e.message);
  }

  console.log(`\n======================================================`);
  console.log(`🎉 HOÀN TẤT TẢI & BÓC TÁCH MÃ NGUỒN GAME VÀO _source_game!`);
  console.log(`======================================================\n`);
}

if (require.main === module) {
  const version = process.argv[2] ? parseInt(process.argv[2], 10) : CONFIG.CLIENT_VERSION;
  downloadFullGame(version);
}

module.exports = { downloadFullGame };
