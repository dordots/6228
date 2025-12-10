const functions = require("firebase-functions");
const admin = require("firebase-admin");
const PDFDocument = require("pdfkit");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const sgMail = require("@sendgrid/mail");
const path = require("path");
const fs = require("fs");

const db = admin.firestore();

// Initialize SendGrid if configured
const sendGridApiKey = functions.config().sendgrid?.api_key;
if (sendGridApiKey) {
  sgMail.setApiKey(sendGridApiKey);
}

const logger = functions.logger || console;

const DEFAULT_FONT_PATH = path.join(__dirname, "../assets/fonts/NotoSansHebrew-Regular.ttf");

const applyDefaultFont = (doc) => {
  try {
    if (fs.existsSync(DEFAULT_FONT_PATH)) {
      doc.registerFont("ArmoryPrimary", DEFAULT_FONT_PATH);
      doc.font("ArmoryPrimary");
    } else {
      logger.warn?.("Default PDF font not found at path:", DEFAULT_FONT_PATH);
    }
  } catch (error) {
    logger.warn?.("Failed to register default font for PDF generation, falling back to standard font.", error);
  }
};

const getItemIdentifier = (item = {}) =>
  item.fieldId ||
  item.displayId ||
  item.id ||
  item.serial_number ||
  item.serialNumber ||
  item.serial ||
  item.weapon_id ||
  item.gear_id ||
  item.set_serial_number ||
  item.equipment_id ||
  item.drone_set_id ||
  "";

const formatAssignmentItemRow = (item, index, allCurrentItems = []) => {
  const identifier = getItemIdentifier(item);
  const fallback = allCurrentItems.find((entry) => entry.id === identifier) || {};

  const resolvedType = item.type || item.itemType || fallback.type || "";
  const resolvedName = item.name || item.displayName || fallback.name || "";
  const resolvedId = identifier || fallback.id || "";
  const resolvedStatus = item.status || fallback.status || "Assigned";
  const resolvedComponents = item.components && item.components.length > 0
    ? item.components
    : fallback.components || [];

  const mainRow = `<tr>
    <td>${index + 1}</td>
    <td>${resolvedType}</td>
    <td>${resolvedName}</td>
    <td>${resolvedId}</td>
    <td>${resolvedStatus}</td>
  </tr>`;

  if (
    (resolvedType === "Drone" || resolvedType === "Drone Set") &&
    resolvedComponents.length > 0
  ) {
    const componentRows = resolvedComponents
      .map(
        (comp) => `<tr style="background-color: #f9f9f9;">
          <td></td>
          <td colspan="2" style="padding-right: 30px;">↳ ${comp.type || ""}</td>
          <td>${comp.id || ""}</td>
          <td></td>
        </tr>`
      )
      .join("");
    return mainRow + componentRows;
  }

  return mainRow;
};

