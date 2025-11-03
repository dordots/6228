// Base44 Function: sendDailyReport
// This is the actual implementation running on Base44 servers

import { createClientFromRequest } from "npm:@base44/sdk@0.7.0";
import { format } from "npm:date-fns@3.6.0";

// Helper for JSON responses
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get email address from request payload or use default
    const body = await req.json().catch(() => ({}));
    const recipientEmail = body.email;

    if (!recipientEmail) {
      return jsonResponse(
        {
          error: "Email address is required",
        },
        400
      );
    }

    // Load all data using service role for admin access
    const [
      soldiers,
      weapons,
      serializedGear,
      droneSets,
      droneComponents,
      equipment,
    ] = await Promise.allSettled([
      base44.asServiceRole.entities.Soldier.list(),
      base44.asServiceRole.entities.Weapon.list(),
      base44.asServiceRole.entities.SerializedGear.list(),
      base44.asServiceRole.entities.DroneSet.list(),
      base44.asServiceRole.entities.DroneComponent.list(),
      base44.asServiceRole.entities.Equipment.list(),
    ]);

    // Extract data and handle errors
    const allData = {
      Personnel:
        soldiers.status === "fulfilled"
          ? Array.isArray(soldiers.value)
            ? soldiers.value
            : []
          : [],
      Weapons:
        weapons.status === "fulfilled"
          ? Array.isArray(weapons.value)
            ? weapons.value
            : []
          : [],
      "Serialized Gear":
        serializedGear.status === "fulfilled"
          ? Array.isArray(serializedGear.value)
            ? serializedGear.value
            : []
          : [],
      "Drone Sets":
        droneSets.status === "fulfilled"
          ? Array.isArray(droneSets.value)
            ? droneSets.value
            : []
          : [],
      "Drone Components":
        droneComponents.status === "fulfilled"
          ? Array.isArray(droneComponents.value)
            ? droneComponents.value
            : []
          : [],
      Equipment:
        equipment.status === "fulfilled"
          ? Array.isArray(equipment.value)
            ? equipment.value
            : []
          : [],
    };

    // Get current date for report generation
    const currentReportDate = new Date();
    const reportDateString = currentReportDate.toLocaleDateString("en-US", {
      timeZone: "Asia/Jerusalem",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    // Generate summary stats
    const reportData = Object.entries(allData).map(([type, data]) => ({
      section: type,
      count: data.length,
      status: "OK",
    }));

    // Build the JSON payload grouped by the required headers
    const payload = {
      system: "ARMORY Equipment Management System",
      report_type: "Manual Data Report",
      generated_at: format(currentReportDate, "yyyy-MM-dd'T'HH:mm:ssXXX"),
      summary: reportData,

      sections: {
        SUMMARY: reportData,
        "PERSONNEL DETAILS": allData["Personnel"] ?? [],
        "WEAPONS INVENTORY": allData["Weapons"] ?? [],
        "SERIALIZED GEAR": allData["Serialized Gear"] ?? [],
        "DRONE SETS": allData["Drone Sets"] ?? [],
        "DRONE COMPONENTS": allData["Drone Components"] ?? [],
        EQUIPMENT: allData["Equipment"] ?? [],
        "MAINTENANCE ALERTS":
          allData.Equipment.filter((e) =>
            ["poor", "needs_repair"].includes(e.condition)
          ) ?? [],
        "Non-Functioning Weapons":
          allData.Weapons.filter((w) => w.status === "not_functioning") ?? [],
      },
    };

    // Pretty JSON for readability
    const prettyJson = JSON.stringify(payload, null, 2);

    // Build the HTML content for the email
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>ARMORY Daily Equipment Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f7f7f7; }
        .container { max-width: 800px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background-color: #2c3e50; color: #ffffff; padding: 20px; text-align: center; }
        .header h2 { margin-top: 0; margin-bottom: 10px; font-size: 24px; }
        .header p { margin: 0; font-size: 14px; opacity: 0.9; }
        .content { padding: 25px; }
        .content p { margin-bottom: 15px; }
        pre { background-color: #eee; padding: 15px; border-radius: 5px; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word; font-size: 13px; line-height: 1.4; color: #333; }
        .footer { font-size: 0.9em; color: #777; margin-top: 30px; border-top: 1px solid #eee; padding: 20px 25px; text-align: center; background-color: #f9f9f9; }
        .footer p { margin: 5px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>ARMORY Equipment Management System</h2>
            <p>Manual Data Report - ${format(
              currentReportDate,
              "MMMM dd, yyyy - HH:mm"
            )}</p>
        </div>
        <div class="content">
            <p>The full report JSON is included below for your review:</p>
            <pre>${prettyJson}</pre>
        </div>
        <div class="footer">
            <p>---</p>
            <p>This report was generated automatically by the ARMORY Equipment Management System.</p>
            <p>Next report will be sent tomorrow at 4:00 PM Israel time.</p>
            <p>For manual exports or additional reports, visit your dashboard.</p>
        </div>
    </div>
</body>
</html>
        `;

    const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
    const SENDGRID_FROM_EMAIL = Deno.env.get("SENDGRID_FROM_EMAIL");

    if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
      return jsonResponse(
        {
          error: "SendGrid not configured",
          details:
            "Missing SENDGRID_API_KEY or SENDGRID_FROM_EMAIL environment variables.",
        },
        500
      );
    }

    const emailData = {
      personalizations: [
        {
          to: [{ email: recipientEmail }],
          subject: `ARMORY Daily Equipment Report - ${reportDateString}`,
        },
      ],
      from: {
        email: SENDGRID_FROM_EMAIL,
        name: "ARMORY Daily Reports",
      },
      content: [
        {
          type: "text/html",
          value: htmlContent,
        },
      ],
    };

    const sendGridResponse = await fetch(
      "https://api.sendgrid.com/v3/mail/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
        },
        body: JSON.stringify(emailData),
      }
    );

    if (!sendGridResponse.ok) {
      const errorText = await sendGridResponse.text();
      return jsonResponse(
        {
          error: "Failed to send email via SendGrid",
          details: `SendGrid API returned status ${sendGridResponse.status}: ${errorText}`,
        },
        500
      );
    }

    return jsonResponse(
      {
        success: true,
        message: "Daily report sent successfully",
        recipientEmail: recipientEmail,
        timestamp: new Date().toISOString(),
        recordCounts: Object.entries(allData).reduce((acc, [type, data]) => {
          acc[type] = data.length;
          return acc;
        }, {}),
      },
      200
    );
  } catch (error) {
    return jsonResponse(
      {
        error: "Failed to send daily report",
        details: error.message,
      },
      500
    );
  }
});
