// Code.gs
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('FoodStock Manager')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ฟังก์ชันดึงข้อมูลทั้งหมดเมื่อเปิดแอพ (ต้องส่ง token; ไม่ผ่าน validation คืน { error: 'Unauthorized' })
// เวอร์ชันตรงกับ Code-backup.gs ที่ใช้งานได้
function getSystemData(token) {
  var ctx = validateToken(token);
  if (!ctx) return { error: 'Unauthorized' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const getData = (sheetName) => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    if (!data || data.length < 1) return [];
    const headers = data.shift();
    return data.map(row => {
      let obj = {};
      headers.forEach((h, i) => {
        const originalKey = String(h || '').trim();
        const normalizedKey = originalKey.toLowerCase();
        const value = row[i];
        obj[originalKey] = value;
        obj[normalizedKey] = value;
      });
      return obj;
    });
  };

  const items = getData('Items');
  const branches = getData('Branches').map(b => ({
    id: b.id || b['id'],
    name: b.name || b['Name'] || b['name'] || '',
    isHQ: Boolean(b.isHQ || b['isHQ'] || b['IsHQ'] || false)
  }));
  const unitsRaw = getData('Units');
  const categoriesRaw = getData('Categories');
  const suppliersRaw = getData('Suppliers');
  const units = (unitsRaw && unitsRaw.length ? unitsRaw : []).map(u => ({ id: u.id || u['id'], name: String(u.name || u['Name'] || u['name'] || '').trim() }));
  const categories = (categoriesRaw && categoriesRaw.length ? categoriesRaw : []).map(c => ({ id: c.id || c['id'], name: String(c.name || c['Name'] || c['name'] || '').trim() }));
  const suppliers = (suppliersRaw && suppliersRaw.length ? suppliersRaw : []).map(s => ({ id: s.id || s['id'], name: String(s.name || s['Name'] || s['name'] || '').trim() }));
  const itemSuppliersRaw = getData('ItemSuppliers');
  const itemSuppliers = (itemSuppliersRaw && itemSuppliersRaw.length ? itemSuppliersRaw : []).map(r => ({
    itemId: String(r.itemId || r['itemId'] || '').trim(),
    supplierId: String(r.supplierId || r['supplierId'] || '').trim(),
    nameAtSupplier: String(r.nameAtSupplier || r['nameAtSupplier'] || r['nameatsupplier'] || '').trim()
  }));
  const inventoryRaw = getData('Inventory');
  const transactions = getData('Transactions');

  const stock = {};
  inventoryRaw.forEach(row => {
    if (row.remainingQty > 0) {
      if (!stock[row.branchId]) stock[row.branchId] = {};
      if (!stock[row.branchId][row.itemId]) stock[row.branchId][row.itemId] = [];
      const up = row.unitPrice != null && row.unitPrice !== '' ? Number(row.unitPrice) : undefined;
      stock[row.branchId][row.itemId].push({
        id: row.lotId,
        receivedDate: formatDate(new Date(row.receivedDate)),
        expiryDate: row.expiryDate instanceof Date ? formatDate(row.expiryDate) : row.expiryDate,
        supplier: row.supplier,
        remainingQty: Number(row.remainingQty),
        unitPrice: up
      });
    }
  });

  return {
    items: items,
    branches: branches,
    units: units,
    categories: categories,
    suppliers: suppliers,
    itemSuppliers: itemSuppliers,
    stock: stock,
    transactions: transactions.reverse()
  };
}

// ฟังก์ชันบันทึก Transaction (In/Out/Transfer/Adjust)
function saveTransaction(payload) {
  var ctx = validateToken(payload.token);
  if (!ctx) return { success: false, error: 'Unauthorized' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const invSheet = ss.getSheetByName('Inventory');
  const txSheet = ss.getSheetByName('Transactions');
  const lock = LockService.getScriptLock();
  
  try {
    lock.waitLock(5000); // ป้องกันการบันทึกชนกัน
    
    const { type, txData, inventoryUpdates } = payload;
    
    // 1. บันทึก Transaction Log
    if (txData && txData.length > 0) {
       txData.forEach(tx => {
         const up = tx.type === 'in' && (tx.unitPrice != null && tx.unitPrice !== '') ? Number(tx.unitPrice) : '';
         const tp = tx.type === 'in' && (tx.totalPrice != null && tx.totalPrice !== '') ? Number(tx.totalPrice) : '';
         const pb = tx.performedBy != null && tx.performedBy !== '' ? String(tx.performedBy).trim() : '';
         txSheet.appendRow([
           tx.id, 
           `'${tx.timestamp}`, // Force string for date
           tx.fromBranch, 
           tx.toBranch || '', 
           tx.itemName, 
           tx.type, 
           tx.amount, 
           tx.unit, 
           tx.note, 
           tx.supplier || '',
           up,
           tp,
           pb
         ]);
       });
    }

    // 2. อัปเดต Inventory (FIFO Logic)
    // inventoryUpdates ควรเป็น Array ของ { branchId, itemId, lotId, newQty, ...newLotData }
    // ถ้าเป็น Lot ใหม่ (In/Adjust+) ให้ append
    // ถ้าเป็น Lot เก่า (Out/Transfer/Adjust-) ให้ update row เดิม
    
    const invData = invSheet.getDataRange().getValues(); // อ่านเพื่อหา row ที่ต้องแก้
    
    inventoryUpdates.forEach(update => {
      if (update.isNewLot) {
        // เพิ่ม Lot ใหม่
        const up = update.unitPrice != null && update.unitPrice !== '' ? Number(update.unitPrice) : '';
        invSheet.appendRow([
          update.branchId,
          update.itemId,
          update.lotId,
          update.receivedDate,
          update.expiryDate,
          update.supplier,
          update.remainingQty,
          up
        ]);
      } else {
        // แก้ไข Lot เดิม (ตัดสต็อก)
        // วนหา Row ที่ตรงกับ Lot ID (วิธีนี้อาจช้าถ้าข้อมูลเยอะมาก แต่เสถียรสำหรับ GAS)
        for (let i = 1; i < invData.length; i++) {
          if (String(invData[i][2]) === String(update.lotId) && // col C is lotId
              String(invData[i][0]) === String(update.branchId)) { // col A is branchId
            
            invSheet.getRange(i + 1, 7).setValue(update.remainingQty); // Col G is remainingQty
            break;
          }
        }
      }
    });

    writeAuditLog(ctx.userId, ctx.username, 'transaction', 'transaction', (txData && txData[0]) ? txData[0].id : '', type + ' x' + (txData ? txData.length : 0));
    return { success: true, message: 'Saved successfully' };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// Helper Format Date YYYY-MM-DD
function formatDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function formatTimestamp() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

// --- Auth helpers ---
function hashPassword(password) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(password || ''), Utilities.Charset.UTF_8);
  return Utilities.base64Encode(bytes);
}

function ensureAuthSheets(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  var users = ss.getSheetByName('Users');
  if (!users) {
    users = ss.insertSheet('Users');
    users.appendRow(['id', 'username', 'passwordHash', 'role', 'mustChangePassword', 'createdAt']);
    var pw = hashPassword('admin123');
    users.appendRow(['U-1', 'admin', pw, 'master', true, formatTimestamp()]);
    Logger.log('Created Users sheet and seeded admin');
  }
  var tokens = ss.getSheetByName('Tokens');
  if (!tokens) {
    tokens = ss.insertSheet('Tokens');
    tokens.appendRow(['token', 'userId', 'expiresAt']);
    Logger.log('Created Tokens sheet');
  }
  var audit = ss.getSheetByName('AuditLog');
  if (!audit) {
    audit = ss.insertSheet('AuditLog');
    audit.appendRow(['id', 'timestamp', 'userId', 'username', 'action', 'entity', 'entityId', 'details']);
    Logger.log('Created AuditLog sheet');
  }
}

function writeAuditLog(userId, username, action, entity, entityId, details) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('AuditLog');
  if (!sheet) return;
  var id = 'AL-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  var ts = formatTimestamp();
  sheet.appendRow([id, ts, userId || '', username || '', action || '', entity || '', entityId || '', details || '']);
}

