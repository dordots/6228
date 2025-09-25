// Base44 Function: deleteAllWeapons
// This is the actual implementation running on Base44 servers

import { createClientFromRequest } from "npm:@base44/sdk@0.5.0";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // 1. Authenticate and authorize the user as an admin
    const user = await base44.auth.me();
    if (!user || user.role !== "admin") {
      return new Response(
        JSON.stringify({
          error: "Unauthorized. Admin access required.",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch all weapon records to get their IDs
    console.log("Fetching all weapon records...");
    const allWeapons = await base44.asServiceRole.entities.Weapon.list();

    if (!allWeapons || allWeapons.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No weapon records found to delete.",
          deletedCount: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const totalCount = allWeapons.length;
    console.log(
      `Found ${totalCount} weapon records to delete. Starting deletion process...`
    );

    let deletedCount = 0;
    let errorCount = 0;
    const errors = [];
    // This delay is critical to avoid rate-limiting errors.
    const delayBetweenDeletions = 200; // 200ms delay

    // 3. Loop through every single record and delete it one-by-one
    for (let i = 0; i < allWeapons.length; i++) {
      const weapon = allWeapons[i];

      try {
        await base44.asServiceRole.entities.Weapon.delete(weapon.id);
        deletedCount++;
        console.log(
          `Deleted weapon ${i + 1}/${totalCount} (ID: ${weapon.weapon_id})`
        );
      } catch (deleteError) {
        console.error(
          `Error deleting weapon ${weapon.id}:`,
          deleteError.message
        );
        errorCount++;
        errors.push(`ID ${weapon.weapon_id}: ${deleteError.message}`);

        // If a rate limit is hit, stop and report progress
        if (
          deleteError.message &&
          deleteError.message.toLowerCase().includes("rate limit")
        ) {
          console.log(
            "Rate limit hit. Stopping deletion process to report progress."
          );
          break;
        }
      }

      // Wait before the next deletion
      await new Promise((resolve) =>
        setTimeout(resolve, delayBetweenDeletions)
      );
    }

    console.log("Weapon deletion process finished.");

    // 4. Log the final summary of the operation
    try {
      await base44.asServiceRole.entities.ActivityLog.create({
        activity_type: "DELETE",
        entity_type: "Weapon",
        details: `Bulk delete attempt finished. Deleted ${deletedCount} of ${totalCount} weapon records. Errors: ${errorCount}.`,
        user_full_name: user.full_name || "System",
      });
    } catch (logError) {
      console.error("Error logging activity:", logError);
    }

    // 5. Return a detailed response
    const remainingCount = totalCount - deletedCount;
    const response = {
      message: `Process completed. Deleted ${deletedCount} of ${totalCount} weapons.`,
      deletedCount,
      errorCount,
      remainingCount,
    };

    if (errors.length > 0) {
      response.errors = errors;
    }

    if (remainingCount > 0) {
      response.note = `Could not delete all weapons in a single run (likely due to a timeout or rate limit). ${remainingCount} weapons remain. Please run the function again to continue.`;
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Critical error in deleteAllWeapons function:", error);
    return new Response(
      JSON.stringify({
        error: "A critical error occurred during the deletion process.",
        details: error.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
