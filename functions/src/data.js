const functions = require("firebase-functions");
const admin = require("firebase-admin");
const archiver = require("archiver");
const { stringify } = require("csv-stringify/sync");

const db = admin.firestore();

/**
 * Export all data as CSV files in a ZIP archive
 */
exports.exportAllData = functions
  .runWith({ timeoutSeconds: 540, memory: "2GB", serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
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
        "Only admins can export all data"
      );
    }

    try {
      // Create a buffer to store the zip
      const chunks = [];
      const archive = archiver("zip", { zlib: { level: 9 } });
      
      archive.on("data", (chunk) => chunks.push(chunk));
      
      // Helper function to add CSV to archive
      const addCSVToZip = (data, filename, headers) => {
        const BOM = "\ufeff"; // UTF-8 Byte Order Mark for proper Hebrew support
        
        if (!Array.isArray(data) || data.length === 0) {
          const csvContent = BOM + (headers ? headers.join(",") : "");
          archive.append(csvContent, { name: filename });
          return;
        }

        const csvContent = BOM + stringify(data, {
          header: true,
          columns: headers || undefined,
        });
        
        archive.append(csvContent, { name: filename });
      };

      // Fetch all data
      const [
        soldiers,
        weapons,
        serializedGear,
        droneSets,
        droneComponents,
        equipment,
      ] = await Promise.all([
        db.collection("soldiers").get(),
        db.collection("weapons").get(),
        db.collection("serialized_gear").get(),
        db.collection("drone_sets").get(),
        db.collection("drone_components").get(),
        db.collection("equipment").get(),
      ]);

      const today = new Date().toISOString().split("T")[0];

      // Convert snapshots to data arrays
      const soldiersData = soldiers.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const weaponsData = weapons.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const gearData = serializedGear.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const droneSetsData = droneSets.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const droneComponentsData = droneComponents.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const equipmentData = equipment.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Add main CSV files
      addCSVToZip(soldiersData, `Personnel_${today}.csv`);
      addCSVToZip(weaponsData, `Weapons_${today}.csv`);
      addCSVToZip(gearData, `Serialized_Gear_${today}.csv`);
      addCSVToZip(droneSetsData, `Drone_Sets_${today}.csv`);
      addCSVToZip(droneComponentsData, `Drone_Components_${today}.csv`);
      addCSVToZip(equipmentData, `Equipment_${today}.csv`);

      // Get unique divisions
      const uniqueDivisions = [
        ...new Set(soldiersData.map(s => s.division_name).filter(Boolean)),
      ].sort();

      // Create division-specific exports
      for (const division of uniqueDivisions) {
        const divisionWeapons = weaponsData.filter(w => w.division_name === division);
        const divisionGear = gearData.filter(g => g.division_name === division);
        const divisionDrones = droneSetsData.filter(d => d.division_name === division);

        const serializedItems = [
          ...divisionWeapons.map(w => ({
            "Item Type": "Weapon",
            "Sub-Type": w.weapon_type || "N/A",
            "Serial Number / ID": w.weapon_id || w.id,
            Status: w.status || "N/A",
            "Assigned To (ID)": w.soldier_id || "Unassigned",
            "Last Signed By": w.last_signed_by || "",
          })),
          ...divisionGear.map(g => ({
            "Item Type": "Serialized Gear",
            "Sub-Type": g.gear_type || "N/A",
            "Serial Number / ID": g.gear_id || g.id,
            Status: g.status || "N/A",
            "Assigned To (ID)": g.soldier_id || "Unassigned",
            "Last Signed By": g.last_signed_by || "",
          })),
          ...divisionDrones.map(d => ({
            "Item Type": "Drone Set",
            "Sub-Type": d.drone_type || "N/A",
            "Serial Number / ID": d.drone_set_id || d.id,
            Status: d.status || "N/A",
            "Assigned To (ID)": d.soldier_id || "Unassigned",
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

        const divisionEquipment = equipmentData.filter(e => e.division_name === division);
        addCSVToZip(divisionEquipment, `${division}_Equipment_${today}.csv`);
      }

      // Finalize the archive
      await archive.finalize();
      
      // Convert chunks to base64
      const buffer = Buffer.concat(chunks);
      const base64String = buffer.toString("base64");

      // Log activity
      await db.collection("activity_logs").add({
        entity_type: "data",
        action: "export_all",
        performed_by: context.auth.uid,
        details: {
          items_exported: {
            soldiers: soldiersData.length,
            weapons: weaponsData.length,
            gear: gearData.length,
            drones: droneSetsData.length,
            components: droneComponentsData.length,
            equipment: equipmentData.length,
          },
        },
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { 
        success: true,
        zip_base64: base64String,
        filename: `ARMORY_Complete_Export_${today}.zip`,
        size: buffer.length,
      };
    } catch (error) {
      throw new functions.https.HttpsError(
        "internal",
        `Failed to export data: ${error.message}`
      );
    }
  });

/**
 * Delete all equipment (admin only)
 */
exports.deleteAllEquipment = functions
  .runWith({ timeoutSeconds: 300, serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
  .https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.role !== "admin") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only admins can delete all equipment"
      );
    }

    try {
      const batchSize = 100;
      const equipmentRef = db.collection("equipment");
      let deleted = 0;

      // Delete in batches
      let snapshot = await equipmentRef.limit(batchSize).get();
      
      while (!snapshot.empty) {
        const batch = db.batch();
        
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          deleted++;
        });
        
        await batch.commit();
        
        // Get next batch
        snapshot = await equipmentRef.limit(batchSize).get();
      }

      // Log activity
      await db.collection("activity_logs").add({
        entity_type: "equipment",
        action: "bulk_delete",
        performed_by: context.auth.uid,
        details: { count: deleted },
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, deleted };
    } catch (error) {
      throw new functions.https.HttpsError(
        "internal",
        `Failed to delete equipment: ${error.message}`
      );
    }
  });