function login(username, password) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureAuthSheets(ss);
  var users = ss.getSheetByName('Users');
  var tokens = ss.getSheetByName('Tokens');
  var data = users.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  var idCol = headers.indexOf('id');
  var userCol = headers.indexOf('username');
  var hashCol = headers.indexOf('passwordhash');
  var roleCol = headers.indexOf('role');
  var mustCol = headers.indexOf('mustchangepassword');
  if ([idCol, userCol, hashCol, roleCol, mustCol].indexOf(-1) >= 0) return { success: false, error: 'Users sheet format invalid' };
  var row, i, hashed = hashPassword(password);
  for (i = 1; i < data.length; i++) {
    if (String(data[i][userCol] || '').trim() === String(username || '').trim()) {
      row = data[i];
      break;
    }
  }
  if (!row) return { success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  if (row[hashCol] !== hashed) return { success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  var userId = String(row[idCol] || '').trim();
  var role = String(row[roleCol] || '').trim().toLowerCase() || 'viewer';
  var mustChange = !!row[mustCol];
  var token = Utilities.getUuid();
  var exp = new Date();
  exp.setDate(exp.getDate() + 7);
  var expStr = Utilities.formatDate(exp, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  tokens.appendRow([token, userId, expStr]);
  writeAuditLog(userId, String(username || '').trim(), 'login', 'user', userId, '');
  return {
    success: true,
    user: { id: userId, username: String(username || '').trim(), role: role },
    token: token,
    requirePasswordChange: mustChange
  };
}

function validateToken(token) {
  if (!token) return null;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tokens = ss.getSheetByName('Tokens');
  var users = ss.getSheetByName('Users');
  if (!tokens || !users) return null;
  var tData = tokens.getDataRange().getValues();
  var tH = tData[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  var tokenCol = tH.indexOf('token');
  var userIdCol = tH.indexOf('userid');
  var expCol = tH.indexOf('expiresat');
  if ([tokenCol, userIdCol, expCol].indexOf(-1) >= 0) return null;
  var now = new Date();
  var i, row, userId;
  for (i = 1; i < tData.length; i++) {
    if (String(tData[i][tokenCol] || '') === String(token)) {
      row = tData[i];
      break;
    }
  }
  if (!row) return null;
  var exp = new Date(row[expCol]);
  if (isNaN(exp.getTime()) || exp < now) {
    try { tokens.deleteRow(i + 1); } catch (_) {}
    return null;
  }
  userId = String(row[userIdCol] || '').trim();
  var uData = users.getDataRange().getValues();
  var uH = uData[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  var uidCol = uH.indexOf('id');
  var userCol = uH.indexOf('username');
  var roleCol = uH.indexOf('role');
  if ([uidCol, userCol, roleCol].indexOf(-1) >= 0) return null;
  for (i = 1; i < uData.length; i++) {
    if (String(uData[i][uidCol] || '') === userId) {
      return {
        userId: userId,
        username: String(uData[i][userCol] || '').trim(),
        role: String(uData[i][roleCol] || '').trim().toLowerCase() || 'viewer'
      };
    }
  }
  return null;
}

function changePassword(token, newPassword) {
  var ctx = validateToken(token);
  if (!ctx) return { success: false, error: 'Unauthorized' };
  var pw = String(newPassword || '').trim();
  if (pw.length < 4) return { success: false, error: 'รหัสผ่านต้องอย่างน้อย 4 ตัวอักษร' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var users = ss.getSheetByName('Users');
  var data = users.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  var idCol = headers.indexOf('id');
  var hashCol = headers.indexOf('passwordhash');
  var mustCol = headers.indexOf('mustchangepassword');
  if ([idCol, hashCol, mustCol].indexOf(-1) >= 0) return { success: false, error: 'Users sheet format invalid' };
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    data = users.getDataRange().getValues();
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][idCol] || '') === ctx.userId) {
        users.getRange(r + 1, hashCol + 1).setValue(hashPassword(pw));
        users.getRange(r + 1, mustCol + 1).setValue(false);
        writeAuditLog(ctx.userId, ctx.username, 'changePassword', 'user', ctx.userId, '');
        return { success: true };
      }
    }
    return { success: false, error: 'User not found' };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function getUsers(token) {
  var ctx = validateToken(token);
  if (!ctx) return { error: 'Unauthorized' };
  var r = (ctx.role || '').toLowerCase();
  if (r !== 'master' && r !== 'admin') return { error: 'Forbidden' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Users');
  if (!sheet) return { users: [] };
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  var idCol = headers.indexOf('id');
  var userCol = headers.indexOf('username');
  var roleCol = headers.indexOf('role');
  if ([idCol, userCol, roleCol].some(function(c) { return c < 0; })) return { users: [] };
  var users = [];
  for (var i = 1; i < data.length; i++) {
    users.push({
      id: String(data[i][idCol] || '').trim(),
      username: String(data[i][userCol] || '').trim(),
      role: String(data[i][roleCol] || '').trim().toLowerCase() || 'viewer'
    });
  }
  return { users: users };
}

function getAuditLog(token, dateFrom, dateTo) {
  var ctx = validateToken(token);
  if (!ctx) return { error: 'Unauthorized' };
  var r = (ctx.role || '').toLowerCase();
  if (r !== 'master' && r !== 'admin') return { error: 'Forbidden' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('AuditLog');
  if (!sheet) return { rows: [] };
  var data = sheet.getDataRange().getValues();
  if (!data.length) return { rows: [] };
  var headers = data[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  var cols = { id: headers.indexOf('id'), timestamp: headers.indexOf('timestamp'), userId: headers.indexOf('userid'), username: headers.indexOf('username'), action: headers.indexOf('action'), entity: headers.indexOf('entity'), entityid: headers.indexOf('entityid'), details: headers.indexOf('details') };
  var rows = [];
  var from = dateFrom ? new Date(dateFrom) : null;
  var to = dateTo ? new Date(dateTo) : null;
  if (to) to.setHours(23, 59, 59, 999);
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var ts = row[cols.timestamp];
    if (from || to) {
      var d = ts instanceof Date ? ts : (typeof ts === 'string' ? new Date(ts) : null);
      if (d && !isNaN(d.getTime())) {
        if (from && d < from) continue;
        if (to && d > to) continue;
      }
    }
    rows.push({
      id: row[cols.id],
      timestamp: ts,
      userId: row[cols.userId],
      username: row[cols.username],
      action: row[cols.action],
      entity: row[cols.entity],
      entityId: row[cols.entityid],
      details: row[cols.details]
    });
  }
  rows.reverse();
  return { rows: rows };
}

function createUser(token, payload) {
  var ctx = validateToken(token);
  if (!ctx) return { success: false, error: 'Unauthorized' };
  var r = (ctx.role || '').toLowerCase();
  if (r !== 'master' && r !== 'admin') return { success: false, error: 'Forbidden' };
  var role = String(payload.role || 'viewer').trim().toLowerCase();
  if (role !== 'viewer' && role !== 'admin' && role !== 'master') return { success: false, error: 'role ไม่ถูกต้อง' };
  if (r === 'admin' && (role === 'master' || role === 'admin')) return { success: false, error: 'Admin สร้างได้เฉพาะ Viewer' };
  var name = String(payload.username || '').trim();
  if (!name) return { success: false, error: 'กรุณากรอกชื่อผู้ใช้' };
  var pw = String(payload.password || '').trim();
  if (pw.length < 4) return { success: false, error: 'รหัสผ่านต้องอย่างน้อย 4 ตัวอักษร' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Users');
  if (!sheet) return { success: false, error: 'Users sheet not found' };
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  var idCol = headers.indexOf('id');
  var userCol = headers.indexOf('username');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][userCol] || '').trim().toLowerCase() === name.toLowerCase())
      return { success: false, error: 'ชื่อผู้ใช้ซ้ำ' };
  }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var newId = 'U-' + Date.now();
    sheet.appendRow([newId, name, hashPassword(pw), role, false, formatTimestamp()]);
    writeAuditLog(ctx.userId, ctx.username, 'create', 'user', newId, name + ' (' + role + ')');
    return { success: true, id: newId, message: 'เพิ่มผู้ใช้แล้ว' };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function updateUser(token, payload) {
  var ctx = validateToken(token);
  if (!ctx) return { success: false, error: 'Unauthorized' };
  var r = (ctx.role || '').toLowerCase();
  if (r !== 'master' && r !== 'admin') return { success: false, error: 'Forbidden' };
  var id = String(payload.id || '').trim();
  if (!id) return { success: false, error: 'ไม่ระบุผู้ใช้' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Users');
  if (!sheet) return { success: false, error: 'Users sheet not found' };
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  var idCol = headers.indexOf('id');
  var userCol = headers.indexOf('username');
  var roleCol = headers.indexOf('role');
  var hashCol = headers.indexOf('passwordhash');
  var targetRole = null;
  var targetRow = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol] || '') === id) { targetRole = String(data[i][roleCol] || '').trim().toLowerCase(); targetRow = i; break; }
  }
  if (targetRow < 0) return { success: false, error: 'ไม่พบผู้ใช้' };
  if (r === 'admin' && (targetRole === 'master' || targetRole === 'admin')) return { success: false, error: 'Admin แก้ไขได้เฉพาะ Viewer' };
  var newRole = payload.role != null ? String(payload.role).trim().toLowerCase() : null;
  if (newRole && newRole !== 'viewer' && newRole !== 'admin' && newRole !== 'master') return { success: false, error: 'role ไม่ถูกต้อง' };
  if (r === 'admin' && newRole && newRole !== 'viewer') return { success: false, error: 'Admin กำหนด role ได้เฉพาะ viewer' };
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    data = sheet.getDataRange().getValues();
    if (newRole) sheet.getRange(targetRow + 1, roleCol + 1).setValue(newRole);
    var newPw = typeof payload.password === 'string' && payload.password.trim().length >= 4 ? payload.password.trim() : null;
    if (newPw) sheet.getRange(targetRow + 1, hashCol + 1).setValue(hashPassword(newPw));
    writeAuditLog(ctx.userId, ctx.username, 'update', 'user', id, '');
    return { success: true, message: 'แก้ไขแล้ว' };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function deleteUser(token, userId) {
  var ctx = validateToken(token);
  if (!ctx) return { success: false, error: 'Unauthorized' };
  var r = (ctx.role || '').toLowerCase();
  if (r !== 'master' && r !== 'admin') return { success: false, error: 'Forbidden' };
  var id = String(userId || '').trim();
  if (!id) return { success: false, error: 'ไม่ระบุผู้ใช้' };
  if (ctx.userId === id) return { success: false, error: 'ลบตัวเองไม่ได้' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Users');
  if (!sheet) return { success: false, error: 'Users sheet not found' };
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  var idCol = headers.indexOf('id');
  var roleCol = headers.indexOf('role');
  var targetRole = null;
  var targetRow = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol] || '') === id) { targetRole = String(data[i][roleCol] || '').trim().toLowerCase(); targetRow = i; break; }
  }
  if (targetRow < 0) return { success: false, error: 'ไม่พบผู้ใช้' };
  if (r === 'admin' && (targetRole === 'master' || targetRole === 'admin')) return { success: false, error: 'Admin ลบได้เฉพาะ Viewer' };
  var masterCount = 0;
  for (var j = 1; j < data.length; j++) {
    if (String(data[j][roleCol] || '').trim().toLowerCase() === 'master') masterCount++;
  }
  if (targetRole === 'master' && masterCount <= 1) return { success: false, error: 'ต้องมี Master อย่างน้อย 1 คน' };
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    data = sheet.getDataRange().getValues();
    for (var row = 1; row < data.length; row++) {
      if (String(data[row][idCol] || '') === id) {
        sheet.deleteRow(row + 1);
        writeAuditLog(ctx.userId, ctx.username, 'delete', 'user', id, '');
        return { success: true, message: 'ลบผู้ใช้แล้ว' };
      }
    }
    return { success: false, error: 'ไม่พบผู้ใช้' };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// --- Master Data CRUD (Items) ---