const generateAssignmentFormDocument = async ({
  soldierID,
  assignedItems = [],
  performerName = "System",
  signatureData = "",
  soldierData = null,
}) => {
  if (!soldierID) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Soldier ID is required"
    );
  }

  let soldier = soldierData;
  if (!soldier) {
    const soldierDoc = await db.collection("soldiers").doc(soldierID).get();
    if (!soldierDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Soldier not found"
      );
    }
    soldier = soldierDoc.data();
  }

  const safeAssignedItems = Array.isArray(assignedItems) ? assignedItems : [];

  const [weapons, gear, drones, equipment] = await Promise.all([
    db.collection("weapons").where("assigned_to", "==", soldierID).get(),
    db.collection("serialized_gear").where("assigned_to", "==", soldierID).get(),
    db.collection("drone_sets").where("assigned_to", "==", soldierID).get(),
    db.collection("equipment").where("assigned_to", "==", soldierID).get(),
  ]);

  const droneSetIds = drones.docs.map((doc) => doc.data().drone_set_id).filter(Boolean);
  let droneComponents = [];
  if (droneSetIds.length > 0) {
    const componentPromises = [];
    for (let i = 0; i < droneSetIds.length; i += 10) {
      const batch = droneSetIds.slice(i, i + 10);
      componentPromises.push(
        db.collection("drone_components").where("drone_set_id", "in", batch).get()
      );
    }
    const componentSnapshots = await Promise.all(componentPromises);
    droneComponents = componentSnapshots.flatMap((snapshot) => snapshot.docs);
  }

  const componentsByDroneSet = {};
  droneComponents.forEach((doc) => {
    const comp = doc.data();
    if (!componentsByDroneSet[comp.drone_set_id]) {
      componentsByDroneSet[comp.drone_set_id] = [];
    }
    componentsByDroneSet[comp.drone_set_id].push({
      type: comp.component_type,
      id: comp.component_id,
    });
  });

  const allCurrentItems = [];
  weapons.docs.forEach((doc) => {
    const data = doc.data();
    allCurrentItems.push({
      type: "Weapon",
      name: data.weapon_type || data.weapon_name,
      id: data.weapon_id,
      status: data.armory_status || "assigned",
    });
  });
  gear.docs.forEach((doc) => {
    const data = doc.data();
    allCurrentItems.push({
      type: "Gear",
      name: data.gear_type || data.gear_name,
      id: data.gear_id,
      status: data.armory_status || "assigned",
    });
  });
  drones.docs.forEach((doc) => {
    const data = doc.data();
    const components = componentsByDroneSet[data.drone_set_id] || [];
    allCurrentItems.push({
      type: "Drone",
      name: data.set_type,
      id: data.set_serial_number,
      components,
      status: data.armory_status || "assigned",
    });
  });
  equipment.docs.forEach((doc) => {
    const data = doc.data();
    allCurrentItems.push({
      type: "Equipment",
      name: data.equipment_type,
      id: doc.id.slice(0, 8),
      status: "assigned",
    });
  });

  const newItemIds = safeAssignedItems
    .map((item) => getItemIdentifier(item))
    .filter(Boolean);
  const newItemIdSet = new Set(newItemIds);

  const previousItems = allCurrentItems.filter((item) => !newItemIdSet.has(item.id));

  const now = new Date();
  const dateStr = now.toLocaleDateString("he-IL");
  const timeStr = now.toLocaleTimeString("he-IL");
  const sanitizedPerformer = performerName || "System";

  const signatureHtml = signatureData
    ? `<img src="${signatureData}" alt="Soldier Signature" style="max-width:100%;max-height:100px;object-fit:contain;" />`
    : "<p><em>לא סופקה חתימה</em></p>";

  let newItemsTableRows = "";
  if (safeAssignedItems.length === 0) {
    newItemsTableRows = "<tr><td colspan=\"5\">אין פריטים שנחתמו</td></tr>";
  } else {
    newItemsTableRows = safeAssignedItems
      .map((item, index) => formatAssignmentItemRow(item, index, allCurrentItems))
      .join("");
  }

  let previousItemsHtml = "";
  if (previousItems.length === 0) {
    previousItemsHtml = "<p><strong>לא היה ציוד קודם ברשות החייל.</strong></p>";
  } else {
    const previousItemsTableRows = previousItems
      .map((item, index) => formatAssignmentItemRow(item, index, allCurrentItems))
      .join("");
    previousItemsHtml = `<table class="items-table">
      <thead>
        <tr>
          <th>#</th>
          <th>סוג</th>
          <th>שם הפריט</th>
          <th>מספר סידורי</th>
          <th>סטטוס</th>
        </tr>
      </thead>
      <tbody>
        ${previousItemsTableRows}
      </tbody>
    </table>`;
  }

  const htmlContent = `<!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>Equipment Assignment Form</title>
        <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
            @page { size: A4; margin: 0.5in; }
            * { box-sizing: border-box; }
            body { font-family: 'Heebo', Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #000; direction: rtl; text-align: right; margin: 0; padding: 20px; background: white; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
            .header h1 { font-size: 24px; font-weight: bold; margin: 0 0 5px 0; direction: ltr; }
            .header h2 { font-size: 20px; font-weight: bold; margin: 0; direction: rtl; }
            .section { margin-bottom: 25px; border: 1px solid #ddd; padding: 15px; page-break-inside: avoid; }
            .section h3 { font-size: 16px; font-weight: bold; margin: 0 0 10px 0; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
            .info-row { margin-bottom: 8px; }
            .info-row strong { font-weight: 600; }
            .items-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            .items-table th, .items-table td { border: 1px solid #666; padding: 8px; text-align: right; font-size: 11px; vertical-align: top; }
            .items-table th { background-color: #f5f5f5; font-weight: bold; }
            .assigned-items { background-color: #f0fff4; }
            .total-items { background-color: #f0f9ff; }
            .signature-box { border: 1px solid #666; min-height: 120px; padding: 10px; margin-top: 10px; display: flex; align-items: center; justify-content: center; background: #fafafa; }
            .footer { margin-top: 30px; font-size: 10px; color: #666; text-align: center; border-top: 1px solid #ddd; padding-top: 10px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Equipment Assignment Form</h1>
            <h2>טופס חתימה על ציוד</h2>
        </div>
        <div class="section">
            <h3>פרטי הפעילות - Activity Details</h3>
            <div class="info-row"><strong>תאריך:</strong> ${dateStr} בשעה ${timeStr}</div>
            <div class="info-row"><strong>מאושר על ידי:</strong> ${sanitizedPerformer}</div>
        </div>
        <div class="section">
            <h3>פרטי החייל - Soldier Information</h3>
            <div class="info-row"><strong>שם:</strong> ${soldier.first_name || ""} ${soldier.last_name || ""}</div>
            <div class="info-row"><strong>מספר אישי:</strong> ${soldier.soldier_id || ""}</div>
            <div class="info-row"><strong>יחידה:</strong> ${soldier.division_name || "N/A"}</div>
        </div>
        <div class="section assigned-items">
            <h3>ציוד שנחתם באירוע זה - Equipment Assigned in This Event (${safeAssignedItems.length} items)</h3>
            <table class="items-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>סוג</th>
                        <th>שם הפריט</th>
                        <th>מספר סידורי</th>
                        <th>סטטוס</th>
                    </tr>
                </thead>
                <tbody>
                    ${newItemsTableRows}
                </tbody>
            </table>
        </div>
        <div class="section total-items">
            <h3>ציוד קודם ברשות החייל - Previously Assigned Equipment (${previousItems.length} items)</h3>
            ${previousItemsHtml}
        </div>
        <div class="section">
            <h3>חתימת החייל - Soldier Signature</h3>
            <div class="signature-box">
                ${signatureHtml}
            </div>
        </div>
        <div class="footer">
            <p>נוצר ב-${dateStr}, ${timeStr}</p>
        </div>
    </body>
    </html>`;

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
    });
    await page.close();
    return {
      soldier,
      pdf_base64: pdfBuffer.toString("base64"),
      filename: `signing_form_${soldierID}_${Date.now()}.pdf`,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

/**
 * Generate a signing form PDF
 */
exports.generateSigningForm = functions
  .runWith({
    serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com",
    memory: "1GB",
    timeoutSeconds: 60,
  })
  .https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  const {
    soldierID,
    assignedItems = [],
    performerName = "System",
    signatureData = "",
  } = data;

  if (!soldierID) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Soldier ID is required"
    );
  }

  try {
    const result = await generateAssignmentFormDocument({
      soldierID,
      assignedItems,
      performerName,
      signatureData,
    });

    return {
      success: true,
      pdf_base64: result.pdf_base64,
      filename: result.filename,
    };
  } catch (error) {
    logger.error?.("generateSigningForm failed", error);
    throw new functions.https.HttpsError(
      "internal",
      `Failed to generate signing form: ${error.message}`
    );
  }
});

/**
 * Helper function to generate release form PDF
 */
const formatReleaseItemRow = (item, index, defaultStatus = "Returned") => {
  const identifier = getItemIdentifier(item);

  const resolvedType = item.type || item.itemType || "";
  const resolvedName = item.name || item.displayName || "";
  const resolvedId = identifier;
  const resolvedStatus = item.status || item.condition || defaultStatus;

  return `<tr>
    <td>${index + 1}</td>
    <td>${resolvedType}</td>
    <td>${resolvedName}</td>
    <td>${resolvedId}</td>
    <td>${resolvedStatus}</td>
  </tr>`;
};

