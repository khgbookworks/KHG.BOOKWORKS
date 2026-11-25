const OWNER_EMAIL = 'khg.bookworks@gmail.com';
const SHEETS = {
  Requests: ['Timestamp','Name','Email','Service','Genre','Word Count','Deadline','Message','Status'],
  Reviews: ['Timestamp','Name','Book Title','Service','Rating','Review','Consent','Status'],
  Projects: ['Timestamp','Name','Title','Service','Image URL','Description','Consent','Status']
};
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) sh.appendRow(SHEETS[name]);
    sh.setFrozenRows(1);
  });

  // Add approval dropdowns to every existing and future row in Reviews and Projects.
  ['Reviews', 'Projects'].forEach(name => {
    const sh = ss.getSheetByName(name);
    const statusColumn = SHEETS[name].indexOf('Status') + 1;
    const statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Pending', 'Approved', 'Rejected'], true)
      .setAllowInvalid(false)
      .build();
    sh.getRange(2, statusColumn, sh.getMaxRows() - 1, 1).setDataValidation(statusRule);
  });

  getProjectUploadFolder_(); // Creates the private upload folder and requests Drive permission.
  return 'KHG Bookworks sheets, approval dropdowns and Drive upload folder are ready.';
}
function json(data, callback) {
  const body = JSON.stringify(data);
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + body + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  const callback = e && e.parameter && e.parameter.callback;
  if (action !== 'reviews' && action !== 'projects') return json({ok:true,service:'KHG Bookworks API'}, callback);
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(action === 'reviews' ? 'Reviews' : 'Projects');
  if (!sh || sh.getLastRow() < 2) return json({ok:true,[action]:[]}, callback);
  const rows = sh.getDataRange().getDisplayValues();
  const headers = rows.shift();
  const items = rows.map(row => Object.fromEntries(headers.map((h,i)=>[headerKey(h),row[i]])))
    .filter(row => String(row.status).toLowerCase() === 'approved')
    .map(row => {
      if (action !== 'projects') return row;
      let images = [];
      const stored = row.imageUrl || row.imageUrls || '';
      try {
        const parsed = JSON.parse(stored);
        images = Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        if (stored) images = [stored];
      }
      const publicImages = images.filter(Boolean).map(value => {
        if (/^https?:\/\//i.test(value)) return value; // Existing URL-based submissions.
        try {
          const file = DriveApp.getFileById(value);
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1600';
        } catch (_) {
          return '';
        }
      }).filter(Boolean);
      return {...row, images: publicImages};
    });
  const key = action === 'reviews' ? 'reviews' : 'projects';
  return json({ok:true,[key]:items}, callback);
}
function htmlResponse(data, token) {
  const payload = JSON.stringify({kind:'khg-form-result', token:String(token || ''), ...data});
  return HtmlService.createHtmlOutput('<!doctype html><html><body><script>window.parent.postMessage(' + payload + ', "*");</script></body></html>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function doPost(e) {
  let formToken = '';
  const uploadedFiles = [];
  let rowSaved = false;
  const lock = LockService.getScriptLock();
  let lockAcquired = false;
  try {
    lock.waitLock(10000);
    lockAcquired = true;
    const raw = (e && e.parameter && e.parameter.payload) || (e && e.postData && e.postData.contents) || '{}';
    const data = JSON.parse(raw);
    formToken = data.formToken || '';
    if (data.website) return htmlResponse({ok:true,message:'Received'}, formToken);
    const type = String(data.type || '');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet, row, subject, body;
    if (type === 'request') {
      requireFields(data,['name','email','service','message']);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email))) throw new Error('Please provide a valid email address.');
      sheet = ss.getSheetByName('Requests');
      row = [new Date(),clean(data.name,100),clean(data.email,160),clean(data.service,100),clean(data.genre,100),clean(data.wordCount,20),clean(data.deadline,30),clean(data.message,3000),'New'];
      subject = 'New KHG Bookworks project request: ' + clean(data.name,100);
      body = 'A new project request was submitted.\n\nName: '+row[1]+'\nEmail: '+row[2]+'\nService: '+row[3]+'\nGenre: '+row[4]+'\nWord count: '+row[5]+'\nDeadline: '+row[6]+'\n\nMessage:\n'+row[7];
    } else if (type === 'review') {
      requireFields(data,['name','rating','review','consent']);
      sheet = ss.getSheetByName('Reviews');
      row = [new Date(),clean(data.name,100),clean(data.bookTitle,160),clean(data.service,100),Math.min(5,Math.max(1,Number(data.rating)||5)),clean(data.review,1000),String(data.consent),'Pending'];
      subject = 'New author review awaiting approval';
      body = 'A review was submitted by '+row[1]+'.\nReview: '+row[5]+'\n\nApprove or reject it in the Reviews sheet.';
    } else if (type === 'project') {
      requireFields(data,['name','title','consent']);
      const images = Array.isArray(data.images) ? data.images : [];
      if (!images.length) throw new Error('Please upload at least one project image.');
      if (images.length > 5) throw new Error('You can upload up to five images.');
      const folder = getProjectUploadFolder_();
      const imageUrls = images.map((item, index) => {
        const match = String(item.data || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
        if (!match) throw new Error('One of the images is not a supported JPG, PNG or WebP file.');
        const mime = match[1];
        const bytes = Utilities.base64Decode(match[2]);
        if (bytes.length > 3 * 1024 * 1024) throw new Error('Each image must be 3 MB or smaller after processing.');
        const filename = clean(item.name || ('project-image-' + (index + 1)), 100).replace(/[^a-zA-Z0-9._-]/g, '_');
        const file = folder.createFile(Utilities.newBlob(bytes, mime, filename || ('project-image-' + (index + 1))));
        uploadedFiles.push(file);
        return file.getId();
      });
      sheet = ss.getSheetByName('Projects');
      row = [new Date(),clean(data.name,100),clean(data.title,160),clean(data.service,100),JSON.stringify(imageUrls),clean(data.description,500),String(data.consent),'Pending'];
      subject = 'New portfolio project awaiting approval';
      body = 'A project submission was received: '+row[2]+' by '+row[1]+'.\n'+imageUrls.length+' image(s) saved to the KHG Bookworks Drive folder.\nApprove or reject it in the Projects sheet.';
    } else {
      throw new Error('Unknown submission type.');
    }
    if (!sheet) throw new Error('Sheet tabs are missing. Run setup() in Apps Script first.');
    sheet.appendRow(row);
    rowSaved = true;
    MailApp.sendEmail(OWNER_EMAIL,subject,body);
    return htmlResponse({ok:true,message:'Submission saved.'}, formToken);
  } catch (err) {
    if (!rowSaved) uploadedFiles.forEach(file => { try { file.setTrashed(true); } catch (_) {} });
    return htmlResponse({ok:false,error:String(err.message || err)}, formToken);
  } finally {
    if (lockAcquired) lock.releaseLock();
  }
}
function headerKey(label) {
  return String(label).trim().toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/ ([a-z])/g, (_,c)=>c.toUpperCase()).replace(/^[A-Z]/, c=>c.toLowerCase());
}
function requireFields(data, fields) {
  fields.forEach(key => { if (!String(data[key] || '').trim()) throw new Error('Missing required field: ' + key); });
}
function clean(value, max) {
  return String(value || '').replace(/[<>]/g,'').trim().slice(0,max);
}
function safeUrl(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (!/^https:\/\//i.test(v)) throw new Error('Image URL must begin with https://');
  return v.slice(0,1000);
}

function getProjectUploadFolder_() {
  const properties = PropertiesService.getScriptProperties();
  const savedId = properties.getProperty('KHG_PROJECT_UPLOAD_FOLDER_ID');
  if (savedId) {
    try { return DriveApp.getFolderById(savedId); } catch (_) {}
  }
  const folder = DriveApp.createFolder('KHG Bookworks Portfolio Submissions');
  properties.setProperty('KHG_PROJECT_UPLOAD_FOLDER_ID', folder.getId());
  return folder;
}