function saveItem(item) {
  var ctx = validateToken(item.token);
  if (!ctx) return { success: false, error: 'Unauthorized' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Items');
  if (!sheet) return { success: false, error: 'Sheet Items not found' };
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const col = (k) => headers.indexOf(k);
    const name = String(item.name || '').trim();
    const unit = String(item.unit || 'หน่วย').trim();
    const minStock = isNaN(Number(item.minStock)) ? 0 : Number(item.minStock);
    const category = String(item.category || '').trim();
    if (!name) return { success: false, error: 'กรุณากรอกชื่อสินค้า' };

    const id = item.id;
    if (id) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][col('id')]) === String(id)) {
          sheet.getRange(i + 1, col('name') + 1).setValue(name);
          sheet.getRange(i + 1, col('unit') + 1).setValue(unit);
          sheet.getRange(i + 1, col('minStock') + 1).setValue(minStock);
          sheet.getRange(i + 1, col('category') + 1).setValue(category);
          writeAuditLog(ctx.userId, ctx.username, 'update', 'item', id, name);
          return { success: true, id: id, message: 'แก้ไขแล้ว' };
        }
      }
    }
    const newId = 'I-' + Date.now();
    sheet.appendRow([newId, name, unit, minStock, category]);
    writeAuditLog(ctx.userId, ctx.username, 'create', 'item', newId, name);
    return { success: true, id: newId, message: 'เพิ่มแล้ว' };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// --- Master Data CRUD (Branches) ---
