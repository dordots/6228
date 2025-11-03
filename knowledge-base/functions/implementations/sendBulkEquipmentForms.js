// Base44 Function: sendBulkEquipmentForms
// This is the actual implementation running on Base44 servers

import { createClientFromRequest } from "npm:@base44/sdk@0.7.0";

// This function will be embedded directly to avoid import issues.
async function sendEmailViaSendGrid({
  to,
  subject,
  body,
  from_name,
  from_email,
}) {
  const sendGridApiKey = Deno.env.get("SENDGRID_API_KEY");
  const sendGridFromEmail = from_email || Deno.env.get("SENDGRID_FROM_EMAIL");

  if (!sendGridApiKey) {
    throw new Error("SendGrid API key not configured");
  }
  if (!sendGridFromEmail) {
    throw new Error(
      "SendGrid 'from' email not configured (SENDGRID_FROM_EMAIL environment variable missing)"
    );
  }

  const emailData = {
    personalizations: [{ to: [{ email: to }], subject: subject }],
    from: {
      email: sendGridFromEmail,
      name: from_name || "ARMORY Equipment System",
    },
    content: [{ type: "text/html", value: body }],
  };

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + sendGridApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emailData),
  });

  if (!res.ok) {
    const resText = await res.text();
    throw new Error("SendGrid API error " + res.status + ": " + resText);
  }
  return { success: true };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
    const SENDGRID_FROM_EMAIL = Deno.env.get("SENDGRID_FROM_EMAIL");

    if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
      return Response.json(
        {
          error: "SendGrid not configured",
          details:
            "Missing SENDGRID_API_KEY or SENDGRID_FROM_EMAIL environment variables.",
        },
        { status: 500 }
      );
    }

    // Get all soldiers, equipment, and registered app users
    const [
      allSoldiers,
      allWeapons,
      allGear,
      allDroneSets,
      allEquipment,
      allAppUsers,
    ] = await Promise.all([
      base44.asServiceRole.entities.Soldier.list(),
      base44.asServiceRole.entities.Weapon.list(),
      base44.asServiceRole.entities.SerializedGear.list(),
      base44.asServiceRole.entities.DroneSet.list(),
      base44.asServiceRole.entities.Equipment.list(),
      base44.asServiceRole.entities.User.list(),
    ]);

    const appUserEmails = new Set(
      allAppUsers.map((u) => u.email.toLowerCase())
    );

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const results = [];

    for (const soldier of allSoldiers) {
      try {
        // Get this soldier's assigned equipment
        const soldierWeapons = allWeapons.filter(
          (w) => w.assigned_to === soldier.soldier_id
        );
        const soldierGear = allGear.filter(
          (g) => g.assigned_to === soldier.soldier_id
        );
        const soldierDroneSets = allDroneSets.filter(
          (d) => d.assigned_to === soldier.soldier_id
        );
        const soldierEquipment = allEquipment.filter(
          (e) => e.assigned_to === soldier.soldier_id
        );

        const totalItems =
          soldierWeapons.length +
          soldierGear.length +
          soldierDroneSets.length +
          soldierEquipment.length;

        // Skip soldiers with no equipment
        if (totalItems === 0) {
          skipCount++;
          results.push({
            soldier: `${soldier.first_name} ${soldier.last_name} (${soldier.soldier_id})`,
            status: "skipped",
            reason: "No assigned equipment",
          });
          continue;
        }

        // Skip soldiers without email
        if (!soldier.email) {
          skipCount++;
          results.push({
            soldier: `${soldier.first_name} ${soldier.last_name} (${soldier.soldier_id})`,
            status: "skipped",
            reason: "No email address",
          });
          continue;
        }

        // Generate HTML form for this soldier
        const html = generateEquipmentSummaryHtml(
          soldier,
          soldierWeapons,
          soldierGear,
          soldierDroneSets,
          soldierEquipment
        );

        const isRegisteredUser = appUserEmails.has(soldier.email.toLowerCase());
        let emailSent = false;
        let emailMethod = null;
        let emailError = null;

        // Send email - try Base44 first for registered users, otherwise use SendGrid
        try {
          if (isRegisteredUser) {
            await base44.integrations.Core.SendEmail({
              to: soldier.email,
              subject: `Equipment Assignment Form - ${soldier.first_name} ${soldier.last_name}`,
              body: html,
            });
            emailMethod = "Base44";
          } else {
            await sendEmailViaSendGrid({
              to: soldier.email,
              subject: `Equipment Assignment Form - ${soldier.first_name} ${soldier.last_name}`,
              body: html,
              from_name: "ARMORY Equipment System",
              from_email: SENDGRID_FROM_EMAIL,
            });
            emailMethod = "SendGrid";
          }
          emailSent = true;
        } catch (error) {
          emailError = error.message;
        }

        if (emailSent) {
          successCount++;
          results.push({
            soldier: `${soldier.first_name} ${soldier.last_name} (${soldier.soldier_id})`,
            status: "sent",
            method: emailMethod,
            itemCount: totalItems,
          });
        } else {
          errorCount++;
          results.push({
            soldier: `${soldier.first_name} ${soldier.last_name} (${soldier.soldier_id})`,
            status: "error",
            error: emailError,
          });
        }
      } catch (error) {
        errorCount++;
        results.push({
          soldier: `${soldier.first_name} ${soldier.last_name} (${soldier.soldier_id})`,
          status: "error",
          error: error.message,
        });
      }
    }

    return Response.json({
      success: true,
      summary: {
        total: allSoldiers.length,
        sent: successCount,
        skipped: skipCount,
        errors: errorCount,
      },
      results: results,
    });
  } catch (error) {
    return Response.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
});