/**
 * Delete all soldiers (admin only)
 */
exports.deleteAllSoldiers = functions
  .runWith({ timeoutSeconds: 300, serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
  .https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.role !== "admin") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only admins can delete all soldiers"
      );
    }

    try {
      const batchSize = 100;
      const soldiersRef = db.collection("soldiers");
      let deleted = 0;

      let snapshot = await soldiersRef.limit(batchSize).get();
      
      while (!snapshot.empty) {
        const batch = db.batch();
        
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          deleted++;
        });
        
        await batch.commit();
        snapshot = await soldiersRef.limit(batchSize).get();
      }

      // Log activity
      await db.collection("activity_logs").add({
        entity_type: "soldiers",
        action: "bulk_delete",
        performed_by: context.auth.uid,
        details: { count: deleted },
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, deleted };
    } catch (error) {
      throw new functions.https.HttpsError(
        "internal",
        `Failed to delete soldiers: ${error.message}`
      );
    }
  });

/**
 * Delete all weapons (admin only)
 */
exports.deleteAllWeapons = functions
  .runWith({ timeoutSeconds: 300, serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
  .https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.role !== "admin") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only admins can delete all weapons"
      );
    }

    try {
      const batchSize = 100;
      const weaponsRef = db.collection("weapons");
      let deleted = 0;

      let snapshot = await weaponsRef.limit(batchSize).get();
      
      while (!snapshot.empty) {
        const batch = db.batch();
        
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          deleted++;
        });
        
        await batch.commit();
        snapshot = await weaponsRef.limit(batchSize).get();
      }

      // Log activity
      await db.collection("activity_logs").add({
        entity_type: "weapons",
        action: "bulk_delete",
        performed_by: context.auth.uid,
        details: { count: deleted },
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, deleted };
    } catch (error) {
      throw new functions.https.HttpsError(
        "internal",
        `Failed to delete weapons: ${error.message}`
      );
    }
  });

/**
 * Delete all serialized gear (admin only)
 */
exports.deleteAllSerializedGear = functions
  .runWith({ timeoutSeconds: 300, serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
  .https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.role !== "admin") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only admins can delete all serialized gear"
      );
    }

    try {
      const batchSize = 100;
      const gearRef = db.collection("serialized_gear");
      let deleted = 0;

      let snapshot = await gearRef.limit(batchSize).get();
      
      while (!snapshot.empty) {
        const batch = db.batch();
        
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          deleted++;
        });
        
        await batch.commit();
        snapshot = await gearRef.limit(batchSize).get();
      }

      // Log activity
      await db.collection("activity_logs").add({
        entity_type: "serialized_gear",
        action: "bulk_delete",
        performed_by: context.auth.uid,
        details: { count: deleted },
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, deleted };
    } catch (error) {
      throw new functions.https.HttpsError(
        "internal",
        `Failed to delete serialized gear: ${error.message}`
      );
    }
  });