const functions = require("firebase-functions");
const admin = require("firebase-admin");
const PDFDocument = require("pdfkit");
const sgMail = require("@sendgrid/mail");

const db = admin.firestore();

// Initialize SendGrid if configured
const sendGridApiKey = functions.config().sendgrid?.api_key;
if (sendGridApiKey) {
  sgMail.setApiKey(sendGridApiKey);
}

/**
 * Generate a signing form PDF
 */
exports.generateSigningForm = functions
  .runWith({ serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
  .https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  const { soldierID, assignedItems = [] } = data;

  if (!soldierID) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Soldier ID is required"
    );
  }

  try {
    // Get soldier data
    const soldierDoc = await db.collection("soldiers").doc(soldierID).get();
    
    if (!soldierDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Soldier not found"
      );
    }

    const soldier = soldierDoc.data();

    // Create PDF
    const doc = new PDFDocument();
    const chunks = [];
    
    doc.on("data", (chunk) => chunks.push(chunk));

    // Header
    doc.fontSize(20).text("Equipment Signing Form", { align: "center" });
    doc.moveDown();
    
    // Date
    doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();

    // Soldier Information
    doc.fontSize(14).text("Soldier Information", { underline: true });
    doc.fontSize(12);
    doc.text(`Name: ${soldier.first_name} ${soldier.last_name}`);
    doc.text(`Soldier ID: ${soldier.soldier_id}`);
    doc.text(`Division: ${soldier.division_name || "N/A"}`);
    doc.text(`Team: ${soldier.team_name || "N/A"}`);
    doc.moveDown();

    // Assigned Items
    doc.fontSize(14).text("Assigned Items", { underline: true });
    doc.fontSize(12);
    
    if (assignedItems.length === 0) {
      // Fetch items from database if not provided
      const [weapons, gear, equipment] = await Promise.all([
        db.collection("weapons").where("soldier_id", "==", soldierID).get(),
        db.collection("serialized_gear").where("soldier_id", "==", soldierID).get(),
        db.collection("equipment").where("soldier_id", "==", soldierID).get(),
      ]);

      weapons.docs.forEach((doc) => {
        const weapon = doc.data();
        doc.text(`• Weapon: ${weapon.weapon_name} (ID: ${weapon.weapon_id})`);
      });

      gear.docs.forEach((doc) => {
        const item = doc.data();
        doc.text(`• Gear: ${item.gear_name} (ID: ${item.gear_id})`);
      });

      equipment.docs.forEach((doc) => {
        const item = doc.data();
        doc.text(`• Equipment: ${item.equipment_name} (ID: ${item.equipment_id})`);
      });
    } else {
      assignedItems.forEach((item) => {
        doc.text(`• ${item.type}: ${item.name} (ID: ${item.id})`);
      });
    }

    doc.moveDown(2);

    // Signature Section
    doc.fontSize(14).text("Declaration", { underline: true });
    doc.fontSize(11);
    doc.text("I hereby acknowledge receipt of the above listed items and understand that I am responsible for their proper care and maintenance.");
    doc.moveDown(2);

    // Signature Lines
    doc.text("Soldier Signature: _______________________________  Date: _______________");
    doc.moveDown();
    doc.text("Issuing Officer: _________________________________  Date: _______________");

    // Footer
    doc.moveDown(2);
    doc.fontSize(10).text("This document was generated electronically by the Armory Management System", {
      align: "center",
    });

    // Finalize PDF
    doc.end();

    // Convert to base64
    const buffer = Buffer.concat(chunks);
    const base64 = buffer.toString("base64");

    return {
      success: true,
      pdf_base64: base64,
      filename: `signing_form_${soldierID}_${Date.now()}.pdf`,
    };
  } catch (error) {
    console.error("Error generating signing form:", error);
    throw new functions.https.HttpsError(
      "internal",
      `Failed to generate signing form: ${error.message}`
    );
  }
});

/**
 * Helper function to generate release form PDF
 */
