// Base44 Function: sendSigningForm
// This is the actual implementation running on Base44 servers

import { createClientFromRequest } from "npm:@base44/sdk@0.7.0";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { activityId, soldier } = await req.json();

    if (!soldier || !activityId) {
      return Response.json({ error: "Missing required data" }, { status: 400 });
    }

    const activity = await base44.asServiceRole.entities.ActivityLog.get(
      activityId
    );
    if (!activity) {
      return Response.json({ error: "Activity not found" }, { status: 404 });
    }

    const html = await generateSigningHtml(base44, activity, soldier);

    let soldierEmailResult = { sent: false, method: null, error: null };

    // UNIFIED SENDING LOGIC: Always use direct SendGrid fetch for the soldier's email if it exists.
    if (soldier.email) {
      try {
        console.log(
          `[sendSigningForm] Attempting to send email to soldier ${soldier.email} via SendGrid.`
        );
        const sendGridApiKey = Deno.env.get("SENDGRID_API_KEY");
        const sendGridFromEmail = Deno.env.get("SENDGRID_FROM_EMAIL");

        if (!sendGridApiKey || !sendGridFromEmail) {
          throw new Error("SendGrid is not configured on the server.");
        }

        const emailData = {
          personalizations: [
            {
              to: [{ email: soldier.email }],
              subject: `טופס חתימה על ציוד - ${soldier.first_name} ${soldier.last_name}`,
            },
          ],
          from: { email: sendGridFromEmail, name: "ARMORY Equipment System" },
          content: [{ type: "text/html", value: html }],
        };

        const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sendGridApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(emailData),
        });

        if (!res.ok) {
          const resText = await res.text();
          throw new Error(`SendGrid API error ${res.status}: ${resText}`);
        }

        soldierEmailResult = {
          sent: true,
          method: "SendGrid (Direct)",
          error: null,
        };
        console.log(
          "[sendSigningForm] SendGrid email to soldier sent successfully."
        );
      } catch (error) {
        console.error(
          "[sendSigningForm] Direct SendGrid email to soldier failed:",
          error
        );
        soldierEmailResult = {
          sent: false,
          method: "SendGrid (Direct)",
          error: error.message,
        };
      }
    } else {
      console.log("[sendSigningForm] No email address provided for soldier.");
      soldierEmailResult = {
        sent: false,
        method: null,
        error: "No email address",
      };
    }

    // Always send a copy to the user who performed the action
    console.log(
      `[sendSigningForm] Sending copy of form to performing user: ${user.email}`
    );
    await base44.integrations.Core.SendEmail({
      to: user.email,
      subject: `${
        soldierEmailResult.sent ? "Copy:" : "FORM FOR SOLDIER:"
      } Equipment Assignment - ${soldier.first_name} ${soldier.last_name}`,
      body: `
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; font-family: Arial, sans-serif;">
                    <h2 style="color: #333; margin-bottom: 15px;">📋 Equipment Assignment Form</h2>
                    
                    <div style="background: ${
                      soldierEmailResult.sent ? "#d4edda" : "#fff3cd"
                    }; padding: 15px; border-radius: 5px; border-left: 4px solid ${
        soldierEmailResult.sent ? "#28a745" : "#ffc107"
      };">
                        <h3 style="margin: 0 0 10px 0; color: #333;">📧 Email Status:</h3>
                        <p style="margin: 0; font-size: 14px;">
                            <strong>Soldier:</strong> ${soldier.first_name} ${
        soldier.last_name
      } (${soldier.soldier_id})<br>
                            <strong>Email:</strong> ${
                              soldier.email || "Not provided"
                            }<br>
                            <strong>Status:</strong> ${
                              soldierEmailResult.sent
                                ? `✅ Form sent via ${soldierEmailResult.method}`
                                : `⚠️ Form NOT sent - ${
                                    soldierEmailResult.error ||
                                    "No email address"
                                  }`
                            }
                        </p>
                        ${
                          !soldierEmailResult.sent && soldier.email
                            ? `
                            <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                                <strong>💡 Email delivery failed via ${soldierEmailResult.method}:</strong><br>
                                ${soldierEmailResult.error}<br>
                                Please share this form manually with the soldier.
                            </div>
                        `
                            : ""
                        }
                    </div>
                    
                    <div style="margin-top: 15px; padding: 10px; background: #e9ecef; border-radius: 4px;">
                        <strong>🗓️ Generated:</strong> ${new Date().toLocaleString()}<br>
                        <strong>👤 By:</strong> ${user.full_name || user.email}
                    </div>
                </div>
                
                <hr style="margin: 30px 0; border: none; border-top: 2px solid #dee2e6;">
                
                ${html}
            `,
    });

    return Response.json({
      success: true,
      soldierEmailResult: soldierEmailResult,
      message: soldierEmailResult.sent
        ? `Form sent to both you and the soldier via ${soldierEmailResult.method}`
        : "Form sent to you only - soldier email delivery failed",
    });
  } catch (error) {
    console.error("[sendSigningForm] Top-level error:", error);
    return Response.json(
      { error: "Failed to send signing form", details: error.message },
      { status: 500 }
    );
  }
});