function saveBranch(branch) {
  var ctx = validateToken(branch.token);
  if (!ctx) return { success: false, error: 'Unauthorized' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Branches');
  if (!sheet) return { success: false, error: 'Sheet Branches not found' };
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const col = (k) => headers.indexOf(k);
    const name = String(branch.name || '').trim();
    const isHQ = Boolean(branch.isHQ);
    if (!name) return { success: false, error: 'กรุณากรอกชื่อสาขา' };

    const id = branch.id;
    if (id) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][col('id')]) === String(id)) {
          sheet.getRange(i + 1, col('name') + 1).setValue(name);
          sheet.getRange(i + 1, col('isHQ') + 1).setValue(isHQ);
          writeAuditLog(ctx.userId, ctx.username, 'update', 'branch', id, name);
          return { success: true, id: id, message: 'แก้ไขแล้ว' };
        }
      }
    }
    const newId = 'B-' + Date.now();
    sheet.appendRow([newId, name, isHQ]);
    writeAuditLog(ctx.userId, ctx.username, 'create', 'branch', newId, name);
    return { success: true, id: newId, message: 'เพิ่มแล้ว' };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// --- ลบสินค้า (วัตถุดิบ) ---
function deleteItem(itemId, token) {
  var ctx = validateToken(token);
  if (!ctx) return { success: false, error: 'Unauthorized' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const itemSheet = ss.getSheetByName('Items');
  const invSheet = ss.getSheetByName('Inventory');
  if (!itemSheet || !invSheet) return { success: false, error: 'Sheet not found' };

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var invData = invSheet.getDataRange().getValues();
    var invHeaders = invData[0];
    var itemIdCol = -1;
    for (var ii = 0; ii < invHeaders.length; ii++) {
      if (String(invHeaders[ii] || '').trim().toLowerCase() === 'itemid') { itemIdCol = ii; break; }
    }
    if (itemIdCol < 0) itemIdCol = 1;
    for (var r = 1; r < invData.length; r++) {
      if (String(invData[r][itemIdCol]) === String(itemId)) {
        return { success: false, error: 'ลบไม่ได้ — มีสต็อกหรือประวัติใช้งานรายการนี้อยู่' };
      }
    }

    var data = itemSheet.getDataRange().getValues();
    var headers = data[0];
    var idCol = -1;
    for (var i = 0; i < headers.length; i++) {
      if (String(headers[i] || '').trim().toLowerCase() === 'id') { idCol = i; break; }
    }
    if (idCol < 0) return { success: false, error: 'Column id not found' };
    for (var row = 1; row < data.length; row++) {
      if (String(data[row][idCol]) === String(itemId)) {
        itemSheet.deleteRow(row + 1);
        writeAuditLog(ctx.userId, ctx.username, 'delete', 'item', itemId, '');
        return { success: true, message: 'ลบรายการสินค้าแล้ว' };
      }
    }
    return { success: false, error: 'ไม่พบรายการสินค้านี้' };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// --- ลบสาขา ---
function deleteBranch(branchId, token) {
  var ctx = validateToken(token);
  if (!ctx) return { success: false, error: 'Unauthorized' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const branchSheet = ss.getSheetByName('Branches');
  const invSheet = ss.getSheetByName('Inventory');
  const txSheet = ss.getSheetByName('Transactions');
  if (!branchSheet || !invSheet || !txSheet) return { success: false, error: 'Sheet not found' };

  var branchName = null;
  var data = branchSheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = -1, nameCol = -1;
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || '').trim().toLowerCase();
    if (h === 'id') idCol = i;
    if (h === 'name') nameCol = i;
  }
  if (idCol < 0 || nameCol < 0) return { success: false, error: 'Columns id/name not found' };
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idCol]) === String(branchId)) {
      branchName = String(data[r][nameCol] || '').trim();
      break;
    }
  }
  if (!branchName) return { success: false, error: 'ไม่พบสาขานี้' };

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var invData = invSheet.getDataRange().getValues();
    var invHeaders = invData[0];
    var branchIdCol = -1;
    for (var bi = 0; bi < invHeaders.length; bi++) {
      if (String(invHeaders[bi] || '').trim().toLowerCase() === 'branchid') { branchIdCol = bi; break; }
    }
    if (branchIdCol < 0) branchIdCol = 0;
    for (var r = 1; r < invData.length; r++) {
      if (String(invData[r][branchIdCol]) === String(branchId)) {
        return { success: false, error: 'ลบไม่ได้ — สาขานี้มีสต็อกหรือประวัติใช้งานอยู่' };
      }
    }

    var txData = txSheet.getDataRange().getValues();
    var txHeaders = txData[0];
    var fromCol = -1, toCol = -1;
    for (var ti = 0; ti < txHeaders.length; ti++) {
      var th = String(txHeaders[ti] || '').trim().toLowerCase();
      if (th === 'frombranch') fromCol = ti;
      if (th === 'tobranch') toCol = ti;
    }
    if (fromCol < 0) fromCol = 2;
    if (toCol < 0) toCol = 3;
    for (var r = 1; r < txData.length; r++) {
      if (String(txData[r][fromCol] || '').trim() === branchName || String(txData[r][toCol] || '').trim() === branchName) {
        return { success: false, error: 'ลบไม่ได้ — สาขานี้มีสต็อกหรือประวัติใช้งานอยู่' };
      }
    }

    for (var row = 1; row < data.length; row++) {
      if (String(data[row][idCol]) === String(branchId)) {
        branchSheet.deleteRow(row + 1);
        writeAuditLog(ctx.userId, ctx.username, 'delete', 'branch', branchId, branchName || '');
        return { success: true, message: 'ลบสาขาแล้ว' };
      }
    }
    return { success: false, error: 'ไม่พบสาขานี้' };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function ensureSheet(ss, name, headerRow) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headerRow);
  }
  return sheet;
}