async function generateReleaseFormPDF(soldierID, releasedItems = [], reason = "End of Service") {
  // Get soldier data
  const soldierDoc = await db.collection("soldiers").doc(soldierID).get();

  if (!soldierDoc.exists) {
    throw new functions.https.HttpsError(
      "not-found",
      "Soldier not found"
    );
  }

  const soldier = soldierDoc.data();

  // Create PDF
  const doc = new PDFDocument();
  const chunks = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  // Header
  doc.fontSize(20).text("Equipment Release Form", { align: "center" });
  doc.moveDown();

  // Date and Reason
  doc.fontSize(12);
  doc.text(`Date: ${new Date().toLocaleDateString()}`);
  doc.text(`Reason for Release: ${reason}`);
  doc.moveDown();

  // Soldier Information
  doc.fontSize(14).text("Soldier Information", { underline: true });
  doc.fontSize(12);
  doc.text(`Name: ${soldier.first_name} ${soldier.last_name}`);
  doc.text(`Soldier ID: ${soldier.soldier_id}`);
  doc.text(`Division: ${soldier.division_name || "N/A"}`);
  doc.moveDown();

  // Released Items
  doc.fontSize(14).text("Released Items", { underline: true });
  doc.fontSize(12);

  if (releasedItems.length === 0) {
    doc.text("No items specified for release.");
  } else {
    releasedItems.forEach((item) => {
      doc.text(`• ${item.type}: ${item.name} (ID: ${item.id}) - Condition: ${item.condition || "Good"}`);
    });
  }

  doc.moveDown(2);

  // Certification
  doc.fontSize(14).text("Certification", { underline: true });
  doc.fontSize(11);
  doc.text("I certify that all equipment listed above has been returned in the condition noted.");
  doc.moveDown(2);

  // Signature Lines
  doc.text("Soldier Signature: _______________________________  Date: _______________");
  doc.moveDown();
  doc.text("Receiving Officer: _______________________________  Date: _______________");
  doc.moveDown();
  doc.text("Witness: ________________________________________  Date: _______________");

  // Footer
  doc.moveDown(2);
  doc.fontSize(10).text("This document was generated electronically by the Armory Management System", {
    align: "center",
  });

  // Finalize PDF
  doc.end();

  // Convert to base64
  const buffer = Buffer.concat(chunks);
  const base64 = buffer.toString("base64");

  return {
    pdf_base64: base64,
    filename: `release_form_${soldierID}_${Date.now()}.pdf`,
    soldier,
  };
}

/**
 * Generate a release form PDF
 */