function generateEquipmentSummaryHtml(
  soldier,
  weapons,
  gear,
  droneSets,
  equipment
) {
  const dateStr = new Date().toLocaleDateString("en-US");
  const timeStr = new Date().toLocaleTimeString("en-US");

  return `
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>Current Equipment Assignment</title>
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
            .weapons { background-color: #fef2f2; }
            .gear { background-color: #f3f4f6; }
            .drones { background-color: #eff6ff; }
            .equipment { background-color: #f0fdf4; }
            .footer { margin-top: 30px; font-size: 10px; color: #666; text-align: center; border-top: 1px solid #ddd; padding-top: 10px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Current Equipment Assignment</h1>
            <h2>רשימת ציוד נוכחי</h2>
        </div>
        
        <div class="section">
            <h3>פרטי החייל - Soldier Information</h3>
            <div class="info-row"><strong>שם:</strong> ${soldier.first_name} ${
    soldier.last_name
  }</div>
            <div class="info-row"><strong>מספר אישי:</strong> ${
              soldier.soldier_id
            }</div>
            <div class="info-row"><strong>יחידה:</strong> ${
              soldier.division_name || "לא שויך"
            }</div>
            <div class="info-row"><strong>תאריך הפקה:</strong> ${dateStr} בשעה ${timeStr}</div>
        </div>

        ${
          weapons.length > 0
            ? `
        <div class="section weapons">
            <h3>נשק - Weapons (${weapons.length} items)</h3>
            <table class="items-table">
                <thead>
                    <tr><th>#</th><th>סוג נשק</th><th>מספר סידורי</th><th>סטטוס</th></tr>
                </thead>
                <tbody>
                    ${weapons
                      .map(
                        (item, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${item.weapon_type}</td>
                            <td>${item.weapon_id}</td>
                            <td>${item.status}</td>
                        </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
        `
            : ""
        }

        ${
          gear.length > 0
            ? `
        <div class="section gear">
            <h3>ציוד מסודר - Serialized Gear (${gear.length} items)</h3>
            <table class="items-table">
                <thead>
                    <tr><th>#</th><th>סוג ציוד</th><th>מספר סידורי</th><th>סטטוס</th></tr>
                </thead>
                <tbody>
                    ${gear
                      .map(
                        (item, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${item.gear_type}</td>
                            <td>${item.gear_id}</td>
                            <td>${item.status}</td>
                        </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
        `
            : ""
        }

        ${
          droneSets.length > 0
            ? `
        <div class="section drones">
            <h3>מערכות רחפן - Drone Sets (${droneSets.length} items)</h3>
            <table class="items-table">
                <thead>
                    <tr><th>#</th><th>סוג מערכת</th><th>מספר סידורי</th><th>סטטוס</th></tr>
                </thead>
                <tbody>
                    ${droneSets
                      .map(
                        (item, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${item.set_type}</td>
                            <td>${item.set_serial_number}</td>
                            <td>${item.status}</td>
                        </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
        `
            : ""
        }

        ${
          equipment.length > 0
            ? `
        <div class="section equipment">
            <h3>ציוד כללי - Standard Equipment (${equipment.length} items)</h3>
            <table class="items-table">
                <thead>
                    <tr><th>#</th><th>סוג ציוד</th><th>כמות</th><th>מצב</th></tr>
                </thead>
                <tbody>
                    ${equipment
                      .map(
                        (item, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${item.equipment_type}</td>
                            <td>${item.quantity}</td>
                            <td>${item.condition}</td>
                        </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
        `
            : ""
        }

        <div class="footer">
            <p>נוצר ב-${new Date().toLocaleString(
              "he-IL"
            )} | Current Equipment Assignment Summary</p>
        </div>
    </body>
    </html>`;
}
