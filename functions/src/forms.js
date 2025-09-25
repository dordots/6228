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
      success: true,
      pdf_base64: base64,
      filename: `release_form_${soldierID}_${Date.now()}.pdf`,
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
    const soldierID = activity.details?.soldier_id;
    
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

    // Generate release form
    const formResult = await exports.generateReleaseForm.run(
      { 
        data: { 
          soldierID, 
          releasedItems: activity.details?.released_items || [],
          reason: activity.details?.reason || "Activity-based release"
        }, 
        auth: context.auth 
      },
      context
    );

    // Send email
    const msg = {
      to: soldier.email,
      from: functions.config().sendgrid?.from_email || "noreply@armory.com",
      subject: `Equipment Release Form - ${soldier.first_name} ${soldier.last_name}`,
      html: `
        <h2>Equipment Release Form</h2>
        <p>Dear ${soldier.first_name} ${soldier.last_name},</p>
        <p>Please find attached your equipment release form based on recent activity.</p>
        <p>Please review and sign the form to confirm the equipment release.</p>
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