exports.generateReleaseForm = functions
  .runWith({ serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
  .https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  const { soldierID, releasedItems = [], reason = "End of Service" } = data;

  if (!soldierID) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Soldier ID is required"
    );
  }

  try {
    const result = await generateReleaseFormPDF(soldierID, releasedItems, reason);
    return {
      success: true,
      pdf_base64: result.pdf_base64,
      filename: result.filename,
    };
  } catch (error) {
    console.error("Error generating release form:", error);
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
    console.error("Error sending signing form:", error);
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
      allCurrentItems.push({
        type: 'Drone',
        name: data.set_type,
        id: data.set_serial_number,
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
    const newItemIds = assignedItems.map(item => item.id || item.displayId);
    const previousItems = allCurrentItems.filter(item => !newItemIds.includes(item.id));

    // Format date and time
    const now = new Date();
    const dateStr = now.toLocaleDateString('he-IL');
    const timeStr = now.toLocaleTimeString('he-IL');

    // Embed signature directly as base64 data URI
    const signatureHtml = signatureData
      ? `<img src="${signatureData}" alt="Soldier Signature" style="max-width:100%;max-height:100px;" />`
      : '<p><em>No signature provided</em></p>';

    // Build items table rows for newly assigned items
    let newItemsTableRows = '';
    if (assignedItems.length === 0) {
      newItemsTableRows = '<tr><td colspan="5">אין פריטים שנחתמו</td></tr>';
    } else {
      newItemsTableRows = assignedItems.map((item, index) =>
        `<tr>
          <td>${index + 1}</td>
          <td>${item.type || item.itemType || ''}</td>
          <td>${item.name || item.displayName || ''}</td>
          <td>${item.id || item.displayId || ''}</td>
          <td>${item.status || 'Assigned'}</td>
        </tr>`
      ).join('');
    }

    // Build items table rows for previous items
    let previousItemsHtml = '';
    if (previousItems.length === 0) {
      previousItemsHtml = '<p><strong>לא היה ציוד קודם ברשות החייל.</strong></p>';
    } else {
      const previousItemsTableRows = previousItems.map((item, index) =>
        `<tr>
          <td>${index + 1}</td>
          <td>${item.type}</td>
          <td>${item.name}</td>
          <td>${item.id}</td>
          <td>${item.status}</td>
        </tr>`
      ).join('');
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

    // Send email with HTML formatted signing form
    const msg = {
      to: soldier.email,
      from: functions.config().sendgrid?.from_email || "noreply@armory.com",
      subject: `טופס חתימה על ציוד - Equipment Assignment Form - ${soldier.first_name} ${soldier.last_name}`,
      html: `<!DOCTYPE html>
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
                .signature-box img { max-width: 100%; max-height: 100px; object-fit: contain; }
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
        </html>
      `,
    };

    await sgMail.send(msg);

    return { success: true, message: `Signing form sent to ${soldier.email}` };
  } catch (error) {
    console.error("Error sending signing form:", error);
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

  const { activityID } = data;

  if (!activityID) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Activity ID is required"
    );
  }

  try {
    // Get activity log
    const activityDoc = await db.collection("activity_logs").doc(activityID).get();
    
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

    // Generate release form using helper function
    const formResult = await generateReleaseFormPDF(
      soldierID,
      activity.details?.released_items || activity.context?.unassignedItems || [],
      activity.details?.reason || "Activity-based release"
    );

    // Get soldier email
    if (!formResult.soldier.email) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Soldier does not have an email address"
      );
    }

    // Send email with HTML formatted release form
    const soldier = formResult.soldier;
    const releasedItems = activity.details?.released_items || activity.context?.unassignedItems || [];
    const reason = activity.details?.reason || "Activity-based release";

    // Get all remaining equipment for the soldier AFTER release
    const [weapons, gear, drones, equipment] = await Promise.all([
      db.collection("weapons").where("assigned_to", "==", soldierID).get(),
      db.collection("serialized_gear").where("assigned_to", "==", soldierID).get(),
      db.collection("drone_sets").where("assigned_to", "==", soldierID).get(),
      db.collection("equipment").where("assigned_to", "==", soldierID).get(),
    ]);

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
      remainingItems.push({
        type: 'Drone',
        name: data.set_type,
        id: data.set_serial_number,
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

    // Get signature from activity if available - embed directly as base64 data URI
    const signatureData = activity.context?.signature || '';
    const signatureHtml = signatureData
      ? `<img src="${signatureData}" alt="Soldier Signature" style="max-width:100%;max-height:100px;" />`
      : '<p><em>No signature provided</em></p>';

    // Build items table rows for released items
    let itemsTableRows = '';
    if (releasedItems.length === 0) {
      itemsTableRows = '<tr><td colspan="5">אין פריטים ששוחררו</td></tr>';
    } else {
      itemsTableRows = releasedItems.map((item, index) =>
        `<tr>
          <td>${index + 1}</td>
          <td>${item.type || item.itemType || ''}</td>
          <td>${item.name || item.displayName || ''}</td>
          <td>${item.id || item.displayId || ''}</td>
          <td>Released</td>
        </tr>`
      ).join('');
    }

    // Build HTML for remaining items
    let remainingItemsHtml = '';
    if (remainingItems.length === 0) {
      remainingItemsHtml = '<p><strong>לא נותר ציוד ברשות החייל.</strong></p>';
    } else {
      const remainingItemsTableRows = remainingItems.map((item, index) =>
        `<tr>
          <td>${index + 1}</td>
          <td>${item.type}</td>
          <td>${item.name}</td>
          <td>${item.id}</td>
          <td>${item.status}</td>
        </tr>`
      ).join('');
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

    const msg = {
      to: soldier.email,
      from: functions.config().sendgrid?.from_email || "noreply@armory.com",
      subject: `טופס שחרור ציוד - Equipment Release Form - ${soldier.first_name} ${soldier.last_name}`,
      html: `<!DOCTYPE html>
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
                .items-table th, .items-table td { border: 1px solid #666; padding: 8px; text-align: right; font-size: 11px; }
                .items-table th { background-color: #f5f5f5; font-weight: bold; }
                .released-items { background-color: #fffbe6; }
                .remaining-items { background-color: #f0f9ff; }
                .signature-box { border: 1px solid #666; min-height: 120px; padding: 10px; margin-top: 10px; display: flex; align-items: center; justify-content: center; background: #fafafa; }
                .signature-box img { max-width: 100%; max-height: 100px; object-fit: contain; }
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
        </html>
      `,
    };

    await sgMail.send(msg);

    return { success: true, message: `Release form sent to ${soldier.email}` };
  } catch (error) {
    console.error("Error sending release form:", error);
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