// ============================================
// CONSTANTS - Google Sheets names
// ============================================
const SHEET_NAME = 'Users'; // Sheet for user registration data
const ITEMS_SHEET_NAME = 'Items'; // Sheet for item stock
const ORDERS_PENDING_SHEET = 'Orders - Pending'; // Pending stock requests
const ORDERS_APPROVED_SHEET = 'Orders - Approved'; // Approved requests
const ORDERS_REJECTED_SHEET = 'Orders - Rejected'; // Rejected requests

// ============================================
// MAIN HANDLER - GET REQUESTS
// Routes client requests to appropriate handler function
// ============================================
function doGet(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    const action = e.parameter.action; // Get action type from request
    
    // User registration route
    if (action === 'register') {
      const name = e.parameter.name;
      const email = e.parameter.email;
      const password = e.parameter.password;
      const securityQuestion = e.parameter.securityQuestion;
      const securityAnswer = e.parameter.securityAnswer;
      const hint = e.parameter.hint;
      return handleRegister(name, email, password, securityQuestion, securityAnswer, hint);
    }
    
    // User login
    if (action === 'login') {
      const email = e.parameter.email;
      const password = e.parameter.password;
      return handleLogin(email, password);
    }
    
    // Get all items/stock
    if (action === 'getItems') {
      return handleGetItems();
    }
    
    // Get all registered users
    if (action === 'getUsers') {
      return handleGetUsers();
    }
    
    // Find specific user by email
    if (action === 'findUser') {
      const email = e.parameter.email;
      return handleFindUser(email);
    }
    
    // Get teacher stock requests
    if (action === 'getTeacherStockRequests') {
      return handleGetTeacherStockRequests();
    }
    
    // Request stock (create new order)
    if (action === 'requestStock') {
      const teacherEmail = e.parameter.teacherEmail;
      const teacherName = e.parameter.teacherName;
      const item = e.parameter.item;
      const qty = e.parameter.qty;
      return handleRequestStock(teacherEmail, teacherName, item, qty);
    }
    
    if (action === 'addItem') {
      const name = e.parameter.name;
      const stock = e.parameter.stock;
      return handleAddItem(name, stock);
    }
    
    if (action === 'updateItem') {
      const name = e.parameter.name;
      const stock = e.parameter.stock;
      return handleUpdateItem(name, stock);
    }
    
    if (action === 'deleteItem') {
      const name = e.parameter.name;
      return handleDeleteItem(name);
    }
    
    if (action === 'deleteUser') {
      const email = e.parameter.email;
      return handleDeleteUser(email);
    }
    
    if (action === 'updateRequestStatus') {
      const email = e.parameter.email;
      const item = e.parameter.item;
      const status = e.parameter.status;
      const reason = e.parameter.reason;
      return handleUpdateRequestStatus(email, item, status, reason);
    }
    
    if (action === 'getRejectionReason') {
      const email = e.parameter.email;
      const item = e.parameter.item;
      return handleGetRejectionReason(email, item);
    }
    
    if (action === 'resetPassword') {
      const email = e.parameter.email;
      const newPassword = e.parameter.newPassword;
      return handleResetPassword(email, newPassword);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Invalid action'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Fungsi untuk handle POST request (untuk register)
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    if (action === 'register') {
      return handleRegister(data.name, data.email, data.password, data.securityQuestion, data.securityAnswer, data.hint);
    }
    
    if (action === 'addItem') {
      return handleAddItem(data.name, data.stock);
    }
    
    if (action === 'updateItem') {
      return handleUpdateItem(data.name, data.stock);
    }
    
    if (action === 'deleteItem') {
      return handleDeleteItem(data.name);
    }
    
    if (action === 'requestStock') {
      return handleRequestStock(data.teacherEmail, data.teacherName, data.item, data.qty);
    }

    // Support resetPassword via POST so clients can use sendBeacon/keepalive POST during navigation
    if (action === 'resetPassword') {
      return handleResetPassword(data.email, data.newPassword);
    }
    
    if (action === 'deleteOrder') {
      return handleDeleteOrder(data.email, data.item, data.date);
    }
    
    if (action === 'deleteUser') {
      return handleDeleteUser(data.email);
    }
    
    if (action === 'deleteAllOrders') {
      return handleDeleteAllOrders();
    }
    
    if (action === 'getUsers') {
      return handleGetUsers();
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Invalid action'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Fungsi untuk initialize sheet
function initializeSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Header: Nama, Email, Password, Tarikh Daftar, Hint Word
    sheet.appendRow(['Nama', 'Email', 'Password', 'Tarikh Daftar', 'Hint Word']);
  }
  
  return sheet;
}

// Fungsi untuk register user baru
function handleRegister(name, email, password, securityQuestion, securityAnswer, hint) {
  try {
    // Validation
    if (!name || !email || !password) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Nama, email, dan password diperlukan'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const sheet = initializeSheet();
    
    // Check jika email sudah wujud (case-insensitive)
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) { // Skip header row
      const existingEmail = (data[i][1] || '').toString().trim().toLowerCase();
      const checkEmail = email.toString().trim().toLowerCase();
      
      if (existingEmail === checkEmail) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: 'Email sudah digunakan'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // Tambah user baru dengan hint word sahaja
    const timestamp = new Date().toLocaleString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur' });
    sheet.appendRow([
      name.trim(), 
      email.trim(), 
      password, 
      timestamp,
      hint || ''
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Pendaftaran berjaya'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Register Error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Ralat: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Fungsi untuk login user
function handleLogin(email, password) {
  try {
    const sheet = initializeSheet();
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Tiada data pengguna. Sila daftar akaun dahulu.'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Cari user (case-insensitive untuk email)
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) { // Skip header row
      const sheetEmail = (data[i][1] || '').toString().trim().toLowerCase();
      const sheetPassword = (data[i][2] || '').toString();
      const checkEmail = email.toString().trim().toLowerCase();
      const checkPassword = password.toString();
      
      Logger.log('Checking row ' + i + ': ' + sheetEmail + ' vs ' + checkEmail);
      
      if (sheetEmail === checkEmail && sheetPassword === checkPassword) {
        Logger.log('Login Success for: ' + checkEmail);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: 'Login berjaya',
          user: {
            name: data[i][0],
            email: data[i][1]
          }
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    Logger.log('Login Failed for: ' + email);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Email atau kata laluan salah'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Login Error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Ralat: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================
// STOCK MANAGEMENT FUNCTIONS
// ============================================

// Fungsi untuk initialize Items sheet
function initializeItemsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ITEMS_SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(ITEMS_SHEET_NAME);
    // Tambah header
    sheet.appendRow(['Nama Barang', 'Stok', 'Tarikh Update']);
  }
  
  return sheet;
}

// Fungsi untuk get semua items
function handleGetItems() {
  try {
    const sheet = initializeItemsSheet();
    const data = sheet.getDataRange().getValues();
    
    const items = [];
    for (let i = 1; i < data.length; i++) { // Skip header row
      if (data[i][0]) { // Check jika ada nama barang
        items.push({
          name: data[i][0],
          stock: parseInt(data[i][1]) || 0
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      items: items
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('GetItems Error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Ralat: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Fungsi untuk add item baru
function handleAddItem(name, stock) {
  try {
    if (!name || stock === undefined) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Nama dan stok diperlukan'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const sheet = initializeItemsSheet();
    const data = sheet.getDataRange().getValues();
    
    // Check jika item sudah wujud
    for (let i = 1; i < data.length; i++) {
      const existingName = (data[i][0] || '').toString().trim().toLowerCase();
      const checkName = name.toString().trim().toLowerCase();
      
      if (existingName === checkName) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: 'Barang sudah wujud'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // Tambah item baru
    const timestamp = new Date().toLocaleString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur' });
    sheet.appendRow([name.trim(), parseInt(stock) || 0, timestamp]);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Barang berjaya ditambah'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('AddItem Error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Ralat: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Fungsi untuk update stok item
function handleUpdateItem(name, stock) {
  try {
    if (!name || stock === undefined) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Nama dan stok diperlukan'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const sheet = initializeItemsSheet();
    const data = sheet.getDataRange().getValues();
    
    // Cari item dan update
    for (let i = 1; i < data.length; i++) {
      const existingName = (data[i][0] || '').toString().trim().toLowerCase();
      const checkName = name.toString().trim().toLowerCase();
      
      if (existingName === checkName) {
        const range = sheet.getRange(i + 1, 2); // Column B (Stok)
        range.setValue(parseInt(stock) || 0);
        
        const dateRange = sheet.getRange(i + 1, 3); // Column C (Tarikh Update)
        const timestamp = new Date().toLocaleString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur' });
        dateRange.setValue(timestamp);
        
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: 'Stok berjaya dikemaskini'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Barang tidak dijumpai'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('UpdateItem Error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Ralat: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================
// TEACHER STOCK REQUEST FUNCTIONS
// ============================================

// Fungsi untuk initialize Orders sheets (3 sheets untuk pending, approved, rejected)
function initializeOrdersSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Initialize Pending sheet
  let pendingSheet = ss.getSheetByName(ORDERS_PENDING_SHEET);
  if (!pendingSheet) {
    pendingSheet = ss.insertSheet(ORDERS_PENDING_SHEET);
    pendingSheet.appendRow(['Nama Staff', 'Email Staff', 'Barang', 'Qty', 'Tarikh Request']);
  }
  
  // Initialize Approved sheet
  let approvedSheet = ss.getSheetByName(ORDERS_APPROVED_SHEET);
  if (!approvedSheet) {
    approvedSheet = ss.insertSheet(ORDERS_APPROVED_SHEET);
    approvedSheet.appendRow(['Nama Staff', 'Email Staff', 'Barang', 'Qty', 'Tarikh Request', 'Tarikh Approved']);
  }
  
  // Initialize Rejected sheet
  let rejectedSheet = ss.getSheetByName(ORDERS_REJECTED_SHEET);
  if (!rejectedSheet) {
    rejectedSheet = ss.insertSheet(ORDERS_REJECTED_SHEET);
    rejectedSheet.appendRow(['Nama Staff', 'Email Staff', 'Barang', 'Qty', 'Tarikh Request', 'Tarikh Rejected', 'Alasan Penolakan']);
  } else {
    // Check if sheet has Alasan Penolakan column (fix for existing sheets)
    const lastCol = rejectedSheet.getLastColumn();
    Logger.log('Rejected sheet has ' + lastCol + ' columns');
    if (lastCol < 7) {
      Logger.log('Adding missing columns to Rejected sheet (current: ' + lastCol + ', needed: 7)');
      rejectedSheet.insertColumns(lastCol + 1, 7 - lastCol);
      rejectedSheet.getRange(1, 7).setValue('Alasan Penolakan');
      Logger.log('Added column 7 with header: Alasan Penolakan');
    } else {
      const headers = rejectedSheet.getRange(1, 1, 1, 7).getValues()[0];
      if (!headers[6] || headers[6] !== 'Alasan Penolakan') {
        Logger.log('Column 7 exists but has wrong header: "' + headers[6] + '". Fixing...');
        rejectedSheet.getRange(1, 7).setValue('Alasan Penolakan');
        Logger.log('Fixed column 7 header to: Alasan Penolakan');
      }
    }
  }
  
  return { pending: pendingSheet, approved: approvedSheet, rejected: rejectedSheet };
}

// Fungsi untuk request stock (add to Pending sheet)
function handleRequestStock(teacherEmail, teacherName, item, qty) {
  try {
    if (!teacherEmail || !teacherName || !item || !qty) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Semua field diperlukan'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const sheets = initializeOrdersSheets();
    const timestamp = new Date().toLocaleString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur' });
    
    // Tambah request baru ke Pending sheet
    sheets.pending.appendRow([teacherName.trim(), teacherEmail.trim(), item.trim(), parseInt(qty) || 0, timestamp]);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Request berjaya dihantar'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('RequestStock Error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Ralat: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Fungsi untuk get semua orders dari 3 sheets
function handleGetTeacherStockRequests() {
  try {
    const sheets = initializeOrdersSheets();
    const requests = [];
    
    // Get Pending orders
    const pendingData = sheets.pending.getDataRange().getValues();
    for (let i = 1; i < pendingData.length; i++) {
      if (pendingData[i][0]) {
        requests.push({
          teacherName: pendingData[i][0],
          email: pendingData[i][1],
          item: pendingData[i][2],
          qty: parseInt(pendingData[i][3]) || 0,
          status: 'pending',
          date: pendingData[i][4]
        });
      }
    }
    
    // Get Approved orders
    const approvedData = sheets.approved.getDataRange().getValues();
    for (let i = 1; i < approvedData.length; i++) {
      if (approvedData[i][0]) {
        requests.push({
          teacherName: approvedData[i][0],
          email: approvedData[i][1],
          item: approvedData[i][2],
          qty: parseInt(approvedData[i][3]) || 0,
          status: 'approved',
          date: approvedData[i][4],
          approvedDate: approvedData[i][5]
        });
      }
    }
    
    // Get Rejected orders
    const rejectedData = sheets.rejected.getDataRange().getValues();
    for (let i = 1; i < rejectedData.length; i++) {
      if (rejectedData[i][0]) {
        requests.push({
          teacherName: rejectedData[i][0],
          email: rejectedData[i][1],
          item: rejectedData[i][2],
          qty: parseInt(rejectedData[i][3]) || 0,
          status: 'rejected',
          date: rejectedData[i][4],
          rejectedDate: rejectedData[i][5]
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      requests: requests
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('GetTeacherStockRequests Error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Ralat: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Fungsi untuk update status request (move between sheets)
function handleUpdateRequestStatus(email, item, status, reason) {
  reason = reason || '';
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    if (!email || !item || !status) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Email, item, dan status diperlukan'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const sheets = initializeOrdersSheets();
    const checkEmail = email.toString().trim().toLowerCase();
    const checkItem = item.toString().trim().toLowerCase();
    const timestamp = new Date().toLocaleString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur' });
    
    Logger.log('=== UPDATE REQUEST STATUS START ===');
    Logger.log('Email: ' + email + ', Item: ' + item + ', Status: ' + status + ', Reason: ' + reason);
    
    // Move from Pending to Approved/Rejected
    if (status === 'approved' || status === 'rejected') {
      Logger.log('Searching in Pending sheet for: ' + email + ' / ' + item);
      const pendingData = sheets.pending.getDataRange().getValues();
      
      for (let i = 1; i < pendingData.length; i++) {
        const rowEmail = (pendingData[i][1] || '').toString().trim().toLowerCase();
        const rowItem = (pendingData[i][2] || '').toString().trim().toLowerCase();
        
        if (rowEmail === checkEmail && rowItem === checkItem) {
          Logger.log('Found order at row ' + (i + 1) + ' in Pending sheet');
          
          const teacherName = pendingData[i][0];
          const qty = pendingData[i][3];
          const requestDate = pendingData[i][4];
          
          // Append to target sheet FIRST
          if (status === 'approved') {
            sheets.approved.appendRow([teacherName, email, item, qty, requestDate, timestamp]);
            Logger.log('Added to Approved sheet');
          } else {
            // For rejection, include the reason
            Logger.log('Appending to Rejected sheet - Row: [' + teacherName + ', ' + email + ', ' + item + ', ' + qty + ', ' + requestDate + ', ' + timestamp + ', ' + reason + ']');
            sheets.rejected.appendRow([teacherName, email, item, qty, requestDate, timestamp, reason]);
            Logger.log('Added to Rejected sheet with reason: ' + reason);
            
            // Verify it was added
            const rejectedData = sheets.rejected.getDataRange().getValues();
            const lastRow = rejectedData[rejectedData.length - 1];
            Logger.log('Verification - Last row in Rejected sheet: ' + JSON.stringify(lastRow));
            Logger.log('Column 7 value (reason): ' + lastRow[6]);
          }
          
          // Then delete from Pending
          sheets.pending.deleteRow(i + 1);
          Logger.log('Deleted row ' + (i + 1) + ' from Pending sheet');
          
          Logger.log('=== UPDATE REQUEST STATUS SUCCESS ===');
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: 'Status diubah ke ' + status
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      
      Logger.log('Order tidak dijumpai dalam Pending sheet');
    }
    
    // Move from Approved/Rejected back to Pending
    if (status === 'pending') {
      // Try Approved sheet first
      Logger.log('Searching in Approved sheet for: ' + email + ' / ' + item);
      const approvedData = sheets.approved.getDataRange().getValues();
      
      for (let i = 1; i < approvedData.length; i++) {
        const rowEmail = (approvedData[i][1] || '').toString().trim().toLowerCase();
        const rowItem = (approvedData[i][2] || '').toString().trim().toLowerCase();
        
        if (rowEmail === checkEmail && rowItem === checkItem) {
          Logger.log('Found order at row ' + (i + 1) + ' in Approved sheet');
          
          const teacherName = approvedData[i][0];
          const qty = approvedData[i][3];
          const requestDate = approvedData[i][4];
          
          // Add to Pending
          sheets.pending.appendRow([teacherName, email, item, qty, requestDate]);
          Logger.log('Added to Pending sheet');
          
          // Delete from Approved
          sheets.approved.deleteRow(i + 1);
          Logger.log('Deleted row ' + (i + 1) + ' from Approved sheet');
          
          Logger.log('=== UNDO APPROVED SUCCESS ===');
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: 'Order dikembalikan ke Pending'
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      
      // Try Rejected sheet
      Logger.log('Searching in Rejected sheet for: ' + email + ' / ' + item);
      const rejectedData = sheets.rejected.getDataRange().getValues();
      
      for (let i = 1; i < rejectedData.length; i++) {
        const rowEmail = (rejectedData[i][1] || '').toString().trim().toLowerCase();
        const rowItem = (rejectedData[i][2] || '').toString().trim().toLowerCase();
        
        if (rowEmail === checkEmail && rowItem === checkItem) {
          Logger.log('Found order at row ' + (i + 1) + ' in Rejected sheet');
          
          const teacherName = rejectedData[i][0];
          const qty = rejectedData[i][3];
          const requestDate = rejectedData[i][4];
          
          // Add to Pending
          sheets.pending.appendRow([teacherName, email, item, qty, requestDate]);
          Logger.log('Added to Pending sheet');
          
          // Delete from Rejected
          sheets.rejected.deleteRow(i + 1);
          Logger.log('Deleted row ' + (i + 1) + ' from Rejected sheet');
          
          Logger.log('=== UNDO REJECTED SUCCESS ===');
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: 'Order dikembalikan ke Pending'
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      
      Logger.log('Order tidak dijumpai dalam Approved atau Rejected sheet');
    }
    
    // Not found
    Logger.log('=== ORDER NOT FOUND ===');
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Order tidak dijumpai'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Ralat: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Function to get rejection reason for a rejected order
function handleGetRejectionReason(email, item) {
  try {
    if (!email || !item) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        reason: null
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const sheets = initializeOrdersSheets();
    const checkEmail = email.toString().trim().toLowerCase();
    const checkItem = item.toString().trim().toLowerCase();
    
    // Search in Rejected sheet
    const rejectedData = sheets.rejected.getDataRange().getValues();
    
    for (let i = 1; i < rejectedData.length; i++) {
      const rowEmail = (rejectedData[i][1] || '').toString().trim().toLowerCase();
      const rowItem = (rejectedData[i][2] || '').toString().trim().toLowerCase();
      
      if (rowEmail === checkEmail && rowItem === checkItem) {
        const reason = rejectedData[i][6] || ''; // Column 7 (index 6)
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          reason: reason
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      reason: null
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('ERROR getRejectionReason: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      reason: null
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Fungsi untuk delete order dari Pending sheet
function handleDeleteOrder(email, item, date) {
  try {
    if (!email || !item) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Email dan item diperlukan'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const sheets = initializeOrdersSheets();
    const checkEmail = email.toString().trim().toLowerCase();
    const checkItem = item.toString().trim().toLowerCase();
    const checkDate = date ? date.toString().trim() : null;
    
    let deletedCount = 0;
    let deleteAll = !checkDate || checkDate === 'null' || checkDate === '';
    
    // Cari di Pending sheet - delete from bottom to top untuk elak index issue
    const pendingData = sheets.pending.getDataRange().getValues();
    Logger.log('DeleteOrder: Looking for email=' + checkEmail + ', item=' + checkItem + ', date=' + checkDate + ', deleteAll=' + deleteAll);
    
    for (let i = pendingData.length - 1; i >= 1; i--) {
      const sheetEmail = (pendingData[i][1] || '').toString().trim().toLowerCase();
      const sheetItem = (pendingData[i][2] || '').toString().trim().toLowerCase();
      const sheetDate = (pendingData[i][4] || '').toString().trim();
      
      // Match email dan item
      const emailMatch = sheetEmail === checkEmail;
      const itemMatch = sheetItem === checkItem;
      
      if (emailMatch && itemMatch) {
        Logger.log('DELETING row ' + (i + 1) + ': ' + sheetEmail + ' | ' + sheetItem + ' | ' + sheetDate);
        sheets.pending.deleteRow(i + 1);
        deletedCount++;
        
        // Kalau bukan delete all, break selepas delete first match
        if (!deleteAll) {
          break;
        }
      }
    }
    
    if (deletedCount > 0) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Order berjaya dipadamkan (' + deletedCount + ' baris)'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Order tidak dijumpai'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('DeleteOrder Error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Ralat: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Fungsi untuk delete item
function handleDeleteItem(name) {
  try {
    if (!name) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Nama barang diperlukan'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const sheet = initializeItemsSheet();
    const data = sheet.getDataRange().getValues();
    
    // Cari item dan delete
    for (let i = 1; i < data.length; i++) {
      const sheetName = (data[i][0] || '').toString().trim().toLowerCase();
      const checkName = name.toString().trim().toLowerCase();
      
      if (sheetName === checkName) {
        // Delete row (i+1 kerana getDataRange() mulai dari row 1)
        sheet.deleteRow(i + 1);
        
        Logger.log('Deleted item: ' + name);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: 'Barang berjaya dipadamkan'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Barang tidak dijumpai'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('DeleteItem Error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Ralat: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================
// USER MANAGEMENT FUNCTIONS
// ============================================

// Fungsi untuk get semua users
function handleGetUsers() {
  const start = new Date().getTime();
  Logger.log('GetUsers start: ' + new Date().toISOString());
  try {
    const sheet = initializeSheet();
    const data = sheet.getDataRange().getValues();
    
    const users = [];
    for (let i = 1; i < data.length; i++) { // Skip header row
      if (data[i][0]) { // Check jika ada nama
        users.push({
          name: data[i][0],
          email: data[i][1],
          registrationDate: data[i][3],
          securityQuestion: data[i][4] || '',
          securityAnswer: data[i][5] || '',
          hint: data[i][6] || ''
        });
      }
    }
    
    Logger.log('GetUsers end (ms): ' + (new Date().getTime() - start));
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      users: users
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('GetUsers Error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Ralat: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Fast lookup: find single user by email (returns small payload)
function handleFindUser(email) {
  const start = new Date().getTime();
  Logger.log('FindUser start for: [' + email + '] at ' + new Date().toISOString());
  try {
    if (!email) {
      Logger.log('FindUser: Email parameter kosong');
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Email diperlukan' })).setMimeType(ContentService.MimeType.JSON);
    }
    const sheet = initializeSheet();
    const lastRow = sheet.getLastRow();
    Logger.log('FindUser: Total rows in sheet: ' + lastRow);
    
    if (lastRow < 2) {
      Logger.log('FindUser: Sheet kosong atau hanya header');
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Pengguna tidak dijumpai' })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues(); // read only 5 necessary columns (A-E)
    const checkEmail = String(email).trim().toLowerCase();
    Logger.log('FindUser: Searching for email: [' + checkEmail + '] in ' + data.length + ' rows');
    Logger.log('FindUser: Sheet columns structure: [0]=Name, [1]=Email, [2]=Password, [3]=RegDate, [4]=Hint');
    
    for (let i = 0; i < data.length; i++) {
      const sheetEmail = (data[i][1] || '').toString().trim().toLowerCase();
      Logger.log('FindUser: Row ' + (i+2) + ' - Sheet email: [' + sheetEmail + ']');
      
      if (sheetEmail === checkEmail) {
        const user = { 
          name: data[i][0], 
          email: data[i][1], 
          hint: data[i][4] || '',  // Column E (index 4) = Hint Word
          registered_date: data[i][3] || ''  // Column D (index 3) = Tarikh Daftar
        };
        Logger.log('FindUser SUCCESS: Found user - Name: ' + user.name + ', Email: ' + user.email + ', Hint: [' + user.hint + ']');
        Logger.log('FindUser completed in ' + (new Date().getTime() - start) + 'ms');
        return ContentService.createTextOutput(JSON.stringify({ success: true, user: user })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    Logger.log('FindUser NOT FOUND: Email [' + checkEmail + '] tidak ada dalam ' + data.length + ' records');
    Logger.log('FindUser completed in ' + (new Date().getTime() - start) + 'ms');
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Pengguna tidak dijumpai' })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('FindUser ERROR: ' + error.toString() + ' | Stack: ' + error.stack);
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Ralat: ' + error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Fungsi untuk delete user
function handleDeleteUser(email) {
  try {
    if (!email) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Email diperlukan'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const sheet = initializeSheet();
    const data = sheet.getDataRange().getValues();
    
    // Cari user dan delete
    for (let i = 1; i < data.length; i++) {
      const sheetEmail = (data[i][1] || '').toString().trim().toLowerCase();
      const checkEmail = email.toString().trim().toLowerCase();
      
      if (sheetEmail === checkEmail) {
        // Delete row (i+1 kerana getDataRange() mulai dari row 1)
        sheet.deleteRow(i + 1);
        
        Logger.log('Deleted user: ' + email);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: 'Pengguna berjaya dipadam'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Pengguna tidak dijumpai'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('DeleteUser Error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Ralat: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Fungsi untuk reset password user
function handleResetPassword(email, newPassword) {
  const start = new Date().getTime();
  Logger.log('ResetPassword start for: [' + email + '] at ' + new Date().toISOString());
  try {
    if (!email || !newPassword) {
      Logger.log('ResetPassword: Missing email or password parameter');
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Email dan password baru diperlukan'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const sheet = initializeSheet();
    const data = sheet.getDataRange().getValues();
    Logger.log('ResetPassword: Total rows: ' + data.length);
    
    // Cari user dan update password (column 3)
    const checkEmail = email.toString().trim().toLowerCase();
    Logger.log('ResetPassword: Searching for email: [' + checkEmail + ']');
    
    for (let i = 1; i < data.length; i++) {
      const sheetEmail = (data[i][1] || '').toString().trim().toLowerCase();
      Logger.log('ResetPassword: Row ' + (i+1) + ' - Email: [' + sheetEmail + ']');
      
      if (sheetEmail === checkEmail) {
        try {
          sheet.getRange(i + 1, 3).setValue(newPassword); // Column C = Password
          Logger.log('ResetPassword SUCCESS: Password updated for [' + email + ']');
          Logger.log('ResetPassword completed in ' + (new Date().getTime() - start) + 'ms');
          
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: 'Password berjaya ditukar'
          })).setMimeType(ContentService.MimeType.JSON);
        } catch (updateError) {
          Logger.log('ResetPassword UPDATE ERROR: ' + updateError.toString());
          return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: 'Ralat mengemas kini password: ' + updateError.toString()
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }
    
    Logger.log('ResetPassword NOT FOUND: Email [' + checkEmail + '] tidak dijumpai dalam ' + (data.length - 1) + ' users');
    Logger.log('ResetPassword completed in ' + (new Date().getTime() - start) + 'ms');
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Pengguna tidak dijumpai'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('ResetPassword ERROR: ' + error.toString() + ' | Stack: ' + error.stack);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Ralat sistem: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Fungsi untuk delete semua orders dari 3 sheets
function handleDeleteAllOrders() {
  const start = new Date().getTime();
  Logger.log('DeleteAllOrders start at ' + new Date().toISOString());
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    const sheets = initializeOrdersSheets();
    let deletedCount = 0;
    
    // Delete semua rows dari Pending (mulai dari belakang untuk avoid index shift)
    let pendingData = sheets.pending.getDataRange().getValues();
    for (let i = pendingData.length - 1; i >= 1; i--) {
      if (pendingData[i][0]) { // Ada data
        sheets.pending.deleteRow(i + 1);
        deletedCount++;
      }
    }
    Logger.log('Deleted ' + deletedCount + ' rows from Pending sheet');
    
    // Delete semua rows dari Approved
    let approvedData = sheets.approved.getDataRange().getValues();
    for (let i = approvedData.length - 1; i >= 1; i--) {
      if (approvedData[i][0]) { // Ada data
        sheets.approved.deleteRow(i + 1);
        deletedCount++;
      }
    }
    Logger.log('Deleted rows from Approved sheet');
    
    // Delete semua rows dari Rejected
    let rejectedData = sheets.rejected.getDataRange().getValues();
    for (let i = rejectedData.length - 1; i >= 1; i--) {
      if (rejectedData[i][0]) { // Ada data
        sheets.rejected.deleteRow(i + 1);
        deletedCount++;
      }
    }
    Logger.log('Deleted rows from Rejected sheet');
    
    Logger.log('Total orders deleted: ' + deletedCount);
    Logger.log('DeleteAllOrders end (ms): ' + (new Date().getTime() - start));
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Semua orders berjaya dipadamkan (' + deletedCount + ' orders)'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('DeleteAllOrders Error: ' + error.toString());
    Logger.log('DeleteAllOrders error after (ms): ' + (new Date().getTime() - start));
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Ralat: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
