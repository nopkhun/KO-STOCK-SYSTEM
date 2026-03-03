// Code.gs - VERSION 2025.02.05.FINAL (Full data: + Inventory + Transactions)
var CODE_VERSION = '2025.02.05.FINAL';

// TEST FUNCTION - เพื่อ debug
function testGetData(token) {
  try {
    var ctx = validateToken(token);
    if (!ctx) return { error: 'Unauthorized', test: true };
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return { error: 'NoSpreadsheet', test: true };
    
    var unitsSheet = ss.getSheetByName('Units');
    var unitsData = unitsSheet ? unitsSheet.getDataRange().getValues() : [];
    
    var categoriesSheet = ss.getSheetByName('Categories');
    var categoriesData = categoriesSheet ? categoriesSheet.getDataRange().getValues() : [];
    
    return {
      success: true,
      version: CODE_VERSION,
      unitsRows: unitsData.length,
      categoriesRows: categoriesData.length,
      test: true
    };
  } catch (e) {
    return {
      error: String(e.message || e),
      test: true
    };
  }
}

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('FoodStock Manager')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ฟังก์ชันตรวจสอบ version - ไม่ต้อง auth
function getCodeVersion() {
  return { version: CODE_VERSION, timestamp: new Date().toISOString() };
}

// Helper function - ดึงข้อมูลจาก sheet (ย้ายออกมาเป็น global function)
function _getSheetData(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (!data || data.length < 1) return [];
  var headers = data.shift();
  var result = [];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (!row || !Array.isArray(row)) continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var h = headers[j];
      var originalKey = String(h || '').trim();
      var normalizedKey = originalKey.toLowerCase();
      var val = j < row.length ? row[j] : undefined;
      obj[originalKey] = val;
      obj[normalizedKey] = val;
    }
    result.push(obj);
  }
  return result;
}

