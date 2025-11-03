// Base44 Function: sendReleaseFormByActivity
// This is the actual implementation running on Base44 servers

import { createClientFromRequest } from "npm:@base44/sdk@0.7.0";

// This is the main function that will be served.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { activityId } = await req.json();
    if (!activityId) {
      return new Response(
        JSON.stringify({ error: "Activity ID is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const activity = await base44.asServiceRole.entities.ActivityLog.get(
      activityId
    );
    if (!activity) {
      return new Response(JSON.stringify({ error: "Activity not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const soldierId = activity.soldier_id;
    if (!soldierId) {
      return new Response(
        JSON.stringify({ error: "No soldier ID found in activity log" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const soldiers = await base44.asServiceRole.entities.Soldier.filter({
      soldier_id: soldierId,
    });
    const soldier = soldiers[0];
    if (!soldier) {
      return new Response(JSON.stringify({ error: "Soldier not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const html = await generateHtml(base44, activity, soldier);

    let soldierEmailResult = { sent: false, method: null, error: null };

    // UNIFIED SENDING LOGIC: Always use direct SendGrid fetch for the soldier's email if it exists.
    if (soldier.email) {
      try {
        const sendGridApiKey = Deno.env.get("SENDGRID_API_KEY");
        const sendGridFromEmail = Deno.env.get("SENDGRID_FROM_EMAIL");

        if (!sendGridApiKey || !sendGridFromEmail) {
          throw new Error("SendGrid is not configured on the server.");
        }

        const emailData = {
          personalizations: [
            {
              to: [{ email: soldier.email }],
              subject: `טופס שחרור ציוד - ${soldier.first_name} ${soldier.last_name}`,
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
      } catch (error) {
        soldierEmailResult = {
          sent: false,
          method: "SendGrid (Direct)",
          error: error.message,
        };
      }
    } else {
      soldierEmailResult = {
        sent: false,
        method: null,
        error: "No email address",
      };
    }

    // Always send a copy to the user who performed the action
    await base44.integrations.Core.SendEmail({
      to: user.email,
      subject: `עותק: טופס שחרור ציוד עבור ${soldier.first_name} ${soldier.last_name}`,
      body: `
                <p style="text-align: right; direction: rtl; font-family: Heebo, Arial, sans-serif;">
                    <b>הערה:</b> זהו עותק של טופס שחרור הציוד עבור <b>${
                      soldier.first_name
                    } ${soldier.last_name} (${soldier.soldier_id})</b>.
                    <br>
                    ${
                      soldierEmailResult.sent
                        ? `הטופס נשלח לחייל בהצלחה באמצעות ${soldierEmailResult.method} לכתובת ${soldier.email}.`
                        : soldier.email
                        ? `הטופס לא נשלח לחייל לכתובת ${soldier.email} - שגיאה: ${soldierEmailResult.error}`
                        : "הטופס לא נשלח לחייל מכיוון שאין כתובת מייל רשומה עבורו."
                    }
                </p>
                <hr>
                ${html}
            `,
    });

    // The frontend expects a `soldierReceived` boolean
    return new Response(
      JSON.stringify({
        success: true,
        soldierReceived: soldierEmailResult.sent, // This is the key change for the frontend
        details: soldierEmailResult,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// This function generates the HTML content for the email body.
async function generateHtml(base44, activity, soldier) {
  const context = activity.context || {};
  const unassignedItems = context.unassignedItems || [];
  const releasedItems = [];

  for (const item of unassignedItems) {
    let serialId = "N/A";
    if (item.type === "Weapon") {
      try {
        const w = await base44.asServiceRole.entities.Weapon.get(item.id);
        serialId = w?.weapon_id || item.id || "N/A";
      } catch {
        serialId = item.id || "N/A";
      }
    } else if (item.type === "Gear" || item.type === "Serialized Gear") {
      try {
        const g = await base44.asServiceRole.entities.SerializedGear.get(
          item.id
        );
        serialId = g?.gear_id || item.id || "N/A";
      } catch {
        serialId = item.id || "N/A";
      }
    } else if (item.type === "Drone" || item.type === "Drone Set") {
      try {
        const ds = await base44.asServiceRole.entities.DroneSet.get(item.id);
        serialId = ds?.set_serial_number || item.id || "N/A";
      } catch {
        serialId = item.id || "N/A";
      }
    } else if (item.type === "Equipment") {
      serialId = `Qty: ${item.quantity || 1}`;
    }
    releasedItems.push({
      type: item.type,
      name: item.name,
      serialId: serialId,
      status: "Released",
    });
  }

  // NEW: Fetch Remaining Items After Release
  const remainingItems = [];
  const [remainingWeapons, remainingGear, remainingDrones, remainingEquipment] =
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

  if (Array.isArray(remainingWeapons))
    remainingWeapons.forEach((i) =>
      remainingItems.push({
        type: "Weapon",
        name: i.weapon_type,
        serialId: i.weapon_id,
        status: i.status,
      })
    );
  if (Array.isArray(remainingGear))
    remainingGear.forEach((i) =>
      remainingItems.push({
        type: "Serialized Gear",
        name: i.gear_type,
        serialId: i.gear_id,
        status: i.status,
      })
    );
  if (Array.isArray(remainingDrones))
    remainingDrones.forEach((i) =>
      remainingItems.push({
        type: "Drone Set",
        name: i.set_type,
        serialId: i.set_serial_number,
        status: i.status,
      })
    );
  if (Array.isArray(remainingEquipment))
    remainingEquipment.forEach((i) =>
      remainingItems.push({
        type: "Equipment",
        name: i.equipment_type,
        serialId: `Qty: ${i.quantity}`,
        status: i.condition,
      })
    );

  // FIXED: Proper signature extraction from context
  let signatureDataUrl = null;
  if (context.signature) {
    signatureDataUrl = context.signature;
  }

  const activityDate = new Date(activity.created_date);
  const dateStr = activityDate.toLocaleDateString("en-US");
  const timeStr = activityDate.toLocaleTimeString("en-US");

  return `<!DOCTYPE html>
        <html lang="he" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>Equipment Release Form</title>
            <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap" rel="stylesheet">
            <style>
                @page { size: A4; margin: 0.5in; } * { box-sizing: border-box; } body { font-family: 'Heebo', Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #000; direction: rtl; text-align: right; margin: 0; padding: 20px; background: white; } .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; } .header h1 { font-size: 24px; font-weight: bold; margin: 0 0 5px 0; direction: ltr; } .header h2 { font-size: 20px; font-weight: bold; margin: 0; direction: rtl; } .section { margin-bottom: 25px; border: 1px solid #ddd; padding: 15px; page-break-inside: avoid; } .section h3 { font-size: 16px; font-weight: bold; margin: 0 0 10px 0; border-bottom: 1px solid #ccc; padding-bottom: 5px; } .info-row { margin-bottom: 8px; } .info-row strong { font-weight: 600; } .items-table { width: 100%; border-collapse: collapse; margin-top: 15px; } .items-table th, .items-table td { border: 1px solid #666; padding: 8px; text-align: right; font-size: 11px; } .items-table th { background-color: #f5f5f5; font-weight: bold; } .released-items { background-color: #fffbe6; } .remaining-items { background-color: #f0f9ff; } .signature-box { border: 1px solid #666; min-height: 120px; padding: 10px; margin-top: 10px; display: flex; align-items: center; justify-content: center; background: #fafafa; } .signature-box img { max-width: 100%; max-height: 100px; object-fit: contain; } .footer { margin-top: 30px; font-size: 10px; color: #666; text-align: center; border-top: 1px solid #ddd; padding-top: 10px; }
            </style>
        </head>
        <body>
            <div class="header"><h1>Equipment Release Form</h1><h2>טופס שחרור ציוד</h2></div>
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
            <div class="section released-items">
                <h3>ציוד ששוחרר באירוע זה - Equipment Released in This Event (${
                  releasedItems.length
                } items)</h3>
                ${
                  releasedItems.length > 0
                    ? `<table class="items-table"><thead><tr><th>#</th><th>סוג</th><th>שם הפריט</th><th>מספר סידורי</th><th>סטטוס</th></tr></thead><tbody>
                        ${releasedItems
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
                    : "<p><strong>לא שוחרר ציוד באירוע זה.</strong></p>"
                }
            </div>
            <div class="section remaining-items">
                <h3>סה"כ ציוד שנותר אצל החייל - Total Equipment Remaining with Soldier (${
                  remainingItems.length
                } items)</h3>
                ${
                  remainingItems.length > 0
                    ? `<table class="items-table"><thead><tr><th>#</th><th>סוג</th><th>שם הפריט</th><th>מספר סידורי</th><th>סטטוס</th></tr></thead><tbody>
                        ${remainingItems
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
                    : "<p><strong>לא נותר ציוד ברשות החייל.</strong></p>"
                }
            </div>
            <div class="section">
                <h3>חתימת החייל - Soldier Signature</h3>
                <div class="signature-box">${
                  signatureDataUrl
                    ? `<img src="${signatureDataUrl}" alt="Soldier Signature" style="max-width:100%;max-height:100px;" />`
                    : `<p><em>לא סופקה חתימה עבור שחרור זה</em></p>`
                }</div>
            </div>
            <div class="footer"><p>נוצר ב-${new Date().toLocaleString(
              "he-IL"
            )}</p></div>
        </body></html>`;
}
