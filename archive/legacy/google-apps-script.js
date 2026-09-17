// ============================================================
// EDGE WEBSITES — Google Apps Script
// ============================================================
// SETUP (one time, takes ~3 minutes):
//
// 1. Go to: https://script.google.com
// 2. Click "New project"
// 3. Delete the default code and paste ALL of this file
// 4. Click Save (Ctrl+S)
// 5. Click "Deploy" → "New deployment"
//    - Type: Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 6. Click Deploy → copy the Web App URL
// 7. Paste that URL into Vercel env vars as: GOOGLE_SCRIPT_URL
//
// SHEET SETUP:
// - The script auto-creates a "Customers" sheet on first run
// - Columns: Email | PasswordHash | Plan | Amount | StripeID | CreatedAt | Status
// ============================================================

const SHEET_NAME = 'Customers';

// Column positions (1-indexed)
const COL = {
  EMAIL:         1,
  PASSWORD_HASH: 2,
  PLAN:          3,
  AMOUNT:        4,
  CUSTOMER_ID:   5,
  CREATED_AT:    6,
  STATUS:        7,
};

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['Email', 'PasswordHash', 'Plan', 'Amount', 'StripeCustomerID', 'CreatedAt', 'Status']);
    sheet.setFrozenRows(1);
    // Style the header row
    const header = sheet.getRange(1, 1, 1, 7);
    header.setBackground('#1a2a3a');
    header.setFontColor('#00ff88');
    header.setFontWeight('bold');
  }
  return sheet;
}

// Handle GET requests (getUser)
function doGet(e) {
  const action = e.parameter.action;

  if (action === 'getUser') {
    const email = (e.parameter.email || '').trim().toLowerCase();
    const user = findUser(email);
    if (user) {
      return jsonResponse({ found: true, user });
    }
    return jsonResponse({ found: false });
  }

  return jsonResponse({ error: 'Unknown action' });
}

// Handle POST requests (addCustomer)
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'addCustomer') {
      const email = (data.email || '').trim().toLowerCase();
      if (!email) return jsonResponse({ error: 'Email required' });

      // Check if already exists — update if so, add if not
      const existing = findUserRow(email);
      const sheet = getSheet();

      const row = [
        email,
        data.passwordHash || '',
        data.plan || '',
        data.amount || '',
        data.customerId || '',
        data.createdAt || new Date().toISOString(),
        data.status || 'active',
      ];

      if (existing) {
        // Update existing row (keep password if not provided)
        const existingRow = sheet.getRange(existing, 1, 1, 7).getValues()[0];
        row[COL.PASSWORD_HASH - 1] = data.passwordHash || existingRow[COL.PASSWORD_HASH - 1];
        sheet.getRange(existing, 1, 1, 7).setValues([row]);
        return jsonResponse({ success: true, action: 'updated' });
      } else {
        sheet.appendRow(row);
        return jsonResponse({ success: true, action: 'created' });
      }
    }

    if (action === 'updatePassword') {
      const email = (data.email || '').trim().toLowerCase();
      const rowIndex = findUserRow(email);
      if (!rowIndex) return jsonResponse({ error: 'User not found' });

      const sheet = getSheet();
      sheet.getRange(rowIndex, COL.PASSWORD_HASH).setValue(data.passwordHash);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// Find a user row by email, return the row data
function findUser(email) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if ((data[i][COL.EMAIL - 1] || '').toLowerCase() === email) {
      return {
        email:        data[i][COL.EMAIL - 1],
        passwordHash: data[i][COL.PASSWORD_HASH - 1],
        plan:         data[i][COL.PLAN - 1],
        amount:       data[i][COL.AMOUNT - 1],
        customerId:   data[i][COL.CUSTOMER_ID - 1],
        createdAt:    data[i][COL.CREATED_AT - 1],
        status:       data[i][COL.STATUS - 1],
      };
    }
  }
  return null;
}

// Find row index of a user (1-indexed, accounts for header)
function findUserRow(email) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if ((data[i][COL.EMAIL - 1] || '').toLowerCase() === email) {
      return i + 1; // +1 because sheet rows are 1-indexed
    }
  }
  return null;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