// ฟังก์ชันดึงข้อมูลทั้งหมด - VERSION F9 (Basic data only - no inventory/transactions)
function getSystemData(token) {
  try {
    var ctx = validateToken(token);
    if (!ctx) return { error: 'Unauthorized' };
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return { error: 'NoSpreadsheet' };
    ensurePricingColumns(ss); // Ensure Transactions has outReason, outValue etc.
    
    // Get basic sheet data + Menus (ยกเว้น Inventory, Transactions)
    var itemsRaw = _getSheetData(ss, 'Items');
    var branchesRaw = _getSheetData(ss, 'Branches');
    var unitsRaw = _getSheetData(ss, 'Units');
    var categoriesRaw = _getSheetData(ss, 'Categories');
    var suppliersRaw = _getSheetData(ss, 'Suppliers');
    var itemSuppliersRaw = _getSheetData(ss, 'ItemSuppliers');
    // Menus group: โหลดใน try-catch ถ้า error ใช้ []
    var menusRaw = [];
    var menuIngredientsRaw = [];
    var menuOverheadsRaw = [];
    try {
      menusRaw = _getSheetData(ss, 'Menus');
      menuIngredientsRaw = _getSheetData(ss, 'MenuIngredients');
      menuOverheadsRaw = _getSheetData(ss, 'MenuOverheads');
    } catch (menuLoadErr) {
      Logger.log('Menus group load error: ' + menuLoadErr);
    }
    
    // Map branches
    var branches = [];
    for (var i = 0; i < branchesRaw.length; i++) {
      var b = branchesRaw[i];
      branches.push({
        id: b.id || b['id'],
        name: b.name || b['Name'] || b['name'] || '',
        isHQ: !!(b.isHQ || b['isHQ'] || b['IsHQ'] || b.ishq)
      });
    }
    
    // Map units
    var units = [];
    for (var i = 0; i < unitsRaw.length; i++) {
      var u = unitsRaw[i];
      units.push({ id: u.id || u['id'], name: String(u.name || u['Name'] || '').trim() });
    }
    
    // Map categories
    var categories = [];
    for (var i = 0; i < categoriesRaw.length; i++) {
      var c = categoriesRaw[i];
      categories.push({ id: c.id || c['id'], name: String(c.name || c['Name'] || '').trim() });
    }
    
    // Map suppliers
    var suppliers = [];
    for (var i = 0; i < suppliersRaw.length; i++) {
      var s = suppliersRaw[i];
      suppliers.push({ id: s.id || s['id'], name: String(s.name || s['Name'] || '').trim() });
    }
    
    // Map itemSuppliers
    var itemSuppliers = [];
    for (var i = 0; i < itemSuppliersRaw.length; i++) {
      var r = itemSuppliersRaw[i];
      itemSuppliers.push({
        itemId: String(r.itemId || r['itemId'] || '').trim(),
        supplierId: String(r.supplierId || r['supplierId'] || '').trim(),
        nameAtSupplier: String(r.nameAtSupplier || r['nameAtSupplier'] || r['nameatsupplier'] || '').trim()
      });
    }
    
    // Map menus (ใน try-catch ถ้า error ใช้ [])
    var menus = [];
    var menuIngredients = [];
    var menuOverheads = [];
    try {
      for (var i = 0; i < menusRaw.length; i++) {
        var m = menusRaw[i];
        var menuId = String(m.id || m['id'] || '').trim();
        var menuName = String(m.name || m['Name'] || m['name'] || '').trim();
        if (menuId && menuName) {
          var createdAtVal = m.createdAt || m['createdAt'] || m['createdat'] || '';
          var updatedAtVal = m.updatedAt || m['updatedAt'] || m['updatedat'] || '';
          if (createdAtVal && typeof createdAtVal.getTime === 'function') createdAtVal = createdAtVal.toISOString ? createdAtVal.toISOString() : String(createdAtVal);
          if (updatedAtVal && typeof updatedAtVal.getTime === 'function') updatedAtVal = updatedAtVal.toISOString ? updatedAtVal.toISOString() : String(updatedAtVal);
          menus.push({
            id: menuId,
            name: menuName,
            note: String(m.note || m['Note'] || m['note'] || '').trim(),
            targetFoodCostPercent: m.targetFoodCostPercent != null ? Number(m.targetFoodCostPercent) : (m.targetfoodcostpercent != null ? Number(m.targetfoodcostpercent) : ''),
            createdAt: createdAtVal,
            updatedAt: updatedAtVal
          });
        }
      }
      for (var i = 0; i < menuIngredientsRaw.length; i++) {
        var r = menuIngredientsRaw[i];
        var menuId = String(r.menuId || r['menuId'] || r['menuid'] || '').trim();
        if (menuId) {
          menuIngredients.push({
            menuId: menuId,
            type: String(r.type || r['type'] || '').trim(),
            itemId: String(r.itemId || r['itemId'] || r['itemid'] || '').trim(),
            itemName: String(r.itemName || r['itemName'] || r['itemname'] || '').trim(),
            unit: String(r.unit || r['unit'] || '').trim(),
            unitPriceManual: r.unitPriceManual != null && r.unitPriceManual !== '' ? Number(r.unitPriceManual) : (r.unitpricemanual != null && r.unitpricemanual !== '' ? Number(r.unitpricemanual) : ''),
            qty: r.qty != null && r.qty !== '' ? Number(r.qty) : ''
          });
        }
      }
      for (var i = 0; i < menuOverheadsRaw.length; i++) {
        var r = menuOverheadsRaw[i];
        var menuId = String(r.menuId || r['menuId'] || r['menuid'] || '').trim();
        if (menuId) {
          menuOverheads.push({
            menuId: menuId,
            label: String(r.label || r['label'] || '').trim(),
            type: String(r.type || r['type'] || '').trim(),
            value: r.value != null && r.value !== '' ? Number(r.value) : ''
          });
        }
      }
    } catch (menuMapErr) {
      Logger.log('Menus map error: ' + menuMapErr);
    }
    
    // Inventory + Transactions (try-catch, dates as string)
    var stock = {};
    var transactions = [];
    try {
      var inventoryRaw = _getSheetData(ss, 'Inventory');
      var transactionsRaw = _getSheetData(ss, 'Transactions');
      
      for (var i = 0; i < inventoryRaw.length; i++) {
        var row = inventoryRaw[i];
        var rQty = Number(row.remainingQty || row.remainingqty || 0);
        if (rQty > 0) {
          var branchId = row.branchId || row.branchid;
          var itemId = row.itemId || row.itemid;
          if (!stock[branchId]) stock[branchId] = {};
          if (!stock[branchId][itemId]) stock[branchId][itemId] = [];
          var up = row.unitPrice != null && row.unitPrice !== '' ? Number(row.unitPrice) : (row.unitprice != null && row.unitprice !== '' ? Number(row.unitprice) : undefined);
          var recDate = '';
          var expDate = '';
          var rd = row.receivedDate || row.receiveddate;
          if (rd) {
            try { recDate = formatDate(new Date(rd)); } catch (e) { recDate = String(rd); }
          }
          var ed = row.expiryDate || row.expirydate;
          if (ed) {
            try {
              if (ed && typeof ed.getTime === 'function') expDate = formatDate(ed);
              else expDate = String(ed || '');
            } catch (e) { expDate = String(ed || ''); }
          }
          stock[branchId][itemId].push({
            id: row.lotId || row.lotid,
            receivedDate: recDate,
            expiryDate: expDate,
            supplier: row.supplier,
            remainingQty: rQty,
            unitPrice: up
          });
        }
      }
      
      for (var i = 0; i < transactionsRaw.length; i++) {
        var tx = transactionsRaw[i];
        var ts = tx.timestamp;
        if (ts && typeof ts.getTime === 'function') ts = ts.toISOString ? ts.toISOString() : String(ts);
        transactions.push({
          id: tx.id || tx['id'],
          timestamp: ts,
          type: tx.type,
          itemId: tx.itemId || tx.itemid,
          branchId: tx.branchId || tx.branchid,
          targetBranchId: tx.targetBranchId || tx.targetbranchid || '',
          qty: Number(tx.qty || tx.amount || 0),
          fromBranch: tx.fromBranch || tx.frombranch || '',
          toBranch: tx.toBranch || tx.tobranch || '',
          itemName: tx.itemName || tx.itemname || '',
          amount: Number(tx.amount || tx.qty || 0),
          unit: tx.unit || '',
          note: tx.note || '',
          supplier: tx.supplier || '',
          userId: tx.userId || tx.userid || '',
          performedBy: tx.performedBy || tx.performedby || '',
          unitPrice: tx.unitPrice != null && tx.unitPrice !== '' ? Number(tx.unitPrice) : (tx.unitprice != null && tx.unitprice !== '' ? Number(tx.unitprice) : ''),
          totalPrice: tx.totalPrice != null && tx.totalPrice !== '' ? Number(tx.totalPrice) : (tx.totalprice != null && tx.totalprice !== '' ? Number(tx.totalprice) : ''),
          lotId: tx.lotId || tx.lotid || '',
          outReason: tx.outReason != null && tx.outReason !== '' ? String(tx.outReason).trim() : (tx.outreason != null && tx.outreason !== '' ? String(tx.outreason).trim() : ''),
          outValue: tx.outValue != null && tx.outValue !== '' && !isNaN(Number(tx.outValue)) ? Number(tx.outValue) : (tx.outvalue != null && tx.outvalue !== '' && !isNaN(Number(tx.outvalue)) ? Number(tx.outvalue) : null)
        });
      }
      transactions.reverse();
    } catch (invTxErr) {
      Logger.log('Inventory/Transactions error: ' + invTxErr);
    }
    
    return {
      items: itemsRaw,
      branches: branches,
      units: units,
      categories: categories,
      suppliers: suppliers,
      itemSuppliers: itemSuppliers,
      menus: menus,
      menuIngredients: menuIngredients,
      menuOverheads: menuOverheads,
      stock: stock,
      transactions: transactions,
      _version: CODE_VERSION
    };
    
  } catch (e) {
    Logger.log('getSystemData error: ' + (e.message || e));
    return {
      items: [],
      branches: [],
      units: [],
      categories: [],
      suppliers: [],
      itemSuppliers: [],
      menus: [],
      menuIngredients: [],
      menuOverheads: [],
      stock: {},
      transactions: [],
      _debugError: String(e.message || e)
    };
  }
}