const generateReleaseFormDocument = async ({
  soldierID,
  releasedItems = [],
  reason = "End of Service",
  performerName = "System",
  signatureData = "",
  soldierData = null,
}) => {
  if (!soldierID) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Soldier ID is required"
    );
  }

  let soldier = soldierData;
  if (!soldier) {
    const soldierDoc = await db.collection("soldiers").doc(soldierID).get();
    if (!soldierDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Soldier not found"
      );
    }
    soldier = soldierDoc.data();
  }

  const safeReleasedItems = Array.isArray(releasedItems) ? releasedItems : [];

  const [remainingWeapons, remainingGear, remainingDrones, remainingEquipment] =
    await Promise.all([
      db.collection("weapons").where("assigned_to", "==", soldierID).get(),
      db.collection("serialized_gear").where("assigned_to", "==", soldierID).get(),
      db.collection("drone_sets").where("assigned_to", "==", soldierID).get(),
      db.collection("equipment").where("assigned_to", "==", soldierID).get(),
    ]);

  const releaseItemCount = safeReleasedItems.length;

  const remainingItems = [];

  remainingWeapons.docs.forEach((doc) => {
    const data = doc.data();
    remainingItems.push({
      type: "Weapon",
      name: data.weapon_type || data.weapon_name,
      id: data.weapon_id,
      status: data.armory_status || "assigned",
    });
  });
  remainingGear.docs.forEach((doc) => {
    const data = doc.data();
    remainingItems.push({
      type: "Gear",
      name: data.gear_type || data.gear_name,
      id: data.gear_id,
      status: data.armory_status || "assigned",
    });
  });
  remainingDrones.docs.forEach((doc) => {
    const data = doc.data();
    remainingItems.push({
      type: "Drone",
      name: data.set_type,
      id: data.set_serial_number,
      status: data.armory_status || "assigned",
    });
  });
  remainingEquipment.docs.forEach((doc) => {
    const data = doc.data();
    remainingItems.push({
      type: "Equipment",
      name: data.equipment_type,
      id: doc.id.slice(0, 8),
      status: "assigned",
    });
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString("he-IL");
  const timeStr = now.toLocaleTimeString("he-IL");

  const signatureHtml = signatureData
    ? `<img src="${signatureData}" alt="Soldier Signature" style="max-width:100%;max-height:100px;object-fit:contain;" />`
    : "<p><em>לא סופקה חתימה</em></p>";

  let releasedItemsTableRows = "";
  if (safeReleasedItems.length === 0) {
    releasedItemsTableRows = "<tr><td colspan=\"5\">לא צוינו פריטים לשחרור</td></tr>";
  } else {
    releasedItemsTableRows = safeReleasedItems
      .map((item, index) => formatReleaseItemRow(item, index, "Returned"))
      .join("");
  }

  let remainingItemsHtml = "";
  if (remainingItems.length === 0) {
    remainingItemsHtml = "<p><strong>אין ציוד נוסף ברשות החייל לאחר השחרור.</strong></p>";
  } else {
    const remainingItemsTableRows = remainingItems
      .map((item, index) => formatReleaseItemRow(item, index, "Assigned"))
      .join("");
    remainingItemsHtml = `<table class="items-table">
      <thead>
        <tr>
          <th>#</th>
          <th>סוג</th>
          <th>שם הפריט</th>
          <th>מספר סידורי</th>
          <th>סטטוס</th>
        </tr>
      </thead>
      <tbody>
        ${remainingItemsTableRows}
      </tbody>
    </table>`;
  }

  const htmlContent = `<!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>Equipment Release Form</title>
        <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
            @page { size: A4; margin: 0.5in; }
            * { box-sizing: border-box; }
            body { font-family: 'Heebo', Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #000; direction: rtl; text-align: right; margin: 0; padding: 20px; background: white; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
            .header h1 { font-size: 24px; font-weight: bold; margin: 0 0 5px 0; direction: ltr; }
            .header h2 { font-size: 20px; font-weight: bold; margin: 0; direction: rtl; }
            .section { margin-bottom: 25px; border: 1px solid #ddd; padding: 15px; page-break-inside: avoid; }
            .section h3 { font-size: 16px; font-weight: bold; margin: 0 0 10px 0; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
            .info-row { margin-bottom: 8px; }
            .info-row strong { font-weight: 600; }
            .items-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            .items-table th, .items-table td { border: 1px solid #666; padding: 8px; text-align: right; font-size: 11px; vertical-align: top; }
            .items-table th { background-color: #f5f5f5; font-weight: bold; }
            .released-items { background-color: #fff5f5; }
            .remaining-items { background-color: #f0f9ff; }
            .signature-box { border: 1px solid #666; min-height: 120px; padding: 10px; margin-top: 10px; display: flex; align-items: center; justify-content: center; background: #fafafa; }
            .footer { margin-top: 30px; font-size: 10px; color: #666; text-align: center; border-top: 1px solid #ddd; padding-top: 10px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Equipment Release Form</h1>
            <h2>טופס שחרור ציוד</h2>
        </div>
        <div class="section">
            <h3>פרטי הפעילות - Activity Details</h3>
            <div class="info-row"><strong>תאריך:</strong> ${dateStr} בשעה ${timeStr}</div>
            <div class="info-row"><strong>מאושר על ידי:</strong> ${performerName || "System"}</div>
            <div class="info-row"><strong>סיבת שחרור:</strong> ${reason || "לא צוין"}</div>
        </div>
        <div class="section">
            <h3>פרטי החייל - Soldier Information</h3>
            <div class="info-row"><strong>שם:</strong> ${soldier.first_name || ""} ${soldier.last_name || ""}</div>
            <div class="info-row"><strong>מספר אישי:</strong> ${soldier.soldier_id || ""}</div>
            <div class="info-row"><strong>יחידה:</strong> ${soldier.division_name || "N/A"}</div>
        </div>
        <div class="section released-items">
            <h3>ציוד ששוחרר באירוע זה - Equipment Released in This Event (${releaseItemCount} items)</h3>
            <table class="items-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>סוג</th>
                        <th>שם הפריט</th>
                        <th>מספר סידורי</th>
                        <th>סטטוס</th>
                    </tr>
                </thead>
                <tbody>
                    ${releasedItemsTableRows}
                </tbody>
            </table>
        </div>
        <div class="section remaining-items">
            <h3>ציוד שנותר ברשות החייל - Remaining Equipment After Release (${remainingItems.length} items)</h3>
            ${remainingItemsHtml}
        </div>
        <div class="section">
            <h3>חתימת החייל - Soldier Signature</h3>
            <div class="signature-box">
                ${signatureHtml}
            </div>
        </div>
        <div class="footer">
            <p>נוצר ב-${dateStr}, ${timeStr}</p>
        </div>
    </body>
    </html>`;

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
    });
    await page.close();
    return {
      soldier,
      pdf_base64: pdfBuffer.toString("base64"),
      filename: `release_form_${soldierID}_${Date.now()}.pdf`,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

/**
 * Generate a release form PDF
 */
exports.generateReleaseForm = functions
  .runWith({
    serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com",
    memory: "1GB",
    timeoutSeconds: 60,
  })
  .https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  const {
    soldierID,
    releasedItems = [],
    reason = "End of Service",
    performerName = "System",
    signatureData = "",
  } = data;

  if (!soldierID) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Soldier ID is required"
    );
  }

  try {
    const result = await generateReleaseFormDocument({
      soldierID,
      releasedItems,
      reason,
      performerName,
      signatureData,
    });
    return {
      success: true,
      pdf_base64: result.pdf_base64,
      filename: result.filename,
    };
  } catch (error) {
    logger.error?.("generateReleaseForm failed", error);
    throw new functions.https.HttpsError(
      "internal",
      `Failed to generate release form: ${error.message}`
    );
  }
});