async function generateSigningHtml(base44, activity, soldier) {
  // Extract assigned items from context
  const context = activity.context || {};
  const contextItems = context.assignedItems || [];

  // --- Fetch Total Equipment After Assignment to determine what was previous ---
  const [totalWeapons, totalGear, totalDrones, totalEquipment] =
    await Promise.all([
      base44.asServiceRole.entities.Weapon.filter({
        assigned_to: soldier.soldier_id,
      }),
      base44.asServiceRole.entities.SerializedGear.filter({
        assigned_to: soldier.soldier_id,
      }),
      base44.asServiceRole.entities.DroneSet.filter({
        assigned_to: soldier.soldier_id,
      }),
      base44.asServiceRole.entities.Equipment.filter({
        assigned_to: soldier.soldier_id,
      }),
    ]);

  const newItemIds = new Set(
    contextItems.map((item) => item.id).filter(Boolean)
  );

  const allItems = [];
  if (Array.isArray(totalWeapons)) {
    totalWeapons.forEach((i) =>
      allItems.push({
        id: i.id,
        type: "Weapon",
        name: i.weapon_type,
        serialId: i.weapon_id,
        status: i.status,
      })
    );
  }
  if (Array.isArray(totalGear)) {
    totalGear.forEach((i) =>
      allItems.push({
        id: i.id,
        type: "Serialized Gear",
        name: i.gear_type,
        serialId: i.gear_id,
        status: i.status,
      })
    );
  }
  if (Array.isArray(totalDrones)) {
    totalDrones.forEach((i) =>
      allItems.push({
        id: i.id,
        type: "Drone Set",
        name: i.set_type,
        serialId: i.set_serial_number,
        status: i.status,
      })
    );
  }
  if (Array.isArray(totalEquipment)) {
    totalEquipment.forEach((i) => {
      const isNew = contextItems.some(
        (ci) =>
          ci.type === "Equipment" &&
          ci.name === i.equipment_type &&
          ci.quantity === i.quantity
      );
      allItems.push({
        id: i.id,
        type: "Equipment",
        name: i.equipment_type,
        serialId: `Qty: ${i.quantity}`,
        status: i.condition,
        isNew: isNew,
      });
    });
  }

  const assignedInThisEvent = allItems.filter(
    (item) => newItemIds.has(item.id) || item.isNew
  );
  const previouslyAssignedItems = allItems.filter(
    (item) => !newItemIds.has(item.id) && !item.isNew
  );

  const signatureDataUrl = context.signature || null;
  const activityDate = new Date(
    activity.client_timestamp || activity.created_date
  );
  const dateStr = activityDate.toLocaleDateString("en-GB");
  const timeStr = activityDate.toLocaleTimeString("en-GB");

  return `<!DOCTYPE html>
        <html lang="he" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>Equipment Assignment Form</title>
            <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap" rel="stylesheet">
            <style>
                @page { size: A4; margin: 0.5in; } * { box-sizing: border-box; } body { font-family: 'Heebo', Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #000; direction: rtl; text-align: right; margin: 0; padding: 20px; background: white; } .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; } .header h1 { font-size: 24px; font-weight: bold; margin: 0 0 5px 0; direction: ltr; } .header h2 { font-size: 20px; font-weight: bold; margin: 0; direction: rtl; } .section { margin-bottom: 25px; border: 1px solid #ddd; padding: 15px; page-break-inside: avoid; } .section h3 { font-size: 16px; font-weight: bold; margin: 0 0 10px 0; border-bottom: 1px solid #ccc; padding-bottom: 5px; } .info-row { margin-bottom: 8px; } .info-row strong { font-weight: 600; } .items-table { width: 100%; border-collapse: collapse; margin-top: 15px; } .items-table th, .items-table td { border: 1px solid #666; padding: 8px; text-align: right; font-size: 11px; } .items-table th { background-color: #f5f5f5; font-weight: bold; } .assigned-items { background-color: #f0fff4; } .total-items { background-color: #f0f9ff; } .signature-box { border: 1px solid #666; min-height: 120px; padding: 10px; margin-top: 10px; display: flex; align-items: center; justify-content: center; background: #fafafa; } .signature-box img { max-width: 100%; max-height: 100px; object-fit: contain; } .footer { margin-top: 30px; font-size: 10px; color: #666; text-align: center; border-top: 1px solid #ddd; padding-top: 10px; }
            </style>
        </head>
        <body>
            <div class="header"><h1>Equipment Assignment Form</h1><h2>טופס חתימה על ציוד</h2></div>
            <div class="section"><h3>פרטי הפעילות - Activity Details</h3><div class="info-row"><strong>תאריך:</strong> ${dateStr} בשעה ${timeStr}</div><div class="info-row"><strong>מאושר על ידי:</strong> ${
    activity.user_full_name || "System"
  }</div></div>
            <div class="section"><h3>פרטי החייל - Soldier Information</h3><div class="info-row"><strong>שם:</strong> ${
              soldier.first_name
            } ${
    soldier.last_name
  }</div><div class="info-row"><strong>מספר אישי:</strong> ${
    soldier.soldier_id
  }</div><div class="info-row"><strong>יחידה:</strong> ${
    soldier.division_name || "לא שויך"
  }</div></div>
            <div class="section assigned-items">
                <h3>ציוד שנחתם באירוע זה - Equipment Assigned in This Event (${
                  assignedInThisEvent.length
                } items)</h3>
                ${
                  assignedInThisEvent.length > 0
                    ? `<table class="items-table"><thead><tr><th>#</th><th>סוג</th><th>שם הפריט</th><th>מספר סידורי</th><th>סטטוס</th></tr></thead><tbody>
                        ${assignedInThisEvent
                          .map(
                            (item, index) =>
                              `<tr><td>${index + 1}</td><td>${
                                item.type
                              }</td><td>${item.name}</td><td>${
                                item.serialId
                              }</td><td>${item.status}</td></tr>`
                          )
                          .join("")}
                    </tbody></table>`
                    : "<p><strong>לא נחתם ציוד באירוע זה.</strong></p>"
                }
            </div>
            <div class="section total-items">
                <h3>ציוד קודם ברשות החייל - Previously Assigned Equipment (${
                  previouslyAssignedItems.length
                } items)</h3>
                ${
                  previouslyAssignedItems.length > 0
                    ? `<table class="items-table"><thead><tr><th>#</th><th>סוג</th><th>שם הפריט</th><th>מספר סידורי</th><th>סטטוס</th></tr></thead><tbody>
                        ${previouslyAssignedItems
                          .map(
                            (item, index) =>
                              `<tr><td>${index + 1}</td><td>${
                                item.type
                              }</td><td>${item.name}</td><td>${
                                item.serialId
                              }</td><td>${item.status}</td></tr>`
                          )
                          .join("")}
                    </tbody></table>`
                    : "<p><strong>לא היה ציוד קודם ברשות החייל.</strong></p>"
                }
            </div>
            <div class="section">
                <h3>חתימת החייל - Soldier Signature</h3>
                <div class="signature-box">${
                  signatureDataUrl
                    ? `<img src="${signatureDataUrl}" alt="Soldier Signature" style="max-width:100%;max-height:100px;" />`
                    : `<p><em>לא סופקה חתימה עבור חתימה זו</em></p>`
                }</div>
            </div>
            <div class="footer"><p>נוצר ב-${new Date().toLocaleString(
              "he-IL"
            )}</p></div>
        </body></html>`;
}