// Phase 2 UX: Basic data only (no Inventory/Transactions) — fast first paint after login
function getSystemDataBasic(token) {
  try {
    var ctx = validateToken(token);
    if (!ctx) return { error: 'Unauthorized' };

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return { error: 'NoSpreadsheet' };
    ensurePricingColumns(ss);

    var itemsRaw = _getSheetData(ss, 'Items');
    var branchesRaw = _getSheetData(ss, 'Branches');
    var unitsRaw = _getSheetData(ss, 'Units');
    var categoriesRaw = _getSheetData(ss, 'Categories');
    var suppliersRaw = _getSheetData(ss, 'Suppliers');
    var itemSuppliersRaw = _getSheetData(ss, 'ItemSuppliers');
    var menusRaw = [];
    var menuIngredientsRaw = [];
    var menuOverheadsRaw = [];
    try {
      menusRaw = _getSheetData(ss, 'Menus');
      menuIngredientsRaw = _getSheetData(ss, 'MenuIngredients');
      menuOverheadsRaw = _getSheetData(ss, 'MenuOverheads');
    } catch (menuLoadErr) {
      Logger.log('Menus group load error: ' + menuLoadErr);
    }

    var branches = [];
    for (var i = 0; i < branchesRaw.length; i++) {
      var b = branchesRaw[i];
      branches.push({
        id: b.id || b['id'],
        name: b.name || b['Name'] || b['name'] || '',
        isHQ: !!(b.isHQ || b['isHQ'] || b['IsHQ'] || b.ishq)
      });
    }
    var units = [];
    for (var i = 0; i < unitsRaw.length; i++) {
      var u = unitsRaw[i];
      units.push({ id: u.id || u['id'], name: String(u.name || u['Name'] || '').trim() });
    }
    var categories = [];
    for (var i = 0; i < categoriesRaw.length; i++) {
      var c = categoriesRaw[i];
      categories.push({ id: c.id || c['id'], name: String(c.name || c['Name'] || '').trim() });
    }
    var suppliers = [];
    for (var i = 0; i < suppliersRaw.length; i++) {
      var s = suppliersRaw[i];
      suppliers.push({ id: s.id || s['id'], name: String(s.name || s['Name'] || '').trim() });
    }
    var itemSuppliers = [];
    for (var i = 0; i < itemSuppliersRaw.length; i++) {
      var r = itemSuppliersRaw[i];
      itemSuppliers.push({
        itemId: String(r.itemId || r['itemId'] || '').trim(),
        supplierId: String(r.supplierId || r['supplierId'] || '').trim(),
        nameAtSupplier: String(r.nameAtSupplier || r['nameAtSupplier'] || r['nameatsupplier'] || '').trim()
      });
    }
    var menus = [];
    var menuIngredients = [];
    var menuOverheads = [];
    try {
      for (var i = 0; i < menusRaw.length; i++) {
        var m = menusRaw[i];
        var menuId = String(m.id || m['id'] || '').trim();
        var menuName = String(m.name || m['Name'] || m['name'] || '').trim();
        if (menuId && menuName) {
          var createdAtVal = m.createdAt || m['createdAt'] || m['createdat'] || '';
          var updatedAtVal = m.updatedAt || m['updatedAt'] || m['updatedat'] || '';
          if (createdAtVal && typeof createdAtVal.getTime === 'function') createdAtVal = createdAtVal.toISOString ? createdAtVal.toISOString() : String(createdAtVal);
          if (updatedAtVal && typeof updatedAtVal.getTime === 'function') updatedAtVal = updatedAtVal.toISOString ? updatedAtVal.toISOString() : String(updatedAtVal);
          menus.push({
            id: menuId,
            name: menuName,
            note: String(m.note || m['Note'] || m['note'] || '').trim(),
            targetFoodCostPercent: m.targetFoodCostPercent != null ? Number(m.targetFoodCostPercent) : (m.targetfoodcostpercent != null ? Number(m.targetfoodcostpercent) : ''),
            createdAt: createdAtVal,
            updatedAt: updatedAtVal
          });
        }
      }
      for (var i = 0; i < menuIngredientsRaw.length; i++) {
        var r = menuIngredientsRaw[i];
        var menuId = String(r.menuId || r['menuId'] || r['menuid'] || '').trim();
        if (menuId) {
          menuIngredients.push({
            menuId: menuId,
            type: String(r.type || r['type'] || '').trim(),
            itemId: String(r.itemId || r['itemId'] || r['itemid'] || '').trim(),
            itemName: String(r.itemName || r['itemName'] || r['itemname'] || '').trim(),
            unit: String(r.unit || r['unit'] || '').trim(),
            unitPriceManual: r.unitPriceManual != null && r.unitPriceManual !== '' ? Number(r.unitPriceManual) : (r.unitpricemanual != null && r.unitpricemanual !== '' ? Number(r.unitpricemanual) : ''),
            qty: r.qty != null && r.qty !== '' ? Number(r.qty) : ''
          });
        }
      }
      for (var i = 0; i < menuOverheadsRaw.length; i++) {
        var r = menuOverheadsRaw[i];
        var menuId = String(r.menuId || r['menuId'] || r['menuid'] || '').trim();
        if (menuId) {
          menuOverheads.push({
            menuId: menuId,
            label: String(r.label || r['label'] || '').trim(),
            type: String(r.type || r['type'] || '').trim(),
            value: r.value != null && r.value !== '' ? Number(r.value) : ''
          });
        }
      }
    } catch (menuMapErr) {
      Logger.log('Menus map error: ' + menuMapErr);
    }

    return {
      items: itemsRaw,
      branches: branches,
      units: units,
      categories: categories,
      suppliers: suppliers,
      itemSuppliers: itemSuppliers,
      menus: menus,
      menuIngredients: menuIngredients,
      menuOverheads: menuOverheads,
      _version: CODE_VERSION
    };
  } catch (e) {
    Logger.log('getSystemDataBasic error: ' + (e.message || e));
    return {
      error: String(e.message || e),
      items: [],
      branches: [],
      units: [],
      categories: [],
      suppliers: [],
      itemSuppliers: [],
      menus: [],
      menuIngredients: [],
      menuOverheads: []
    };
  }
}