/**
 * Send signing form via email
 */
exports.sendSigningForm = functions
  .runWith({ serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
  .https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  if (!sendGridApiKey) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "SendGrid not configured"
    );
  }

  const { soldierID, email, assignedItems = [] } = data;

  if (!soldierID || !email) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Soldier ID and email are required"
    );
  }

  try {
    // Generate the form
    const formResult = await exports.generateSigningForm.run(
      { data: { soldierID, assignedItems }, auth: context.auth },
      context
    );

    // Get soldier data for email content
    const soldierDoc = await db.collection("soldiers").doc(soldierID).get();
    const soldier = soldierDoc.data();

    // Send email with PDF attachment
    const msg = {
      to: email,
      from: functions.config().sendgrid?.from_email || "noreply@armory.com",
      subject: `Equipment Signing Form - ${soldier.first_name} ${soldier.last_name}`,
      html: `
        <h2>Equipment Signing Form</h2>
        <p>Dear ${soldier.first_name} ${soldier.last_name},</p>
        <p>Please find attached your equipment signing form. Please review, sign, and return it at your earliest convenience.</p>
        <p>If you have any questions, please contact your unit administrator.</p>
        <hr>
        <p><small>This email was sent by the Armory Management System</small></p>
      `,
      attachments: [
        {
          content: formResult.data.pdf_base64,
          filename: formResult.data.filename,
          type: "application/pdf",
          disposition: "attachment",
        },
      ],
    };

    await sgMail.send(msg);

    // Log activity
    await db.collection("activity_logs").add({
      entity_type: "form",
      action: "signing_form_sent",
      performed_by: context.auth.uid,
      details: {
        soldier_id: soldierID,
        email: email,
      },
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, message: `Signing form sent to ${email}` };
  } catch (error) {
    throw new functions.https.HttpsError(
      "internal",
      `Failed to send signing form: ${error.message}`
    );
  }
});

/**
 * Send signing form by activity
 */
