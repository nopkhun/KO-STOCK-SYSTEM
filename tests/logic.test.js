/**
 * KO-Stock-System — Unit tests for core logic (FIFO, date parsing)
 * Run: node tests/logic.test.js
 * No npm install required (Node 16+)
 */

const assert = require('assert');

// --- Mirror of frontend calculateFIFODeduction (Index.html) ---
function calculateFIFODeduction(currentStock, branchId, itemId, amount) {
  let remaining = parseFloat(amount);
  const branchData = currentStock[branchId] || {};
  const lots = [...(branchData[itemId] || [])].sort(
    (a, b) => new Date(a.receivedDate) - new Date(b.receivedDate)
  );

  const updates = [];
  const keptLots = [];
  let deductedValue = 0;

  for (const lot of lots) {
    if (remaining <= 0) {
      keptLots.push(lot);
      continue;
    }

    const unitPrice =
      lot.unitPrice != null && !isNaN(Number(lot.unitPrice))
        ? Number(lot.unitPrice)
        : 0;

    if (lot.remainingQty <= remaining) {
      const deducted = lot.remainingQty;
      remaining -= deducted;
      deductedValue += deducted * unitPrice;
      updates.push({
        ...lot,
        lotId: lot.id || lot.lotId,
        remainingQty: 0,
        isNewLot: false,
        branchId,
        itemId,
      });
    } else {
      const deducted = remaining;
      const newQty = lot.remainingQty - remaining;
      remaining = 0;
      deductedValue += deducted * unitPrice;
      updates.push({
        ...lot,
        lotId: lot.id || lot.lotId,
        remainingQty: newQty,
        isNewLot: false,
        branchId,
        itemId,
      });
      keptLots.push({ ...lot, remainingQty: newQty });
    }
  }

  if (remaining > 0) return null; // Not enough stock
  return { keptLots, updates, deductedValue };
}

// --- Mirror of frontend parseThaiDate (Index.html) — multi-format version ---
function parseThaiDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim().replace(/^'/, ''); // strip leading apostrophe if any
  // Path 1: BE slash format "d/m/yyyyBE HH:mm:ss"
  const spaceIdx = s.indexOf(' ');
  const datePart = spaceIdx >= 0 ? s.slice(0, spaceIdx) : s;
  const timePart = spaceIdx >= 0 ? s.slice(spaceIdx + 1) : '';
  const dateParts = datePart.split('/');
  if (dateParts.length >= 3) {
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const yearBE = parseInt(dateParts[2], 10);
    const yearCE = yearBE - 543;
    let hour = 0, minute = 0, second = 0;
    if (timePart) {
      const timeParts = timePart.split(':');
      hour = timeParts[0] ? parseInt(timeParts[0], 10) : 0;
      minute = timeParts[1] ? parseInt(timeParts[1], 10) : 0;
      second = timeParts[2] ? parseInt(timeParts[2], 10) : 0;
    }
    return new Date(yearCE, month, day, hour, minute, second);
  }
  // Path 2 & 3: ISO or CE space format
  const normalized = s.replace(' ', 'T');
  const d = new Date(normalized);
  if (!isNaN(d.getTime())) return d;
  return null;
}

// --- Tests ---

function testFIFO_fullLot() {
  const stock = {
    B1: {
      I1: [
        { id: 'L1', receivedDate: '2026-01-01', remainingQty: 100, unitPrice: 10 },
      ],
    },
  };
  const r = calculateFIFODeduction(stock, 'B1', 'I1', 100);
  assert.ok(r !== null);
  assert.strictEqual(r.keptLots.length, 0);
  assert.strictEqual(r.updates.length, 1);
  assert.strictEqual(r.updates[0].remainingQty, 0);
  assert.strictEqual(r.updates[0].lotId, 'L1');
  assert.strictEqual(r.deductedValue, 1000);
  console.log('  OK FIFO: deduct full lot');
}

function testFIFO_partialLot() {
  const stock = {
    B1: {
      I1: [
        { id: 'L1', receivedDate: '2026-01-01', remainingQty: 100, unitPrice: 10 },
      ],
    },
  };
  const r = calculateFIFODeduction(stock, 'B1', 'I1', 30);
  assert.ok(r !== null);
  assert.strictEqual(r.keptLots.length, 1);
  assert.strictEqual(r.keptLots[0].remainingQty, 70);
  assert.strictEqual(r.updates.length, 1);
  assert.strictEqual(r.updates[0].remainingQty, 70);
  assert.strictEqual(r.deductedValue, 300);
  console.log('  OK FIFO: deduct partial lot');
}

function testFIFO_multipleLots() {
  const stock = {
    B1: {
      I1: [
        { id: 'L1', receivedDate: '2026-01-01', remainingQty: 50, unitPrice: 10 },
        { id: 'L2', receivedDate: '2026-01-02', remainingQty: 80, unitPrice: 12 },
      ],
    },
  };
  const r = calculateFIFODeduction(stock, 'B1', 'I1', 100);
  assert.ok(r !== null);
  assert.strictEqual(r.updates.length, 2);
  assert.strictEqual(r.updates[0].remainingQty, 0);
  assert.strictEqual(r.updates[1].remainingQty, 30);
  assert.strictEqual(r.keptLots.length, 1);
  assert.strictEqual(r.keptLots[0].remainingQty, 30);
  assert.strictEqual(r.deductedValue, 50 * 10 + 50 * 12);
  console.log('  OK FIFO: deduct across multiple lots (FIFO order)');
}