function saveUnit(unit) {
  var ctx = validateToken(unit.token);
  if (!ctx) return { success: false, error: 'Unauthorized' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ensureSheet(ss, 'Units', ['id', 'name']);
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var name = String(unit.name || '').trim();
    if (!name) return { success: false, error: 'กรุณากรอกชื่อหน่วย' };
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var idCol = -1, nameCol = -1, i, r;
    for (i = 0; i < headers.length; i++) {
      var h = String(headers[i] || '').trim().toLowerCase();
      if (h === 'id') idCol = i;
      if (h === 'name') nameCol = i;
    }
    if (idCol < 0 || nameCol < 0) return { success: false, error: 'Columns id/name not found' };
    var id = unit.id;
    if (id) {
      for (r = 1; r < data.length; r++) {
        if (String(data[r][idCol]) === String(id)) {
          sheet.getRange(r + 1, nameCol + 1).setValue(name);
          writeAuditLog(ctx.userId, ctx.username, 'update', 'unit', id, name);
          return { success: true, id: id, message: 'แก้ไขแล้ว' };
        }
      }
    }
    var newId = 'U-' + Date.now();
    sheet.appendRow([newId, name]);
    writeAuditLog(ctx.userId, ctx.username, 'create', 'unit', newId, name);
    return { success: true, id: newId, message: 'เพิ่มแล้ว' };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function deleteUnit(unitId, token) {
  var ctx = validateToken(token);
  if (!ctx) return { success: false, error: 'Unauthorized' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var unitSheet = ss.getSheetByName('Units');
  var itemSheet = ss.getSheetByName('Items');
  if (!unitSheet) return { success: false, error: 'Sheet Units not found' };
  var unitName = null, data = unitSheet.getDataRange().getValues(), headers = data[0];
  var idCol = -1, nameCol = -1, i, r, j, k, uc, row;
  for (i = 0; i < headers.length; i++) {
    var h = String(headers[i] || '').trim().toLowerCase();
    if (h === 'id') idCol = i;
    if (h === 'name') nameCol = i;
  }
  for (r = 1; r < data.length; r++) {
    if (String(data[r][idCol]) === String(unitId)) {
      unitName = String(data[r][nameCol] || '').trim();
      break;
    }
  }
  if (!unitName) return { success: false, error: 'ไม่พบหน่วยนี้' };
  if (itemSheet) {
    var itemData = itemSheet.getDataRange().getValues(), itemHeaders = itemData[0];
    uc = -1;
    for (j = 0; j < itemHeaders.length; j++) {
      if (String(itemHeaders[j] || '').trim().toLowerCase() === 'unit') { uc = j; break; }
    }
    if (uc >= 0) {
      for (k = 1; k < itemData.length; k++) {
        if (String(itemData[k][uc] || '').trim() === unitName)
          return { success: false, error: 'ลบไม่ได้ — มีรายการสินค้าใช้หน่วยนี้อยู่' };
      }
    }
  }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    data = unitSheet.getDataRange().getValues();
    for (row = 1; row < data.length; row++) {
      if (String(data[row][idCol]) === String(unitId)) {
        unitSheet.deleteRow(row + 1);
        writeAuditLog(ctx.userId, ctx.username, 'delete', 'unit', unitId, unitName || '');
        return { success: true, message: 'ลบหน่วยแล้ว' };
      }
    }
    return { success: false, error: 'ไม่พบหน่วยนี้' };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function saveCategory(cat) {
  var ctx = validateToken(cat.token);
  if (!ctx) return { success: false, error: 'Unauthorized' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ensureSheet(ss, 'Categories', ['id', 'name']);
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var name = String(cat.name || '').trim();
    if (!name) return { success: false, error: 'กรุณากรอกชื่อหมวดหมู่' };
    var data = sheet.getDataRange().getValues(), headers = data[0];
    var idCol = -1, nameCol = -1, i, r;
    for (i = 0; i < headers.length; i++) {
      var h = String(headers[i] || '').trim().toLowerCase();
      if (h === 'id') idCol = i;
      if (h === 'name') nameCol = i;
    }
    if (idCol < 0 || nameCol < 0) return { success: false, error: 'Columns id/name not found' };
    var id = cat.id;
    if (id) {
      for (r = 1; r < data.length; r++) {
        if (String(data[r][idCol]) === String(id)) {
          sheet.getRange(r + 1, nameCol + 1).setValue(name);
          writeAuditLog(ctx.userId, ctx.username, 'update', 'category', id, name);
          return { success: true, id: id, message: 'แก้ไขแล้ว' };
        }
      }
    }
    var newId = 'C-' + Date.now();
    sheet.appendRow([newId, name]);
    writeAuditLog(ctx.userId, ctx.username, 'create', 'category', newId, name);
    return { success: true, id: newId, message: 'เพิ่มแล้ว' };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function deleteCategory(catId, token) {
  var ctx = validateToken(token);
  if (!ctx) return { success: false, error: 'Unauthorized' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var catSheet = ss.getSheetByName('Categories');
  var itemSheet = ss.getSheetByName('Items');
  if (!catSheet) return { success: false, error: 'Sheet Categories not found' };
  var catName = null, data = catSheet.getDataRange().getValues(), headers = data[0];
  var idCol = -1, nameCol = -1, i, r, j, k, cc, row;
  for (i = 0; i < headers.length; i++) {
    var h = String(headers[i] || '').trim().toLowerCase();
    if (h === 'id') idCol = i;
    if (h === 'name') nameCol = i;
  }
  for (r = 1; r < data.length; r++) {
    if (String(data[r][idCol]) === String(catId)) {
      catName = String(data[r][nameCol] || '').trim();
      break;
    }
  }
  if (!catName) return { success: false, error: 'ไม่พบหมวดหมู่นี้' };
  if (itemSheet) {
    var itemData = itemSheet.getDataRange().getValues(), itemHeaders = itemData[0];
    cc = -1;
    for (j = 0; j < itemHeaders.length; j++) {
      if (String(itemHeaders[j] || '').trim().toLowerCase() === 'category') { cc = j; break; }
    }
    if (cc >= 0) {
      for (k = 1; k < itemData.length; k++) {
        if (String(itemData[k][cc] || '').trim() === catName)
          return { success: false, error: 'ลบไม่ได้ — มีรายการสินค้าใช้หมวดหมู่นี้อยู่' };
      }
    }
  }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    data = catSheet.getDataRange().getValues();
    for (row = 1; row < data.length; row++) {
      if (String(data[row][idCol]) === String(catId)) {
        catSheet.deleteRow(row + 1);
        writeAuditLog(ctx.userId, ctx.username, 'delete', 'category', catId, catName || '');
        return { success: true, message: 'ลบหมวดหมู่แล้ว' };
      }
    }
    return { success: false, error: 'ไม่พบหมวดหมู่นี้' };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function saveSupplier(supplier) {
  var ctx = validateToken(supplier.token);
  if (!ctx) return { success: false, error: 'Unauthorized' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ensureSheet(ss, 'Suppliers', ['id', 'name']);
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var name = String(supplier.name || '').trim();
    if (!name) return { success: false, error: 'กรุณากรอกชื่อคู่ค้า' };
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var idCol = -1, nameCol = -1, i, r;
    for (i = 0; i < headers.length; i++) {
      var h = String(headers[i] || '').trim().toLowerCase();
      if (h === 'id') idCol = i;
      if (h === 'name') nameCol = i;
    }
    if (idCol < 0 || nameCol < 0) return { success: false, error: 'Columns id/name not found' };
    var id = supplier.id;
    if (id) {
      for (r = 1; r < data.length; r++) {
        if (String(data[r][idCol]) === String(id)) {
          sheet.getRange(r + 1, nameCol + 1).setValue(name);
          writeAuditLog(ctx.userId, ctx.username, 'update', 'supplier', id, name);
          return { success: true, id: id, message: 'แก้ไขแล้ว' };
        }
      }
    }
    var newId = 'S-' + Date.now();
    sheet.appendRow([newId, name]);
    writeAuditLog(ctx.userId, ctx.username, 'create', 'supplier', newId, name);
    return { success: true, id: newId, message: 'เพิ่มแล้ว' };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function deleteSupplier(supplierId, token) {
  var ctx = validateToken(token);
  if (!ctx) return { success: false, error: 'Unauthorized' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var supSheet = ss.getSheetByName('Suppliers');
  if (!supSheet) return { success: false, error: 'Sheet Suppliers not found' };
  var data = supSheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = -1, nameCol = -1, i, r, row;
  for (i = 0; i < headers.length; i++) {
    var h = String(headers[i] || '').trim().toLowerCase();
    if (h === 'id') idCol = i;
    if (h === 'name') nameCol = i;
  }
  var supplierName = null;
  for (r = 1; r < data.length; r++) {
    if (String(data[r][idCol]) === String(supplierId)) {
      supplierName = String(data[r][nameCol] || '').trim();
      break;
    }
  }
  if (!supplierName) return { success: false, error: 'ไม่พบคู่ค้านี้' };
  var invSheet = ss.getSheetByName('Inventory');
  if (invSheet) {
    var invData = invSheet.getDataRange().getValues();
    var invHeaders = invData[0];
    var supCol = -1;
    for (i = 0; i < invHeaders.length; i++) {
      if (String(invHeaders[i] || '').trim().toLowerCase() === 'supplier') { supCol = i; break; }
    }
    if (supCol >= 0) {
      for (r = 1; r < invData.length; r++) {
        if (String(invData[r][supCol] || '').trim() === supplierName)
          return { success: false, error: 'ลบไม่ได้ — มีสต็อกหรือประวัติใช้คู่ค้านี้อยู่' };
      }
    }
  }
  var txSheet = ss.getSheetByName('Transactions');
  if (txSheet) {
    var txData = txSheet.getDataRange().getValues();
    var txHeaders = txData[0];
    var txSupCol = -1;
    for (i = 0; i < txHeaders.length; i++) {
      if (String(txHeaders[i] || '').trim().toLowerCase() === 'supplier') { txSupCol = i; break; }
    }
    if (txSupCol >= 0) {
      for (r = 1; r < txData.length; r++) {
        if (String(txData[r][txSupCol] || '').trim() === supplierName)
          return { success: false, error: 'ลบไม่ได้ — มีสต็อกหรือประวัติใช้คู่ค้านี้อยู่' };
      }
    }
  }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    data = supSheet.getDataRange().getValues();
    for (row = 1; row < data.length; row++) {
      if (String(data[row][idCol]) === String(supplierId)) {
        supSheet.deleteRow(row + 1);
        writeAuditLog(ctx.userId, ctx.username, 'delete', 'supplier', supplierId, supplierName || '');
        return { success: true, message: 'ลบคู่ค้าแล้ว' };
      }
    }
    return { success: false, error: 'ไม่พบคู่ค้านี้' };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function saveItemSupplier(payload) {
  var ctx = validateToken(payload.token);
  if (!ctx) return { success: false, error: 'Unauthorized' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ensureSheet(ss, 'ItemSuppliers', ['itemId', 'supplierId', 'nameAtSupplier']);
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var itemId = String(payload.itemId || '').trim();
    var supplierId = String(payload.supplierId || '').trim();
    var nameAtSupplier = String(payload.nameAtSupplier || '').trim();
    if (!itemId || !supplierId) return { success: false, error: 'กรุณาเลือกสินค้าและคู่ค้า' };
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var itemCol = -1, supCol = -1, nameCol = -1, i, r;
    for (i = 0; i < headers.length; i++) {
      var h = String(headers[i] || '').trim().toLowerCase();
      if (h === 'itemid') itemCol = i;
      if (h === 'supplierid') supCol = i;
      if (h === 'nameatsupplier') nameCol = i;
    }
    if (itemCol < 0 || supCol < 0 || nameCol < 0) return { success: false, error: 'ItemSuppliers columns not found' };
    for (r = 1; r < data.length; r++) {
      if (String(data[r][itemCol]) === itemId && String(data[r][supCol]) === supplierId) {
        sheet.getRange(r + 1, nameCol + 1).setValue(nameAtSupplier);
        writeAuditLog(ctx.userId, ctx.username, 'update', 'itemSupplier', itemId + '/' + supplierId, nameAtSupplier || '');
        return { success: true, message: 'แก้ไขแล้ว' };
      }
    }
    sheet.appendRow([itemId, supplierId, nameAtSupplier]);
    writeAuditLog(ctx.userId, ctx.username, 'create', 'itemSupplier', itemId + '/' + supplierId, nameAtSupplier || '');
    return { success: true, message: 'เพิ่มแล้ว' };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function deleteItemSupplier(itemId, supplierId, token) {
  var ctx = validateToken(token);
  if (!ctx) return { success: false, error: 'Unauthorized' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('ItemSuppliers');
  if (!sheet) return { success: false, error: 'Sheet ItemSuppliers not found' };
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var itemCol = -1, supCol = -1, i, row;
  for (i = 0; i < headers.length; i++) {
    var h = String(headers[i] || '').trim().toLowerCase();
    if (h === 'itemid') itemCol = i;
    if (h === 'supplierid') supCol = i;
  }
  if (itemCol < 0 || supCol < 0) return { success: false, error: 'ItemSuppliers columns not found' };
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    data = sheet.getDataRange().getValues();
    for (row = 1; row < data.length; row++) {
      if (String(data[row][itemCol]) === String(itemId) && String(data[row][supCol]) === String(supplierId)) {
        sheet.deleteRow(row + 1);
        writeAuditLog(ctx.userId, ctx.username, 'delete', 'itemSupplier', itemId + '/' + supplierId, '');
        return { success: true, message: 'ลบแล้ว' };
      }
    }
    return { success: false, error: 'ไม่พบรายการนี้' };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// --- Menu Cost Calculator Persistence ---
function ensureMenuSheets(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  var defs = [
    { name: 'Menus', headers: ['id', 'name', 'note', 'targetFoodCostPercent', 'createdAt', 'updatedAt'] },
    { name: 'MenuIngredients', headers: ['menuId', 'type', 'itemId', 'itemName', 'unit', 'unitPriceManual', 'qty'] },
    { name: 'MenuOverheads', headers: ['menuId', 'label', 'type', 'value'] }
  ];
  defs.forEach(function(def) {
    var sh = ss.getSheetByName(def.name);
    if (!sh) {
      sh = ss.insertSheet(def.name);
      sh.appendRow(def.headers);
      Logger.log('Created sheet: ' + def.name);
    }
  });
}

function saveMenu(payload) {
  var ctx = validateToken(payload && payload.token);
  if (!ctx) return { success: false, error: 'Unauthorized' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureMenuSheets(ss);
  var menusSheet = ss.getSheetByName('Menus');
  var ingSheet = ss.getSheetByName('MenuIngredients');
  var ohSheet = ss.getSheetByName('MenuOverheads');
  if (!menusSheet || !ingSheet || !ohSheet) return { success: false, error: 'Menu sheets not found' };

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var menu = payload.menu || {};
    var name = String(menu.name || '').trim();
    if (!name) return { success: false, error: 'กรุณากรอกชื่อเมนู' };
    var note = String(menu.note || '').trim();
    var tfc = menu.targetFoodCostPercent != null && menu.targetFoodCostPercent !== '' ? Number(menu.targetFoodCostPercent) : '';
    var id = String(menu.id || '').trim();
    var isUpdate = Boolean(id);
    if (!id) id = 'M-' + Date.now();

    var now = formatTimestamp();
    var data = menusSheet.getDataRange().getValues();
    var headers = data[0] || [];
    var col = function(k) { return headers.indexOf(k); };
    var idCol = col('id'), nameCol = col('name'), noteCol = col('note'), tfcCol = col('targetFoodCostPercent'), createdCol = col('createdAt'), updatedCol = col('updatedAt');
    if (idCol < 0 || nameCol < 0) return { success: false, error: 'Menus columns not found' };
    var foundRow = -1;
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][idCol] || '') === id) { foundRow = r; break; }
    }
    if (foundRow >= 0) {
      menusSheet.getRange(foundRow + 1, nameCol + 1).setValue(name);
      if (noteCol >= 0) menusSheet.getRange(foundRow + 1, noteCol + 1).setValue(note);
      if (tfcCol >= 0) menusSheet.getRange(foundRow + 1, tfcCol + 1).setValue(tfc);
      if (updatedCol >= 0) menusSheet.getRange(foundRow + 1, updatedCol + 1).setValue(now);
      writeAuditLog(ctx.userId, ctx.username, 'update', 'menu', id, name);
    } else {
      // Append in header order (assume fixed headers)
      menusSheet.appendRow([id, name, note, tfc, now, now]);
      writeAuditLog(ctx.userId, ctx.username, 'create', 'menu', id, name);
      isUpdate = false;
    }

    // Replace ingredients/overheads by menuId
    var deleteByMenuId = function(sheet, menuId) {
      var all = sheet.getDataRange().getValues();
      if (!all || all.length < 2) return;
      var h = all[0] || [];
      var menuCol = -1;
      for (var i = 0; i < h.length; i++) {
        if (String(h[i] || '').trim().toLowerCase() === 'menuid') { menuCol = i; break; }
      }
      if (menuCol < 0) return;
      for (var rr = all.length - 1; rr >= 1; rr--) {
        if (String(all[rr][menuCol] || '').trim() === String(menuId)) {
          sheet.deleteRow(rr + 1);
        }
      }
    };
    deleteByMenuId(ingSheet, id);
    deleteByMenuId(ohSheet, id);

    var ingredients = payload.ingredients || [];
    ingredients.forEach(function(row) {
      var t = String(row.type || '').trim();
      var itemId = String(row.itemId || '').trim();
      var itemName = String(row.itemName || '').trim();
      var unit = String(row.unit || '').trim();
      var upm = row.unitPriceManual != null && row.unitPriceManual !== '' ? Number(row.unitPriceManual) : '';
      var qty = row.qty != null && row.qty !== '' ? Number(row.qty) : '';
      if (!t) return;
      ingSheet.appendRow([id, t, itemId, itemName, unit, upm, qty]);
    });
    var overheads = payload.overheads || [];
    overheads.forEach(function(row) {
      var label = String(row.label || '').trim();
      var t = String(row.type || '').trim();
      var val = row.value != null && row.value !== '' ? Number(row.value) : '';
      if (!label && !val) return;
      ohSheet.appendRow([id, label, t, val]);
    });

    return { success: true, id: id, message: isUpdate ? 'บันทึกเมนูแล้ว' : 'สร้างเมนูแล้ว' };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function deleteMenu(menuId, token) {
  var ctx = validateToken(token);
  if (!ctx) return { success: false, error: 'Unauthorized' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureMenuSheets(ss);
  var menusSheet = ss.getSheetByName('Menus');
  var ingSheet = ss.getSheetByName('MenuIngredients');
  var ohSheet = ss.getSheetByName('MenuOverheads');
  if (!menusSheet || !ingSheet || !ohSheet) return { success: false, error: 'Menu sheets not found' };
  var id = String(menuId || '').trim();
  if (!id) return { success: false, error: 'menuId required' };
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var data = menusSheet.getDataRange().getValues();
    var headers = data[0] || [];
    var idCol = -1;
    for (var i = 0; i < headers.length; i++) {
      if (String(headers[i] || '').trim().toLowerCase() === 'id') { idCol = i; break; }
    }
    if (idCol < 0) return { success: false, error: 'Menus columns not found' };
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][idCol] || '').trim() === id) {
        menusSheet.deleteRow(r + 1);
        break;
      }
    }
    var deleteByMenuId = function(sheet, menuId) {
      var all = sheet.getDataRange().getValues();
      if (!all || all.length < 2) return;
      var h = all[0] || [];
      var menuCol = -1;
      for (var ii = 0; ii < h.length; ii++) {
        if (String(h[ii] || '').trim().toLowerCase() === 'menuid') { menuCol = ii; break; }
      }
      if (menuCol < 0) return;
      for (var rr = all.length - 1; rr >= 1; rr--) {
        if (String(all[rr][menuCol] || '').trim() === String(menuId)) {
          sheet.deleteRow(rr + 1);
        }
      }
    };
    deleteByMenuId(ingSheet, id);
    deleteByMenuId(ohSheet, id);
    writeAuditLog(ctx.userId, ctx.username, 'delete', 'menu', id, '');
    return { success: true, message: 'ลบเมนูแล้ว' };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const requiredSheets = ['Items', 'Branches', 'Inventory', 'Transactions', 'Units', 'Categories', 'Suppliers', 'ItemSuppliers', 'Menus', 'MenuIngredients', 'MenuOverheads'];
  const headers = {
    'Items': ['id', 'name', 'unit', 'minStock', 'category'],
    'Branches': ['id', 'name', 'isHQ'],
    'Inventory': ['branchId', 'itemId', 'lotId', 'receivedDate', 'expiryDate', 'supplier', 'remainingQty', 'unitPrice'],
    'Transactions': ['id', 'timestamp', 'fromBranch', 'toBranch', 'itemName', 'type', 'amount', 'unit', 'note', 'supplier', 'unitPrice', 'totalPrice', 'performedBy'],
    'Units': ['id', 'name'],
    'Categories': ['id', 'name'],
    'Suppliers': ['id', 'name'],
    'ItemSuppliers': ['itemId', 'supplierId', 'nameAtSupplier'],
    'Menus': ['id', 'name', 'note', 'targetFoodCostPercent', 'createdAt', 'updatedAt'],
    'MenuIngredients': ['menuId', 'type', 'itemId', 'itemName', 'unit', 'unitPriceManual', 'qty'],
    'MenuOverheads': ['menuId', 'label', 'type', 'value']
  };
  const seed = {
    'Units': [['U-1', 'หน่วย'], ['U-2', 'กก.'], ['U-3', 'ถุง'], ['U-4', 'กระป๋อง'], ['U-5', 'ลัง'], ['U-6', 'ขวด'], ['U-7', 'ซอง'], ['U-8', 'กล่อง']],
    'Categories': [['C-1', 'วัตถุดิบ'], ['C-2', 'ของแห้ง'], ['C-3', 'ผักสด'], ['C-4', 'เนื้อสัตว์'], ['C-5', 'เครื่องปรุง'], ['C-6', 'เครื่องดื่ม'], ['C-7', 'อื่นๆ']],
    'Suppliers': [['S-1', 'Makro'], ['S-2', 'Go Wholesale'], ['S-3', 'Freshket'], ['S-4', 'ตลาดสดท้องถิ่น'], ['S-5', 'CP FreshMart']]
  };

  requiredSheets.forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(headers[sheetName]);
      if (seed[sheetName]) {
        seed[sheetName].forEach(function(row) { sheet.appendRow(row); });
      }
      Logger.log('Created sheet: ' + sheetName);
    } else {
      Logger.log('Sheet already exists: ' + sheetName);
    }
  });
  ensurePricingColumns(ss);
  ensureAuthSheets(ss);
  ensureMenuSheets(ss);
  Logger.log('All sheets setup complete.');
}

function ensurePricingColumns(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  var inv = ss.getSheetByName('Inventory');
  var tx = ss.getSheetByName('Transactions');
  if (!inv || !tx) return;
  var invLast = inv.getLastColumn();
  var invH = inv.getRange(1, 1, 1, invLast).getValues()[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  if (invH.indexOf('unitprice') < 0) {
    inv.getRange(1, invLast + 1).setValue('unitPrice');
    Logger.log('Inventory: added unitPrice column');
  }
  var txLast = tx.getLastColumn();
  var txH = tx.getRange(1, 1, 1, txLast).getValues()[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  if (txH.indexOf('unitprice') < 0) {
    tx.getRange(1, txLast + 1).setValue('unitPrice');
    txLast++;
    Logger.log('Transactions: added unitPrice column');
  }
  txH = tx.getRange(1, 1, 1, tx.getLastColumn()).getValues()[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  if (txH.indexOf('totalprice') < 0) {
    tx.getRange(1, tx.getLastColumn() + 1).setValue('totalPrice');
    Logger.log('Transactions: added totalPrice column');
  }
  txH = tx.getRange(1, 1, 1, tx.getLastColumn()).getValues()[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  if (txH.indexOf('performedby') < 0) {
    tx.getRange(1, tx.getLastColumn() + 1).setValue('performedBy');
    Logger.log('Transactions: added performedBy column');
  }
}