exports.sendSigningFormByActivity = functions
  .runWith({
    serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com",
    memory: "2GB",
    timeoutSeconds: 60
  })
  .https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  if (!sendGridApiKey) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "SendGrid not configured"
    );
  }

  const { activityID, activityId } = data;
  const actualActivityId = activityID || activityId;

  if (!actualActivityId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Activity ID is required"
    );
  }

  try {
    // Get activity log
    const activityDoc = await db.collection("activity_logs").doc(actualActivityId).get();

    if (!activityDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Activity not found"
      );
    }

    const activity = activityDoc.data();
    // Check multiple possible locations for soldier_id
    const soldierID = activity.details?.soldier_id ||
                      activity.context?.soldierId ||
                      activity.soldier_id;

    if (!soldierID) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Activity does not contain soldier information"
      );
    }

    // Get soldier data
    const soldierDoc = await db.collection("soldiers").doc(soldierID).get();
    const soldier = soldierDoc.data();

    if (!soldier.email) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Soldier does not have an email address"
      );
    }

    // Get assigned items from activity
    const assignedItems = activity.details?.assigned_items || activity.context?.assignedItems || [];
    const performerName = activity.user_full_name || 'System';
    const signatureData = activity.context?.signature || '';

    // Get all current equipment for the soldier
    const [weapons, gear, drones, equipment] = await Promise.all([
      db.collection("weapons").where("assigned_to", "==", soldierID).get(),
      db.collection("serialized_gear").where("assigned_to", "==", soldierID).get(),
      db.collection("drone_sets").where("assigned_to", "==", soldierID).get(),
      db.collection("equipment").where("assigned_to", "==", soldierID).get(),
    ]);

    console.log("[sendReleaseFormByActivity] Remaining items fetched", {
      weapons: weapons.size,
      gear: gear.size,
      drones: drones.size,
      equipment: equipment.size
    });

    // Fetch drone components for all drone sets
    const droneSetIds = drones.docs.map(doc => doc.data().drone_set_id).filter(Boolean);
    let droneComponents = [];
    if (droneSetIds.length > 0) {
      // Firestore 'in' query supports up to 10 items, so batch if needed
      const componentPromises = [];
      for (let i = 0; i < droneSetIds.length; i += 10) {
        const batch = droneSetIds.slice(i, i + 10);
        componentPromises.push(
          db.collection("drone_components").where("drone_set_id", "in", batch).get()
        );
      }
      const componentSnapshots = await Promise.all(componentPromises);
      droneComponents = componentSnapshots.flatMap(snapshot => snapshot.docs);
    }

    // Group components by drone set ID
    const componentsByDroneSet = {};
    droneComponents.forEach(doc => {
      const comp = doc.data();
      if (!componentsByDroneSet[comp.drone_set_id]) {
        componentsByDroneSet[comp.drone_set_id] = [];
      }
      componentsByDroneSet[comp.drone_set_id].push({
        type: comp.component_type,
        id: comp.component_id
      });
    });

    // Build list of all current items
    const allCurrentItems = [];
    weapons.docs.forEach(doc => {
      const data = doc.data();
      allCurrentItems.push({
        type: 'Weapon',
        name: data.weapon_type || data.weapon_name,
        id: data.weapon_id,
        status: data.armory_status || 'assigned'
      });
    });
    gear.docs.forEach(doc => {
      const data = doc.data();
      allCurrentItems.push({
        type: 'Gear',
        name: data.gear_type || data.gear_name,
        id: data.gear_id,
        status: data.armory_status || 'assigned'
      });
    });
    drones.docs.forEach(doc => {
      const data = doc.data();
      const components = componentsByDroneSet[data.drone_set_id] || [];
      allCurrentItems.push({
        type: 'Drone',
        name: data.set_type,
        id: data.set_serial_number,
        components: components, // Add components array
        status: data.armory_status || 'assigned'
      });
    });
    equipment.docs.forEach(doc => {
      const data = doc.data();
      allCurrentItems.push({
        type: 'Equipment',
        name: data.equipment_type,
        id: doc.id.slice(0, 8),
        status: 'assigned'
      });
    });

    // Calculate previous items (all current items minus the newly assigned ones)
    // We need to match by field IDs (weapon_id, gear_id, set_serial_number) not document IDs
    // Priority: fieldId > displayId > id (because fieldId is the actual serial/ID number)
    const newItemIds = assignedItems.map(item => item.fieldId || item.displayId || item.id);
    const previousItems = allCurrentItems.filter(item => !newItemIds.includes(item.id));

    // Format date and time
    const now = new Date();
    const dateStr = now.toLocaleDateString('he-IL');
    const timeStr = now.toLocaleTimeString('he-IL');

    // Generate PDF from HTML using Puppeteer
    // Embed signature directly as base64 data URI
    const signatureHtml = signatureData
      ? `<img src="${signatureData}" alt="Soldier Signature" style="max-width:100%;max-height:100px;object-fit:contain;" />`
      : '<p><em>No signature provided</em></p>';

    // Helper function to format item rows with components
    const formatItemRow = (item, index) => {
      const mainRow = `<tr>
        <td>${index + 1}</td>
        <td>${item.type || item.itemType || ''}</td>
        <td>${item.name || item.displayName || ''}</td>
        <td>${item.id || item.displayId || ''}</td>
        <td>${item.status || 'Assigned'}</td>
      </tr>`;

      // Add component rows if this is a drone with components
      if ((item.type === 'Drone' || item.type === 'Drone Set') && item.components && item.components.length > 0) {
        const componentRows = item.components.map(comp =>
          `<tr style="background-color: #f9f9f9;">
            <td></td>
            <td colspan="2" style="padding-right: 30px;">↳ ${comp.type}</td>
            <td>${comp.id}</td>
            <td></td>
          </tr>`
        ).join('');
        return mainRow + componentRows;
      }

      return mainRow;
    };

    // Build items table rows for newly assigned items
    let newItemsTableRows = '';
    if (assignedItems.length === 0) {
      newItemsTableRows = '<tr><td colspan="5">אין פריטים שנחתמו</td></tr>';
    } else {
      newItemsTableRows = assignedItems.map((item, index) => formatItemRow(item, index)).join('');
    }

    // Build items table rows for previous items
    let previousItemsHtml = '';
    if (previousItems.length === 0) {
      previousItemsHtml = '<p><strong>לא היה ציוד קודם ברשות החייל.</strong></p>';
    } else {
      const previousItemsTableRows = previousItems.map((item, index) => formatItemRow(item, index)).join('');
      previousItemsHtml = `<table class="items-table">
        <thead>
          <tr>
            <th>#</th>
            <th>סוג</th>
            <th>שם הפריט</th>
            <th>מספר סידורי</th>
            <th>סטטוס</th>
          </tr>
        </thead>
        <tbody>
          ${previousItemsTableRows}
        </tbody>
      </table>`;
    }

    const htmlContent = `<!DOCTYPE html>
      <html lang="he" dir="rtl">
      <head>
          <meta charset="UTF-8">
          <title>Equipment Assignment Form</title>
          <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
              @page { size: A4; margin: 0.5in; }
              * { box-sizing: border-box; }
              body { font-family: 'Heebo', Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #000; direction: rtl; text-align: right; margin: 0; padding: 20px; background: white; }
              .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
              .header h1 { font-size: 24px; font-weight: bold; margin: 0 0 5px 0; direction: ltr; }
              .header h2 { font-size: 20px; font-weight: bold; margin: 0; direction: rtl; }
              .section { margin-bottom: 25px; border: 1px solid #ddd; padding: 15px; page-break-inside: avoid; }
              .section h3 { font-size: 16px; font-weight: bold; margin: 0 0 10px 0; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
              .info-row { margin-bottom: 8px; }
              .info-row strong { font-weight: 600; }
              .items-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
              .items-table th, .items-table td { border: 1px solid #666; padding: 8px; text-align: right; font-size: 11px; vertical-align: top; }
              .items-table th { background-color: #f5f5f5; font-weight: bold; }
              .assigned-items { background-color: #f0fff4; }
              .total-items { background-color: #f0f9ff; }
              .signature-box { border: 1px solid #666; min-height: 120px; padding: 10px; margin-top: 10px; display: flex; align-items: center; justify-content: center; background: #fafafa; }
              .footer { margin-top: 30px; font-size: 10px; color: #666; text-align: center; border-top: 1px solid #ddd; padding-top: 10px; }
          </style>
      </head>
      <body>
          <div class="header">
              <h1>Equipment Assignment Form</h1>
              <h2>טופס חתימה על ציוד</h2>
          </div>
          <div class="section">
              <h3>פרטי הפעילות - Activity Details</h3>
              <div class="info-row"><strong>תאריך:</strong> ${dateStr} בשעה ${timeStr}</div>
              <div class="info-row"><strong>מאושר על ידי:</strong> ${performerName}</div>
          </div>
          <div class="section">
              <h3>פרטי החייל - Soldier Information</h3>
              <div class="info-row"><strong>שם:</strong> ${soldier.first_name} ${soldier.last_name}</div>
              <div class="info-row"><strong>מספר אישי:</strong> ${soldier.soldier_id}</div>
              <div class="info-row"><strong>יחידה:</strong> ${soldier.division_name || 'N/A'}</div>
          </div>
          <div class="section assigned-items">
              <h3>ציוד שנחתם באירוע זה - Equipment Assigned in This Event (${assignedItems.length} items)</h3>
              <table class="items-table">
                  <thead>
                      <tr>
                          <th>#</th>
                          <th>סוג</th>
                          <th>שם הפריט</th>
                          <th>מספר סידורי</th>
                          <th>סטטוס</th>
                      </tr>
                  </thead>
                  <tbody>
                      ${newItemsTableRows}
                  </tbody>
              </table>
          </div>
          <div class="section total-items">
              <h3>ציוד קודם ברשות החייל - Previously Assigned Equipment (${previousItems.length} items)</h3>
              ${previousItemsHtml}
          </div>
          <div class="section">
              <h3>חתימת החייל - Soldier Signature</h3>
              <div class="signature-box">
                  ${signatureHtml}
              </div>
          </div>
          <div class="footer">
              <p>נוצר ב-${dateStr}, ${timeStr}</p>
          </div>
      </body>
      </html>`;

    // Generate PDF from HTML using puppeteer with chromium
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
    });
    await browser.close();

    const pdfBase64 = pdfBuffer.toString('base64');

    // Send email with PDF attachment
    const msg = {
      to: soldier.email,
      from: functions.config().sendgrid?.from_email || "noreply@armory.com",
      subject: `טופס חתימה על ציוד - ${soldier.first_name} ${soldier.last_name}`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>טופס חתימה על ציוד</h2>
          <p>שלום ${soldier.first_name} ${soldier.last_name},</p>
          <p>מצורף טופס חתימה על ציוד. אנא שמור/י את הקובץ לעיון עתידי.</p>
          <hr>
          <p><small>מייל זה נשלח אוטומטית ממערכת ניהול הנשקייה</small></p>
        </div>
      `,
      attachments: [
        {
          content: pdfBase64,
          filename: `equipment_assignment_${soldier.soldier_id}_${Date.now()}.pdf`,
          type: "application/pdf",
          disposition: "attachment",
        },
      ],
    };

    await sgMail.send(msg);

    return { success: true, message: `Signing form sent to ${soldier.email}` };
  } catch (error) {
    throw new functions.https.HttpsError(
      "internal",
      `Failed to send signing form: ${error.message}`
    );
  }
});

/**
 * Send release form by activity
 */
exports.sendReleaseFormByActivity = functions
  .runWith({
    serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com",
    memory: "2GB",
    timeoutSeconds: 60
  })
  .https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  if (!sendGridApiKey) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "SendGrid not configured"
    );
  }

  // Support both legacy camelCase and current ActivityID keys
  const { activityID, activityId } = data;
  const resolvedActivityId = activityID || activityId;

  if (!resolvedActivityId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Activity ID is required"
    );
  }

  try {
    console.log("[sendReleaseFormByActivity] Start", { resolvedActivityId });

    // Get activity log
    const activityDoc = await db.collection("activity_logs").doc(resolvedActivityId).get();
    
    if (!activityDoc.exists) {
      console.error("[sendReleaseFormByActivity] Activity not found", { resolvedActivityId });
      throw new functions.https.HttpsError(
        "not-found",
        "Activity not found"
      );
    }

    const activity = activityDoc.data();
    console.log("[sendReleaseFormByActivity] Activity loaded", {
      activity_type: activity.activity_type,
      soldier_id_in_details: activity.details?.soldier_id,
      soldier_id_in_context: activity.context?.soldierId,
      soldier_id_root: activity.soldier_id,
      released_items_len: (activity.details?.released_items || activity.context?.unassignedItems || []).length,
      has_signature: Boolean(activity.context?.signature)
    });

    // Check multiple possible locations for soldier_id
    const soldierID = activity.details?.soldier_id ||
                      activity.context?.soldierId ||
                      activity.soldier_id;

    if (!soldierID) {
      console.error("[sendReleaseFormByActivity] Missing soldier ID in activity", { resolvedActivityId });
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Activity does not contain soldier information"
      );
    }

    const releasedItems = activity.details?.released_items || activity.context?.unassignedItems || [];

    console.log("[sendReleaseFormByActivity] Generating release form PDF");
    // Generate release form using helper function
    const formResult = await generateReleaseFormDocument({
      soldierID,
      releasedItems,
      reason: activity.details?.reason || "Activity-based release",
      performerName: activity.user_full_name || "System",
      signatureData: activity.context?.signature || "",
      soldierData: null
    });

    // Get soldier email
    if (!formResult.soldier.email) {
      console.error("[sendReleaseFormByActivity] Soldier missing email", { soldierID });
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Soldier does not have an email address"
      );
    }

    console.log("[sendReleaseFormByActivity] Generated release form", {
      soldierID,
      soldierEmail: formResult.soldier.email,
      releasedItems: releasedItems.map(item => item?.id || item?.displayId || item).slice(0, 5)
    });

    // Send email with HTML formatted release form
    const soldier = formResult.soldier;
    const reason = activity.details?.reason || "Activity-based release";

    // Get all remaining equipment for the soldier AFTER release
    const [weapons, gear, drones, equipment] = await Promise.all([
      db.collection("weapons").where("assigned_to", "==", soldierID).get(),
      db.collection("serialized_gear").where("assigned_to", "==", soldierID).get(),
      db.collection("drone_sets").where("assigned_to", "==", soldierID).get(),
      db.collection("equipment").where("assigned_to", "==", soldierID).get(),
    ]);

    console.log("[sendReleaseFormByActivity] Remaining items fetched", {
      weapons: weapons.size,
      gear: gear.size,
      drones: drones.size,
      equipment: equipment.size
    });

    // Fetch drone components for all remaining drone sets
    const releaseDroneSetIds = drones.docs.map(doc => doc.data().drone_set_id).filter(Boolean);
    let releaseDroneComponents = [];
    if (releaseDroneSetIds.length > 0) {
      // Firestore 'in' query supports up to 10 items, so batch if needed
      const releaseComponentPromises = [];
      for (let i = 0; i < releaseDroneSetIds.length; i += 10) {
        const batch = releaseDroneSetIds.slice(i, i + 10);
        releaseComponentPromises.push(
          db.collection("drone_components").where("drone_set_id", "in", batch).get()
        );
      }
      const releaseComponentSnapshots = await Promise.all(releaseComponentPromises);
      releaseDroneComponents = releaseComponentSnapshots.flatMap(snapshot => snapshot.docs);
    }

    // Group components by drone set ID
    const releaseComponentsByDroneSet = {};
    releaseDroneComponents.forEach(doc => {
      const comp = doc.data();
      if (!releaseComponentsByDroneSet[comp.drone_set_id]) {
        releaseComponentsByDroneSet[comp.drone_set_id] = [];
      }
      releaseComponentsByDroneSet[comp.drone_set_id].push({
        type: comp.component_type,
        id: comp.component_id
      });
    });

    // Build list of remaining items
    const remainingItems = [];
    weapons.docs.forEach(doc => {
      const data = doc.data();
      remainingItems.push({
        type: 'Weapon',
        name: data.weapon_type || data.weapon_name,
        id: data.weapon_id,
        status: data.armory_status || 'assigned'
      });
    });
    gear.docs.forEach(doc => {
      const data = doc.data();
      remainingItems.push({
        type: 'Gear',
        name: data.gear_type || data.gear_name,
        id: data.gear_id,
        status: data.armory_status || 'assigned'
      });
    });
    drones.docs.forEach(doc => {
      const data = doc.data();
      const components = releaseComponentsByDroneSet[data.drone_set_id] || [];
      remainingItems.push({
        type: 'Drone',
        name: data.set_type,
        id: data.set_serial_number,
        components: components, // Add components array
        status: data.armory_status || 'assigned'
      });
    });
    equipment.docs.forEach(doc => {
      const data = doc.data();
      remainingItems.push({
        type: 'Equipment',
        name: data.equipment_type,
        id: doc.id.slice(0, 8),
        status: 'assigned'
      });
    });

    // Format date and time
    const now = new Date();
    const dateStr = now.toLocaleDateString('he-IL');
    const timeStr = now.toLocaleTimeString('he-IL');

    // Generate PDF from HTML using Puppeteer
    // Get signature from activity if available - embed directly as base64 data URI
    const signatureData = activity.context?.signature || '';
    const signatureHtml = signatureData
      ? `<img src="${signatureData}" alt="Soldier Signature" style="max-width:100%;max-height:100px;object-fit:contain;" />`
      : '<p><em>No signature provided</em></p>';

    // Helper function to format item rows with components (same as signing form)
    const formatReleaseItemRow = (item, index, defaultStatus = 'Assigned') => {
      const mainRow = `<tr>
        <td>${index + 1}</td>
        <td>${item.type || item.itemType || ''}</td>
        <td>${item.name || item.displayName || ''}</td>
        <td>${item.id || item.displayId || ''}</td>
        <td>${item.status || defaultStatus}</td>
      </tr>`;

      // Add component rows if this is a drone with components
      if ((item.type === 'Drone' || item.type === 'Drone Set') && item.components && item.components.length > 0) {
        const componentRows = item.components.map(comp =>
          `<tr style="background-color: #f9f9f9;">
            <td></td>
            <td colspan="2" style="padding-right: 30px;">↳ ${comp.type}</td>
            <td>${comp.id}</td>
            <td></td>
          </tr>`
        ).join('');
        return mainRow + componentRows;
      }

      return mainRow;
    };

    // Build items table rows for released items
    let itemsTableRows = '';
    if (releasedItems.length === 0) {
      itemsTableRows = '<tr><td colspan="5">אין פריטים ששוחררו</td></tr>';
    } else {
      itemsTableRows = releasedItems.map((item, index) => formatReleaseItemRow(item, index, 'Released')).join('');
    }

    // Build HTML for remaining items
    let remainingItemsHtml = '';
    if (remainingItems.length === 0) {
      remainingItemsHtml = '<p><strong>לא נותר ציוד ברשות החייל.</strong></p>';
    } else {
      const remainingItemsTableRows = remainingItems.map((item, index) => formatReleaseItemRow(item, index)).join('');
      remainingItemsHtml = `<table class="items-table">
        <thead>
          <tr>
            <th>#</th>
            <th>סוג</th>
            <th>שם הפריט</th>
            <th>מספר סידורי</th>
            <th>סטטוס</th>
          </tr>
        </thead>
        <tbody>
          ${remainingItemsTableRows}
        </tbody>
      </table>`;
    }

    // Get performer name from activity
    const performerName = activity.user_full_name || 'System';

    const htmlContent = `<!DOCTYPE html>
      <html lang="he" dir="rtl">
      <head>
          <meta charset="UTF-8">
          <title>Equipment Release Form</title>
          <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
              @page { size: A4; margin: 0.5in; }
              * { box-sizing: border-box; }
              body { font-family: 'Heebo', Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #000; direction: rtl; text-align: right; margin: 0; padding: 20px; background: white; }
              .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
              .header h1 { font-size: 24px; font-weight: bold; margin: 0 0 5px 0; direction: ltr; }
              .header h2 { font-size: 20px; font-weight: bold; margin: 0; direction: rtl; }
              .section { margin-bottom: 25px; border: 1px solid #ddd; padding: 15px; page-break-inside: avoid; }
              .section h3 { font-size: 16px; font-weight: bold; margin: 0 0 10px 0; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
              .info-row { margin-bottom: 8px; }
              .info-row strong { font-weight: 600; }
              .items-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
              .items-table th, .items-table td { border: 1px solid #666; padding: 8px; text-align: right; font-size: 11px; vertical-align: top; }
              .items-table th { background-color: #f5f5f5; font-weight: bold; }
              .released-items { background-color: #fffbe6; }
              .remaining-items { background-color: #f0f9ff; }
              .signature-box { border: 1px solid #666; min-height: 120px; padding: 10px; margin-top: 10px; display: flex; align-items: center; justify-content: center; background: #fafafa; }
              .footer { margin-top: 30px; font-size: 10px; color: #666; text-align: center; border-top: 1px solid #ddd; padding-top: 10px; }
          </style>
      </head>
      <body>
          <div class="header">
              <h1>Equipment Release Form</h1>
              <h2>טופס שחרור ציוד</h2>
          </div>
          <div class="section">
              <h3>פרטי הפעילות - Activity Details</h3>
              <div class="info-row"><strong>תאריך:</strong> ${dateStr} בשעה ${timeStr}</div>
              <div class="info-row"><strong>מאושר על ידי:</strong> ${performerName}</div>
          </div>
          <div class="section">
              <h3>פרטי החייל - Soldier Information</h3>
              <div class="info-row"><strong>שם:</strong> ${soldier.first_name} ${soldier.last_name}</div>
              <div class="info-row"><strong>מספר אישי:</strong> ${soldier.soldier_id}</div>
              <div class="info-row"><strong>יחידה:</strong> ${soldier.division_name || 'N/A'}</div>
          </div>
          <div class="section released-items">
              <h3>ציוד ששוחרר באירוע זה - Equipment Released in This Event (${releasedItems.length} items)</h3>
              <table class="items-table">
                  <thead>
                      <tr>
                          <th>#</th>
                          <th>סוג</th>
                          <th>שם הפריט</th>
                          <th>מספר סידורי</th>
                          <th>סטטוס</th>
                      </tr>
                  </thead>
                  <tbody>
                      ${itemsTableRows}
                  </tbody>
              </table>
          </div>
          <div class="section remaining-items">
              <h3>סה"כ ציוד שנותר אצל החייל - Total Equipment Remaining with Soldier (${remainingItems.length} items)</h3>
              ${remainingItemsHtml}
          </div>
          <div class="section">
              <h3>חתימת החייל - Soldier Signature</h3>
              <div class="signature-box">
                  ${signatureHtml}
              </div>
          </div>
          <div class="footer">
              <p>נוצר ב-${dateStr}, ${timeStr}</p>
          </div>
      </body>
      </html>`;

    // Generate PDF from HTML using puppeteer with chromium
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
    });
    await browser.close();

    const pdfBase64 = pdfBuffer.toString('base64');

    // Send email with PDF attachment
    const msg = {
      to: soldier.email,
      from: functions.config().sendgrid?.from_email || "noreply@armory.com",
      subject: `טופס שחרור ציוד - ${soldier.first_name} ${soldier.last_name}`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>טופס שחרור ציוד</h2>
          <p>שלום ${soldier.first_name} ${soldier.last_name},</p>
          <p>מצורף טופס שחרור ציוד. אנא שמור/י את הקובץ לעיון עתידי.</p>
          <hr>
          <p><small>מייל זה נשלח אוטומטית ממערכת ניהול הנשקייה</small></p>
        </div>
      `,
      attachments: [
        {
          content: pdfBase64,
          filename: `equipment_release_${soldier.soldier_id}_${Date.now()}.pdf`,
          type: "application/pdf",
          disposition: "attachment",
        },
      ],
    };

    await sgMail.send(msg);

    return { success: true, message: `Release form sent to ${soldier.email}` };
  } catch (error) {
    console.error("[sendReleaseFormByActivity] Failed", {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      stack: error?.stack
    });
    throw new functions.https.HttpsError(
      "internal",
      `Failed to send release form: ${error.message}`
    );
  }
});

/**
 * Send bulk equipment forms
 */
exports.sendBulkEquipmentForms = functions
  .runWith({ timeoutSeconds: 300, serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    if (!["admin", "manager"].includes(context.auth.token.role)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only admins and managers can send bulk forms"
      );
    }

    if (!sendGridApiKey) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "SendGrid not configured"
      );
    }

    const { soldierIDs = [], formType = "signing" } = data;

    if (soldierIDs.length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "No soldiers specified"
      );
    }

    const results = {
      sent: [],
      failed: [],
    };

    for (const soldierID of soldierIDs) {
      try {
        const soldierDoc = await db.collection("soldiers").doc(soldierID).get();
        
        if (!soldierDoc.exists) {
          results.failed.push({ soldierID, reason: "Soldier not found" });
          continue;
        }

        const soldier = soldierDoc.data();
        
        if (!soldier.email) {
          results.failed.push({ soldierID, reason: "No email address" });
          continue;
        }

        // Generate appropriate form
        let formResult;
        if (formType === "signing") {
          formResult = await exports.generateSigningForm.run(
            { data: { soldierID }, auth: context.auth },
            context
          );
        } else {
          formResult = await exports.generateReleaseForm.run(
            { data: { soldierID }, auth: context.auth },
            context
          );
        }

        // Send email
        const msg = {
          to: soldier.email,
          from: functions.config().sendgrid?.from_email || "noreply@armory.com",
          subject: `Equipment ${formType === "signing" ? "Signing" : "Release"} Form`,
          html: `
            <p>Dear ${soldier.first_name} ${soldier.last_name},</p>
            <p>Please find attached your equipment ${formType} form.</p>
          `,
          attachments: [
            {
              content: formResult.data.pdf_base64,
              filename: formResult.data.filename,
              type: "application/pdf",
              disposition: "attachment",
            },
          ],
        };

        await sgMail.send(msg);
        results.sent.push({ soldierID, email: soldier.email });
      } catch (error) {
        results.failed.push({ soldierID, reason: error.message });
      }
    }

    // Log activity
    await db.collection("activity_logs").add({
      entity_type: "form",
      action: "bulk_forms_sent",
      performed_by: context.auth.uid,
      details: {
        form_type: formType,
        total: soldierIDs.length,
        sent: results.sent.length,
        failed: results.failed.length,
      },
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      sent: results.sent,
      failed: results.failed,
      summary: {
        total: soldierIDs.length,
        sent: results.sent.length,
        failed: results.failed.length,
      },
    };
  });