// Phase 2 UX: Inventory + Transactions only — load after basic data for progressive UX
function getInventoryAndTransactions(token) {
  try {
    var ctx = validateToken(token);
    if (!ctx) return { error: 'Unauthorized' };

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return { error: 'NoSpreadsheet' };
    ensurePricingColumns(ss);

    var stock = {};
    var transactions = [];
    try {
      var inventoryRaw = _getSheetData(ss, 'Inventory');
      var transactionsRaw = _getSheetData(ss, 'Transactions');
      var itemIdByName = {};
      var branchIdByName = {};
      try {
        var itemsRaw = _getSheetData(ss, 'Items');
        var branchesRaw = _getSheetData(ss, 'Branches');
        for (var ii = 0; ii < itemsRaw.length; ii++) {
          var it = itemsRaw[ii];
          var n = String(it.name || it.Name || '').trim();
          if (n) itemIdByName[n] = String(it.id || it.Id || '').trim();
        }
        for (var bi = 0; bi < branchesRaw.length; bi++) {
          var br = branchesRaw[bi];
          var bn = String(br.name || br.Name || '').trim();
          if (bn) branchIdByName[bn] = String(br.id || br.Id || '').trim();
        }
      } catch (lookupErr) {
        Logger.log('getInventoryAndTransactions lookup error: ' + lookupErr);
      }

      for (var i = 0; i < inventoryRaw.length; i++) {
        var row = inventoryRaw[i];
        var rQty = Number(row.remainingQty || row.remainingqty || 0);
        if (rQty > 0) {
          var branchId = row.branchId || row.branchid;
          var itemId = row.itemId || row.itemid;
          if (!stock[branchId]) stock[branchId] = {};
          if (!stock[branchId][itemId]) stock[branchId][itemId] = [];
          var up = row.unitPrice != null && row.unitPrice !== '' ? Number(row.unitPrice) : (row.unitprice != null && row.unitprice !== '' ? Number(row.unitprice) : undefined);
          var recDate = '';
          var expDate = '';
          var rd = row.receivedDate || row.receiveddate;
          if (rd) {
            try { recDate = formatDate(new Date(rd)); } catch (e) { recDate = String(rd); }
          }
          var ed = row.expiryDate || row.expirydate;
          if (ed) {
            try {
              if (ed && typeof ed.getTime === 'function') expDate = formatDate(ed);
              else expDate = String(ed || '');
            } catch (e) { expDate = String(ed || ''); }
          }
          stock[branchId][itemId].push({
            id: row.lotId || row.lotid,
            receivedDate: recDate,
            expiryDate: expDate,
            supplier: row.supplier,
            remainingQty: rQty,
            unitPrice: up
          });
        }
      }

      for (var i = 0; i < transactionsRaw.length; i++) {
        try {
          var tx = transactionsRaw[i];
          if (!tx || typeof tx !== 'object') continue;
          var ts = tx.timestamp;
          if (ts && typeof ts.getTime === 'function') ts = ts.toISOString ? ts.toISOString() : String(ts);
          else if (ts != null) ts = String(ts);
          var fromBranch = String(tx.fromBranch || tx.frombranch || '').trim();
          var itemName = String(tx.itemName || tx.itemname || '').trim();
          var toBranch = String(tx.toBranch || tx.tobranch || '').trim();
          var itemId = tx.itemId || tx.itemid || (itemName ? (itemIdByName[itemName] || '') : '') || '';
          var branchId = tx.branchId || tx.branchid || (fromBranch ? (branchIdByName[fromBranch] || '') : '') || '';
          var targetBranchId = tx.targetBranchId || tx.targetbranchid || (toBranch ? (branchIdByName[toBranch] || '') : '') || '';
          transactions.push({
            id: tx.id != null ? tx.id : (tx['id'] != null ? tx['id'] : ''),
            timestamp: ts,
            type: tx.type || '',
            itemId: itemId,
            branchId: branchId,
            targetBranchId: targetBranchId,
            qty: Number(tx.qty || tx.amount || 0),
            fromBranch: fromBranch,
            toBranch: toBranch,
            itemName: itemName,
            amount: Number(tx.amount || tx.qty || 0),
            unit: tx.unit != null ? String(tx.unit) : '',
            note: tx.note != null ? String(tx.note) : '',
            supplier: tx.supplier != null ? String(tx.supplier) : '',
            userId: tx.userId != null ? String(tx.userId) : (tx.userid != null ? String(tx.userid) : ''),
            performedBy: tx.performedBy != null ? String(tx.performedBy) : (tx.performedby != null ? String(tx.performedby) : ''),
            unitPrice: tx.unitPrice != null && tx.unitPrice !== '' ? Number(tx.unitPrice) : (tx.unitprice != null && tx.unitprice !== '' ? Number(tx.unitprice) : ''),
            totalPrice: tx.totalPrice != null && tx.totalPrice !== '' ? Number(tx.totalPrice) : (tx.totalprice != null && tx.totalprice !== '' ? Number(tx.totalprice) : ''),
            lotId: tx.lotId != null ? String(tx.lotId) : (tx.lotid != null ? String(tx.lotid) : ''),
            outReason: tx.outReason != null && tx.outReason !== '' ? String(tx.outReason).trim() : (tx.outreason != null && tx.outreason !== '' ? String(tx.outreason).trim() : ''),
            outValue: tx.outValue != null && tx.outValue !== '' && !isNaN(Number(tx.outValue)) ? Number(tx.outValue) : (tx.outvalue != null && tx.outvalue !== '' && !isNaN(Number(tx.outvalue)) ? Number(tx.outvalue) : null)
          });
        } catch (rowErr) {
          Logger.log('getInventoryAndTransactions row ' + i + ' error: ' + rowErr);
        }
      }
      transactions.reverse();
    } catch (invTxErr) {
      Logger.log('Inventory/Transactions error: ' + invTxErr);
    }

    return { stock: stock, transactions: transactions };
  } catch (e) {
    Logger.log('getInventoryAndTransactions error: ' + (e.message || e));
    return { error: String(e.message || e), stock: {}, transactions: [] };
  }
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
    lock.waitLock(10000); // ป้องกันการบันทึกชนกัน (10 วิ เพื่อรองรับ GAS latency)
    
    const { type, txData, inventoryUpdates } = payload;
    
    // 1. บันทึก Transaction Log
    if (txData && txData.length > 0) {
       txData.forEach(tx => {
         const up = tx.type === 'in' && (tx.unitPrice != null && tx.unitPrice !== '') ? Number(tx.unitPrice) : '';
         const tp = tx.type === 'in' && (tx.totalPrice != null && tx.totalPrice !== '') ? Number(tx.totalPrice) : '';
         const pb = tx.performedBy != null && tx.performedBy !== '' ? String(tx.performedBy).trim() : '';
         const outReason = tx.type === 'out' && tx.outReason != null && tx.outReason !== '' ? String(tx.outReason).trim() : '';
         const outValue = tx.type === 'out' && tx.outValue != null && tx.outValue !== '' && !isNaN(Number(tx.outValue)) ? Number(tx.outValue) : '';
         var txItemId = tx.itemId != null && tx.itemId !== '' ? String(tx.itemId).trim() : '';
         var txBranchId = tx.branchId != null && tx.branchId !== '' ? String(tx.branchId).trim() : '';
         txSheet.appendRow([
           tx.id,
           `'${tx.timestamp}`,
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
           pb,
           outReason,
           outValue,
           txItemId,
           txBranchId
         ]);
       });
    }

    // 2. อัปเดต Inventory (FIFO Logic)
    // inventoryUpdates ควรเป็น Array ของ { branchId, itemId, lotId, newQty, ...newLotData }
    // ถ้าเป็น Lot ใหม่ (In/Adjust+) ให้ append
    // ถ้าเป็น Lot เก่า (Out/Transfer/Adjust-) ให้ update row เดิม
    
    const invData = invSheet.getDataRange().getValues(); // row 0 = header
    const headerRow = invData.length > 0 ? invData[0] : [];
    const colBranchId = headerRow.indexOf('branchId') >= 0 ? headerRow.indexOf('branchId') : 0;
    const colItemId = headerRow.indexOf('itemId') >= 0 ? headerRow.indexOf('itemId') : 1;
    const colLotId = headerRow.indexOf('lotId') >= 0 ? headerRow.indexOf('lotId') : 2;
    const colRemainingQty = headerRow.indexOf('remainingQty') >= 0 ? headerRow.indexOf('remainingQty') : 6;

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
        // แก้ไข Lot เดิม (ตัดสต็อก) — จับคู่ branchId + itemId + lotId อัปเดตทุกแถวที่ตรง (แถวแรก = qtyToWrite, แถวซ้ำ = 0) เพื่อให้ยอดรวมตรง
        var matchLotId = (update.lotId != null && update.lotId !== '') ? String(update.lotId).trim() : (update.id != null && update.id !== '' ? String(update.id).trim() : '');
        var matchBranchId = (update.branchId != null && update.branchId !== '') ? String(update.branchId).trim() : '';
        var matchItemId = (update.itemId != null && update.itemId !== '') ? String(update.itemId).trim() : '';
        var qtyToWrite = update.remainingQty != null && update.remainingQty !== '' ? Number(update.remainingQty) : 0;
        if (isNaN(qtyToWrite) || qtyToWrite < 0) qtyToWrite = 0;
        if (colRemainingQty < 0) return;
        var firstMatch = true;
        for (var i = 1; i < invData.length; i++) {
          var rowLotId = (invData[i][colLotId] != null && invData[i][colLotId] !== '') ? String(invData[i][colLotId]).trim() : '';
          var rowBranchId = (invData[i][colBranchId] != null && invData[i][colBranchId] !== '') ? String(invData[i][colBranchId]).trim() : '';
          var rowItemId = (invData[i][colItemId] != null && invData[i][colItemId] !== '') ? String(invData[i][colItemId]).trim() : '';
          if (rowBranchId === matchBranchId && rowItemId === matchItemId && rowLotId === matchLotId) {
            invSheet.getRange(i + 1, colRemainingQty + 1).setValue(firstMatch ? qtyToWrite : 0);
            firstMatch = false;
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

// แก้ไข Transaction (เฉพาะของตัวเอง ภายใน 1 ชม.) — reverse inventory แล้ว apply ใหม่
function updateTransaction(payload) {
  var ctx = validateToken(payload.token);
  if (!ctx) return { success: false, error: 'Unauthorized' };
  var txId = payload.txId;
  var newAmount = parseFloat(payload.amount);
  var newNote = String(payload.note || '').trim();
  if (isNaN(newAmount) || newAmount < 0) return { success: false, error: 'Invalid amount' };
  var isDelete = (newAmount === 0);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var txSheet = ss.getSheetByName('Transactions');
  var invSheet = ss.getSheetByName('Inventory');
  if (!txSheet || !invSheet) return { success: false, error: 'Sheets not found' };

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    var txValues = txSheet.getDataRange().getValues();
    if (txValues.length < 2) return { success: false, error: 'No transactions' };
    var txRowIndex = -1;
    for (var r = 1; r < txValues.length; r++) {
      if (String(txValues[r][0]) === String(txId)) { txRowIndex = r; break; }
    }
    if (txRowIndex < 0) return { success: false, error: 'Transaction not found' };

    var row = txValues[txRowIndex];
    var type = String(row[5] || '').trim();
    if (type !== 'in' && type !== 'out') return { success: false, error: 'Cannot edit this type' };

    var performedBy = String(row[12] || '').trim();
    if (performedBy !== ctx.username) return { success: false, error: 'Not your transaction' };

    var txTime = row[1];
    if (typeof txTime === 'string') txTime = parseThaiTimestamp(txTime) || new Date(txTime.replace(/^[\s']+/, ''));
    else if (typeof txTime === 'number') txTime = new Date(txTime);
    else if (txTime && typeof txTime.getTime === 'function') { /* already Date */ }
    else txTime = null;
    if (!txTime || isNaN(txTime.getTime())) return { success: false, error: 'Invalid timestamp' };
    var diffMs = new Date().getTime() - txTime.getTime();
    if (diffMs < 0 || diffMs > 3600000) return { success: false, error: 'Editable only within 1 hour' };

    var fromBranch = String(row[2] || '').trim();
    var itemName = String(row[4] || '').trim();
    var oldAmount = parseFloat(row[6]) || 0;
    var unit = String(row[7] || '').trim();
    var supplier = String(row[9] || '').trim();
    var unitPrice = row[10] != null && row[10] !== '' ? Number(row[10]) : '';
    var oldTotalPrice = row[11] != null && row[11] !== '' ? Number(row[11]) : 0;
    var oldOutValue = row[14] != null && row[14] !== '' ? Number(row[14]) : 0;
    var oldLotId = String(row[15] != null && row[15] !== '' ? row[15] : '').trim(); // lotId ที่บันทึกไว้ใน tx (col 16)

    var branchesRaw = _getSheetData(ss, 'Branches');
    var branchId = null;
    for (var b = 0; b < branchesRaw.length; b++) {
      if (String(branchesRaw[b].name || branchesRaw[b].Name || '').trim() === fromBranch) {
        branchId = String(branchesRaw[b].id || branchesRaw[b].Id || '').trim();
        break;
      }
    }
    var itemsRaw = _getSheetData(ss, 'Items');
    var itemId = null;
    for (var it = 0; it < itemsRaw.length; it++) {
      if (String(itemsRaw[it].name || itemsRaw[it].Name || '').trim() === itemName) {
        itemId = String(itemsRaw[it].id || itemsRaw[it].Id || '').trim();
        break;
      }
    }
    if (!branchId || !itemId) return { success: false, error: 'Branch or item not found' };

    var invValues = invSheet.getDataRange().getValues();
    // Cols: 0=branchId, 1=itemId, 2=lotId, 3=receivedDate, 4=expiryDate, 5=supplier, 6=remainingQty, 7=unitPrice

    if (type === 'in') {
      // Reverse: FIFO deduct old amount from branchId/itemId (ค้นหา lot เดิมก่อนเพื่อเก็บ expiryDate)
      var toDeduct = oldAmount;
      var invRows = [];
      var originalExpiryDate = 'N/A'; // fallback
      for (var i = 1; i < invValues.length; i++) {
        if (String(invValues[i][0]) !== branchId || String(invValues[i][1]) !== itemId) continue;
        var thisLotId = String(invValues[i][2] != null ? invValues[i][2] : '').trim();
        // จำ expiryDate ของ lot ต้นฉบับ (match lotId ที่ส่งมาใน tx หรือ lot แรกที่พบ)
        if (originalExpiryDate === 'N/A' || (oldLotId && thisLotId === oldLotId)) {
          var expVal = invValues[i][4];
          if (expVal != null && expVal !== '') originalExpiryDate = String(expVal);
        }
        invRows.push({ rowIndex: i, lotId: thisLotId, receivedDate: invValues[i][3], expiryDate: invValues[i][4], supplier: invValues[i][5], remainingQty: parseFloat(invValues[i][6]) || 0, unitPrice: invValues[i][7] });
      }
      invRows.sort(function(a, b) { return new Date(a.receivedDate) - new Date(b.receivedDate); });
      for (var j = 0; j < invRows.length && toDeduct > 0; j++) {
        var lot = invRows[j];
        var deduct = Math.min(lot.remainingQty, toDeduct);
        if (deduct <= 0) continue;
        var newQty = lot.remainingQty - deduct;
        toDeduct -= deduct;
        invSheet.getRange(lot.rowIndex + 1, 7).setValue(newQty);
      }
      if (toDeduct > 0) return { success: false, error: 'Inventory insufficient to reverse' };
      if (isDelete) {
        txSheet.deleteRow(txRowIndex + 1);
        writeAuditLog(ctx.userId, ctx.username, 'transaction', 'delete', txId, 'amount 0 = remove');
        return { success: true, message: 'Removed' };
      }
      // Apply: add new lot with new amount (คืน expiryDate เดิม ไม่ใช้ 'N/A')
      var newLotId = 'EDIT-' + new Date().getTime();
      var today = formatDate(new Date());
      invSheet.appendRow([branchId, itemId, newLotId, today, originalExpiryDate, supplier, newAmount, unitPrice]);
      var newTotalPrice = (unitPrice !== '' && !isNaN(Number(unitPrice))) ? newAmount * Number(unitPrice) : '';
      txSheet.getRange(txRowIndex + 1, 7).setValue(newAmount);
      txSheet.getRange(txRowIndex + 1, 9).setValue(newNote);
      if (newTotalPrice !== '') txSheet.getRange(txRowIndex + 1, 12).setValue(newTotalPrice);
    } else {
      // type === 'out'
      // Reverse: add back lot with old amount, unitPrice = oldOutValue/oldAmount
      var backUnitPrice = oldAmount > 0 && oldOutValue > 0 ? oldOutValue / oldAmount : '';
      var backLotId = 'REV-' + new Date().getTime();
      var today = formatDate(new Date());
      invSheet.appendRow([branchId, itemId, backLotId, today, 'N/A', 'คืนจากแก้ไขประวัติ', oldAmount, backUnitPrice]);
      if (isDelete) {
        txSheet.deleteRow(txRowIndex + 1);
        writeAuditLog(ctx.userId, ctx.username, 'transaction', 'delete', txId, 'amount 0 = remove');
        return { success: true, message: 'Removed' };
      }
      // Apply: FIFO deduct new amount and compute new outValue
      var toDeduct = newAmount;
      var deductedValue = 0;
      var invRows2 = [];
      // อ่าน Inventory ทั้งหมดครั้งเดียว (หลัง appendRow reverse lot แล้ว) — ประหยัด quota
      var invValuesAfterReverse = invSheet.getDataRange().getValues();
      for (var i = 1; i < invValuesAfterReverse.length; i++) {
        var r = invValuesAfterReverse[i];
        if (String(r[0]) !== branchId || String(r[1]) !== itemId) continue;
        invRows2.push({ rowIndex: i + 1, lotId: r[2], receivedDate: r[3], remainingQty: parseFloat(r[6]) || 0, unitPrice: r[7] != null && r[7] !== '' ? Number(r[7]) : 0 });
      }
      invRows2.sort(function(a, b) { return new Date(a.receivedDate) - new Date(b.receivedDate); });
      for (var k = 0; k < invRows2.length && toDeduct > 0; k++) {
        var lot = invRows2[k];
        var deduct = Math.min(lot.remainingQty, toDeduct);
        if (deduct <= 0) continue;
        deductedValue += deduct * lot.unitPrice;
        var newQty = lot.remainingQty - deduct;
        toDeduct -= deduct;
        invSheet.getRange(lot.rowIndex, 7).setValue(newQty);
      }
      if (toDeduct > 0) return { success: false, error: 'Stock insufficient for new amount' };
      txSheet.getRange(txRowIndex + 1, 7).setValue(newAmount);
      txSheet.getRange(txRowIndex + 1, 9).setValue(newNote);
      txSheet.getRange(txRowIndex + 1, 15).setValue(deductedValue);
    }

    writeAuditLog(ctx.userId, ctx.username, 'transaction', 'update', txId, 'edit in/out');
    return { success: true, message: 'Updated' };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// Parse timestamp string from sheet: "d/m/yyyyBE HH:mm:ss" or "d/m/yyyyBE" (Buddhist Era)
function parseThaiTimestamp(str) {
  if (str == null || str === '') return null;
  var s = String(str).replace(/^[\s']+/, '').trim();
  var spaceIdx = s.indexOf(' ');
  var datePart = spaceIdx >= 0 ? s.substring(0, spaceIdx) : s;
  var timePart = spaceIdx >= 0 ? s.substring(spaceIdx + 1) : '';
  var dateParts = datePart.split('/');
  if (dateParts.length < 3) return null;
  var day = parseInt(dateParts[0], 10);
  var month = parseInt(dateParts[1], 10) - 1;
  var yearBE = parseInt(dateParts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(yearBE)) return null;
  var yearCE = yearBE - 543;
  var hour = 0, minute = 0, second = 0;
  if (timePart) {
    var timeParts = timePart.split(':');
    hour = timeParts[0] ? parseInt(timeParts[0], 10) : 0;
    minute = timeParts[1] ? parseInt(timeParts[1], 10) : 0;
    second = timeParts[2] ? parseInt(timeParts[2], 10) : 0;
  }
  var d = new Date(yearCE, month, day, hour, minute, second);
  return isNaN(d.getTime()) ? null : d;
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
  var tRange = tokens.getDataRange();
  if (!tRange) return null;
  var tData = tRange.getValues();
  if (!tData || tData.length < 1) return null;
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
  var uRange = users.getDataRange();
  if (!uRange) return null;
  var uData = uRange.getValues();
  if (!uData || uData.length < 1) return null;
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

// ตรวจสอบสถานะการตั้งค่าระบบ (ใช้สำหรับหน้าตั้งค่า)
function getSetupStatus(token) {
  var ctx = validateToken(token);
  if (!ctx) return { success: false, error: 'Unauthorized' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var names = ['Units', 'Categories', 'Suppliers', 'Menus', 'MenuIngredients', 'MenuOverheads'];
  var status = {};
  names.forEach(function(name) {
    var sh = ss.getSheetByName(name);
    if (!sh) {
      status[name] = { exists: false, rows: 0, cols: 0 };
      return;
    }
    var range = sh.getDataRange();
    var rows = range ? range.getNumRows() : 0;
    var cols = range ? range.getNumColumns() : 0;
    status[name] = { exists: true, rows: rows, cols: cols };
  });
  return { success: true, status: status };
}

// รับ token (optional) — ถ้ามี จะคืนค่าข้อมูลระบบหลังสร้างชีต เพื่อให้แอปอัปเดตทันทีโดยไม่ต้อง refetch
function setupSheets(token) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const requiredSheets = ['Items', 'Branches', 'Inventory', 'Transactions', 'Units', 'Categories', 'Suppliers', 'ItemSuppliers', 'Menus', 'MenuIngredients', 'MenuOverheads'];
  const headers = {
    'Items': ['id', 'name', 'unit', 'minStock', 'category'],
    'Branches': ['id', 'name', 'isHQ'],
    'Inventory': ['branchId', 'itemId', 'lotId', 'receivedDate', 'expiryDate', 'supplier', 'remainingQty', 'unitPrice'],
    'Transactions': ['id', 'timestamp', 'fromBranch', 'toBranch', 'itemName', 'type', 'amount', 'unit', 'note', 'supplier', 'unitPrice', 'totalPrice', 'performedBy', 'outReason', 'outValue'],
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
      var range = sheet.getDataRange();
      var rowCount = range ? range.getNumRows() : 0;
      if (seed[sheetName] && rowCount <= 1) {
        seed[sheetName].forEach(function(row) { sheet.appendRow(row); });
        Logger.log('Seeded existing empty sheet: ' + sheetName);
      } else {
        Logger.log('Sheet already exists: ' + sheetName);
      }
    }
  });
  ensurePricingColumns(ss);
  ensureAuthSheets(ss);
  ensureMenuSheets(ss);
  Logger.log('All sheets setup complete.');

  if (token) {
    var data = getSystemData(token);
    if (data && !data.error) return data;
  }
  return null;
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
  txH = tx.getRange(1, 1, 1, tx.getLastColumn()).getValues()[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  if (txH.indexOf('outreason') < 0) {
    tx.getRange(1, tx.getLastColumn() + 1).setValue('outReason');
    Logger.log('Transactions: added outReason column');
  }
  txH = tx.getRange(1, 1, 1, tx.getLastColumn()).getValues()[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  if (txH.indexOf('outvalue') < 0) {
    tx.getRange(1, tx.getLastColumn() + 1).setValue('outValue');
    Logger.log('Transactions: added outValue column');
  }
  txH = tx.getRange(1, 1, 1, tx.getLastColumn()).getValues()[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  if (txH.indexOf('itemid') < 0) {
    tx.getRange(1, tx.getLastColumn() + 1).setValue('itemId');
    Logger.log('Transactions: added itemId column');
  }
  txH = tx.getRange(1, 1, 1, tx.getLastColumn()).getValues()[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  if (txH.indexOf('branchid') < 0) {
    tx.getRange(1, tx.getLastColumn() + 1).setValue('branchId');
    Logger.log('Transactions: added branchId column');
  }
}

/**
 * Migration: เติมคอลัมน์ itemId และ branchId ใน Transactions ให้ข้อมูลเดิม
 * ใช้จากชื่อสินค้า (itemName) และชื่อสาขา (fromBranch/toBranch) ไปหาค่า id จาก Items/Branches
 * รันครั้งเดียวจาก Script Editor: เลือก migrateTransactionsItemIdBranchId แล้วกด Run
 * @returns {{ updated: number, columnsAdded: boolean, message: string }}
 */
function migrateTransactionsItemIdBranchId() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var txSheet = ss.getSheetByName('Transactions');
  if (!txSheet) {
    Logger.log('Transactions sheet not found');
    return { updated: 0, columnsAdded: false, message: 'ไม่พบชีต Transactions' };
  }
  var itemsRaw = _getSheetData(ss, 'Items');
  var branchesRaw = _getSheetData(ss, 'Branches');
  var itemIdByName = {};
  for (var i = 0; i < itemsRaw.length; i++) {
    var it = itemsRaw[i];
    var n = String(it.name || it.Name || '').trim();
    if (n) itemIdByName[n] = String(it.id || it.Id || '').trim();
  }
  var branchIdByName = {};
  for (var b = 0; b < branchesRaw.length; b++) {
    var br = branchesRaw[b];
    var bn = String(br.name || br.Name || '').trim();
    if (bn) branchIdByName[bn] = String(br.id || br.Id || '').trim();
  }

  var data = txSheet.getDataRange().getValues();
  if (!data || data.length < 2) {
    return { updated: 0, columnsAdded: false, message: 'ไม่มีข้อมูลใน Transactions (มีแค่หัวตารางหรือไม่มีแถวข้อมูล)' };
  }
  var headers = data[0].map(function(h) { return String(h || '').trim(); });
  var headersLower = headers.map(function(h) { return h.toLowerCase(); });
  var colFromBranch = headersLower.indexOf('frombranch');
  var colToBranch = headersLower.indexOf('tobranch');
  var colItemName = headersLower.indexOf('itemname');
  var colItemId = headersLower.indexOf('itemid');
  var colBranchId = headersLower.indexOf('branchid');
  if (colFromBranch < 0 || colItemName < 0) {
    return { updated: 0, columnsAdded: false, message: 'ไม่พบคอลัมน์ fromBranch หรือ itemName ใน Transactions' };
  }
  if (colToBranch < 0) colToBranch = -1;

  var columnsAdded = false;
  var lastCol = txSheet.getLastColumn();
  if (colItemId < 0 || colBranchId < 0) {
    txSheet.getRange(1, lastCol + 1).setValue('itemId');
    txSheet.getRange(1, lastCol + 2).setValue('branchId');
    colItemId = lastCol;
    colBranchId = lastCol + 1;
    lastCol += 2;
    columnsAdded = true;
  }

  var updated = 0;
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var itemName = String(row[colItemName] != null ? row[colItemName] : '').trim();
    var fromBranch = String(row[colFromBranch] != null ? row[colFromBranch] : '').trim();
    var toBranch = colToBranch >= 0 && row[colToBranch] != null ? String(row[colToBranch]).trim() : '';
    var itemId = itemName ? (itemIdByName[itemName] || '') : '';
    var branchId = fromBranch ? (branchIdByName[fromBranch] || '') : '';
    var needWrite = false;
    var currentItemId = row[colItemId] != null ? String(row[colItemId]).trim() : '';
    var currentBranchId = row[colBranchId] != null ? String(row[colBranchId]).trim() : '';
    if (itemId !== currentItemId || branchId !== currentBranchId) {
      txSheet.getRange(r + 1, colItemId + 1).setValue(itemId);
      txSheet.getRange(r + 1, colBranchId + 1).setValue(branchId);
      updated++;
    }
  }
  Logger.log('migrateTransactionsItemIdBranchId: updated ' + updated + ' rows, columnsAdded=' + columnsAdded);
  return { updated: updated, columnsAdded: columnsAdded, message: 'เติม itemId/branchId แล้ว ' + updated + ' แถว' + (columnsAdded ? ' (เพิ่มคอลัมน์ใหม่ด้วย)' : '') };
}

/**
 * อัปเดตรายการใน Transactions ที่เป็น "ปรับยอดนับจริง" แต่บันทึกเป็น in/out ให้เป็น adjust
 * ใช้สำหรับแก้ข้อมูลเก่าที่บันทึกก่อนแก้ไข frontend
 * รันจาก Editor: เลือก fixStockTakeTransactionTypes แล้วกด Run
 * @returns {{ updated: number, message: string }}
 */
function fixStockTakeTransactionTypes() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var txSheet = ss.getSheetByName('Transactions');
  if (!txSheet) {
    Logger.log('Transactions sheet not found');
    return { updated: 0, message: 'ไม่พบชีต Transactions' };
  }
  var data = txSheet.getDataRange().getValues();
  if (!data || data.length < 2) {
    return { updated: 0, message: 'ไม่มีข้อมูลใน Transactions' };
  }
  var headers = data[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  var colType = headers.indexOf('type');
  var colNote = headers.indexOf('note');
  if (colType < 0 || colNote < 0) {
    Logger.log('Missing type or note column. type=' + colType + ', note=' + colNote);
    return { updated: 0, message: 'โครงสร้างคอลัมน์ไม่ตรง (ต้องมี type, note)' };
  }
  var updated = 0;
  var keyword = 'ปรับยอดนับจริง';
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var typeVal = String(row[colType] || '').trim();
    var noteVal = String(row[colNote] || '');
    if ((typeVal === 'in' || typeVal === 'out') && noteVal.indexOf(keyword) !== -1) {
      txSheet.getRange(r + 1, colType + 1).setValue('adjust');
      updated++;
    }
  }
  Logger.log('fixStockTakeTransactionTypes: updated ' + updated + ' rows');
  return { updated: updated, message: 'อัปเดตแล้ว ' + updated + ' รายการเป็นประเภท ปรับยอด' };
}