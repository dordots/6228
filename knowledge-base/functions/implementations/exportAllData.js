// Base44 Function: exportAllData
// This is the actual implementation running on Base44 servers

import { createClientFromRequest } from "npm:@base44/sdk@0.5.0";
import JSZip from "npm:jszip@3.10.1";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  if (!(await base44.auth.isAuthenticated())) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const zip = new JSZip();

    const addCSVToZip = (data, filename, headers = null) => {
      const BOM = "\uFEFF"; // UTF-8 Byte Order Mark for proper Hebrew support
      if (!Array.isArray(data) || data.length === 0) {
        const csvContent =
          BOM +
          (headers
            ? headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(",")
            : "");
        zip.file(filename, csvContent);
        return;
      }

      const finalHeaders = headers || Object.keys(data[0]);
      const csvRows = [
        finalHeaders.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(","),
      ];

      data.forEach((item) => {
        const row = finalHeaders.map((header) => {
          const value =
            item[header] !== undefined && item[header] !== null
              ? String(item[header])
              : "";
          return `"${value.replace(/"/g, '""')}"`;
        });
        csvRows.push(row.join(","));
      });

      const csvContent = BOM + csvRows.join("\n");
      zip.file(filename, csvContent);
    };

    const [
      soldiers,
      weapons,
      serializedGear,
      droneSets,
      droneComponents,
      equipment,
    ] = await Promise.all([
      base44.entities.Soldier.list(),
      base44.entities.Weapon.list(),
      base44.entities.SerializedGear.list(),
      base44.entities.DroneSet.list(),
      base44.entities.DroneComponent.list(),
      base44.entities.Equipment.list(),
    ]);

    const today = new Date().toISOString().split("T")[0];

    addCSVToZip(soldiers, `Personnel_${today}.csv`);
    addCSVToZip(weapons, `Weapons_${today}.csv`);
    addCSVToZip(serializedGear, `Serialized_Gear_${today}.csv`);
    addCSVToZip(droneSets, `Drone_Sets_${today}.csv`);
    addCSVToZip(droneComponents, `Drone_Components_${today}.csv`);
    addCSVToZip(equipment, `Equipment_${today}.csv`);

    const uniqueDivisions = [
      ...new Set(soldiers.map((s) => s.division_name).filter(Boolean)),
    ].sort();

    for (const division of uniqueDivisions) {
      const divisionWeapons = weapons.filter(
        (w) => w.division_name === division
      );
      const divisionGear = serializedGear.filter(
        (g) => g.division_name === division
      );
      const divisionDrones = droneSets.filter(
        (d) => d.division_name === division
      );

      const serializedItems = [
        ...divisionWeapons.map((w) => ({
          "Item Type": "Weapon",
          "Sub-Type": w.weapon_type || "N/A",
          "Serial Number / ID": w.weapon_id || "N/A",
          Status: w.status || "N/A",
          "Assigned To (ID)": w.assigned_to || "Unassigned",
          "Last Signed By": w.last_signed_by || "",
        })),
        ...divisionGear.map((g) => ({
          "Item Type": "Serialized Gear",
          "Sub-Type": g.gear_type || "N/A",
          "Serial Number / ID": g.gear_id || "N/A",
          Status: g.status || "N/A",
          "Assigned To (ID)": g.assigned_to || "Unassigned",
          "Last Signed By": g.last_signed_by || "",
        })),
        ...divisionDrones.map((d) => ({
          "Item Type": "Drone Set",
          "Sub-Type": d.set_type || "N/A",
          "Serial Number / ID": d.set_serial_number || "N/A",
          Status: d.status || "N/A",
          "Assigned To (ID)": d.assigned_to || "Unassigned",
          "Last Signed By": d.last_signed_by || "",
        })),
      ];
      addCSVToZip(
        serializedItems,
        `${division}_Serialized_Items_${today}.csv`,
        [
          "Item Type",
          "Sub-Type",
          "Serial Number / ID",
          "Status",
          "Assigned To (ID)",
          "Last Signed By",
        ]
      );

      const divisionEquipment = equipment.filter(
        (e) => e.division_name === division
      );
      addCSVToZip(divisionEquipment, `${division}_Equipment_${today}.csv`);
    }

    const zipContent = await zip.generateAsync({ type: "uint8array" });
    const base64String = encodeBase64(zipContent);

    return new Response(JSON.stringify({ zip_base64: base64String }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