function testFIFO_insufficient() {
  const stock = {
    B1: {
      I1: [
        { id: 'L1', receivedDate: '2026-01-01', remainingQty: 20, unitPrice: 10 },
      ],
    },
  };
  const r = calculateFIFODeduction(stock, 'B1', 'I1', 50);
  assert.strictEqual(r, null);
  console.log('  OK FIFO: returns null when insufficient stock');
}

function testFIFO_emptyBranch() {
  const stock = { B1: {} };
  const r = calculateFIFODeduction(stock, 'B1', 'I1', 10);
  assert.strictEqual(r, null);
  console.log('  OK FIFO: empty branch returns null');
}

function testFIFO_updatesHaveLotId() {
  const stock = {
    B1: {
      I1: [
        { id: 'L-123', receivedDate: '2026-01-01', remainingQty: 5, unitPrice: 1 },
      ],
    },
  };
  const r = calculateFIFODeduction(stock, 'B1', 'I1', 5);
  assert.ok(r !== null);
  assert.strictEqual(r.updates[0].lotId, 'L-123');
  assert.strictEqual(r.updates[0].branchId, 'B1');
  assert.strictEqual(r.updates[0].itemId, 'I1');
  console.log('  OK FIFO: updates include lotId, branchId, itemId (for backend)');
}

function testParseThaiDate() {
  const d = parseThaiDate('7/2/2569 12:00:00');
  assert.ok(d instanceof Date);
  assert.strictEqual(d.getFullYear(), 2026);
  assert.strictEqual(d.getMonth(), 1);
  assert.strictEqual(d.getDate(), 7);
  assert.strictEqual(d.getHours(), 12);
  console.log('  OK parseThaiDate: BE to CE with time');
}

function testParseThaiDate_dateOnly() {
  const d = parseThaiDate('27/1/2569');
  assert.ok(d instanceof Date);
  assert.strictEqual(d.getFullYear(), 2026);
  assert.strictEqual(d.getDate(), 27);
  console.log('  OK parseThaiDate: date only');
}

function testParseThaiDate_invalid() {
  assert.strictEqual(parseThaiDate(''), null);
  assert.strictEqual(parseThaiDate('invalid'), null);
  console.log('  OK parseThaiDate: invalid returns null');
}

function testParseThaiDate_isoFormat() {
  // GAS returns Date objects as ISO strings via .toISOString()
  const d = parseThaiDate('2026-01-14T10:30:00.000Z');
  assert.ok(d instanceof Date && !isNaN(d.getTime()), 'ISO string should parse to valid Date');
  console.log('  OK parseThaiDate: ISO format (2026-01-14T10:30:00.000Z)');
}

function testParseThaiDate_ceSpaceFormat() {
  // formatTimestamp() in GAS returns "yyyy-MM-dd HH:mm:ss" (CE, no apostrophe after GAS strips it)
  const d = parseThaiDate('2026-01-14 10:30:00');
  assert.ok(d instanceof Date && !isNaN(d.getTime()), 'CE space format should parse to valid Date');
  assert.strictEqual(d.getFullYear(), 2026);
  assert.strictEqual(d.getMonth(), 0); // January = 0
  assert.strictEqual(d.getDate(), 14);
  console.log('  OK parseThaiDate: CE space format (2026-01-14 10:30:00)');
}

function testParseThaiDate_apostrophePrefix() {
  // Sheets may return string cell with leading apostrophe preserved
  const d = parseThaiDate("'2026-01-14 10:30:00");
  assert.ok(d instanceof Date && !isNaN(d.getTime()), 'String with leading apostrophe should parse');
  assert.strictEqual(d.getFullYear(), 2026);
  console.log("  OK parseThaiDate: leading apostrophe stripped ('2026-01-14 10:30:00)");
}

// --- Run all ---
const all = [
  testFIFO_fullLot,
  testFIFO_partialLot,
  testFIFO_multipleLots,
  testFIFO_insufficient,
  testFIFO_emptyBranch,
  testFIFO_updatesHaveLotId,
  testParseThaiDate,
  testParseThaiDate_dateOnly,
  testParseThaiDate_invalid,
  testParseThaiDate_isoFormat,
  testParseThaiDate_ceSpaceFormat,
  testParseThaiDate_apostrophePrefix,
];

let passed = 0;
let failed = 0;

console.log('\n🧪 KO-Stock-System — Logic tests\n');

all.forEach((fn) => {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error('  FAIL', fn.name, e.message);
  }
});

console.log('\n' + '─'.repeat(50));
console.log(`Total: ${all.length}  Passed: ${passed}  Failed: ${failed}`);
if (failed > 0) {
  process.exit(1);
}
console.log('✅ All logic tests passed.\n');
