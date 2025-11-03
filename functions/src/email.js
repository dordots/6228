const functions = require("firebase-functions");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

const db = admin.firestore();

// Initialize SendGrid with API key from environment config
// Set this with: firebase functions:config:set sendgrid.api_key="YOUR_API_KEY"
const sendGridApiKey = functions.config().sendgrid?.api_key;
if (sendGridApiKey) {
  sgMail.setApiKey(sendGridApiKey);
}

/**
 * Send email via SendGrid
 */
exports.sendEmailViaSendGrid = functions
  .runWith({ serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
  .https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  const { to, subject, html, text, from, attachments } = data;

  if (!to || !subject || (!html && !text)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required email fields"
    );
  }

  if (!sendGridApiKey) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "SendGrid API key not configured"
    );
  }

  try {
    const msg = {
      to,
      from: from || functions.config().sendgrid?.from_email || "noreply@armory.com",
      subject,
      text: text || "",
      html: html || text || "",
    };

    if (attachments && attachments.length > 0) {
      msg.attachments = attachments;
    }

    await sgMail.send(msg);

    // Log the email activity
    await db.collection("activity_logs").add({
      entity_type: "email",
      action: "sent",
      performed_by: context.auth.uid,
      details: {
        to,
        subject,
        timestamp: new Date().toISOString(),
      },
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, message: "Email sent successfully" };
  } catch (error) {
    throw new functions.https.HttpsError(
      "internal",
      `Failed to send email: ${error.message}`
    );
  }
});

/**
 * Test SendGrid configuration
 */
exports.testSendGrid = functions
  .runWith({ serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
  .https.onCall(async (data, context) => {
  // Check if user is authenticated and is admin
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  if (context.auth.token.role !== "admin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only admins can test SendGrid"
    );
  }

  const { email } = data;
  if (!email) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Email address is required"
    );
  }

  if (!sendGridApiKey) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "SendGrid API key not configured"
    );
  }

  try {
    const msg = {
      to: email,
      from: functions.config().sendgrid?.from_email || "noreply@armory.com",
      subject: "Armory System - SendGrid Test",
      html: `
        <h2>SendGrid Test Email</h2>
        <p>This is a test email from the Armory System.</p>
        <p>If you received this email, SendGrid is configured correctly.</p>
        <hr>
        <p><small>Sent at: ${new Date().toISOString()}</small></p>
      `,
    };

    await sgMail.send(msg);

    return { success: true, message: `Test email sent to ${email}` };
  } catch (error) {
    throw new functions.https.HttpsError(
      "internal",
      `SendGrid test failed: ${error.message}`
    );
  }
});

/**
 * Send daily report
 */
exports.sendDailyReport = functions
  .runWith({ serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
  .https.onCall(async (data, context) => {
  // Check if user is authenticated and has proper role
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  if (!["admin", "manager"].includes(context.auth.token.role)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only admins and managers can send daily reports"
    );
  }

  if (!sendGridApiKey) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "SendGrid API key not configured"
    );
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Gather statistics
    const [
      soldiersSnapshot,
      equipmentSnapshot,
      weaponsSnapshot,
      gearSnapshot,
      verificationsSnapshot,
    ] = await Promise.all([
      db.collection("soldiers").get(),
      db.collection("equipment").where("status", "==", "assigned").get(),
      db.collection("weapons").where("status", "==", "assigned").get(),
      db.collection("serialized_gear").where("status", "==", "assigned").get(),
      db.collection("daily_verifications")
        .where("created_at", ">=", today)
        .get(),
    ]);

    // Get activity logs for today
    const activitySnapshot = await db.collection("activity_logs")
      .where("created_at", ">=", today)
      .orderBy("created_at", "desc")
      .limit(10)
      .get();

    const activities = activitySnapshot.docs.map(doc => {
      const data = doc.data();
      return `${data.action} - ${data.entity_type} - ${new Date(data.created_at.toDate()).toLocaleTimeString()}`;
    });

    const htmlContent = `
      <h2>Daily Armory Report - ${today.toLocaleDateString()}</h2>
      
      <h3>Summary Statistics</h3>
      <table style="border-collapse: collapse; width: 100%;">
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;"><strong>Total Soldiers:</strong></td>
          <td style="border: 1px solid #ddd; padding: 8px;">${soldiersSnapshot.size}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;"><strong>Equipment Assigned:</strong></td>
          <td style="border: 1px solid #ddd; padding: 8px;">${equipmentSnapshot.size}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;"><strong>Weapons Assigned:</strong></td>
          <td style="border: 1px solid #ddd; padding: 8px;">${weaponsSnapshot.size}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;"><strong>Serialized Gear Assigned:</strong></td>
          <td style="border: 1px solid #ddd; padding: 8px;">${gearSnapshot.size}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;"><strong>Daily Verifications:</strong></td>
          <td style="border: 1px solid #ddd; padding: 8px;">${verificationsSnapshot.size}</td>
        </tr>
      </table>
      
      <h3>Recent Activities</h3>
      <ul>
        ${activities.map(activity => `<li>${activity}</li>`).join('')}
      </ul>
      
      <hr>
      <p><small>Report generated at: ${new Date().toISOString()}</small></p>
    `;

    const reportEmail = functions.config().sendgrid?.report_email || data.email;
    
    if (!reportEmail) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "No report email configured or provided"
      );
    }

    const msg = {
      to: reportEmail,
      from: functions.config().sendgrid?.from_email || "noreply@armory.com",
      subject: `Daily Armory Report - ${today.toLocaleDateString()}`,
      html: htmlContent,
    };

    await sgMail.send(msg);

    return { 
      success: true, 
      message: `Daily report sent to ${reportEmail}`,
      statistics: {
        soldiers: soldiersSnapshot.size,
        equipmentAssigned: equipmentSnapshot.size,
        weaponsAssigned: weaponsSnapshot.size,
        gearAssigned: gearSnapshot.size,
        verifications: verificationsSnapshot.size,
      }
    };
  } catch (error) {
    throw new functions.https.HttpsError(
      "internal",
      `Failed to send daily report: ${error.message}`
    );
  }
});