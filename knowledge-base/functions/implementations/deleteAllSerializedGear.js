// Base44 Function: deleteAllSerializedGear
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

    // 2. Fetch all serialized gear records
    console.log("Fetching all serialized gear records...");
    const allGear = await base44.asServiceRole.entities.SerializedGear.list();

    if (!allGear || allGear.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No serialized gear records found to delete.",
          deletedCount: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const totalCount = allGear.length;
    console.log(
      `Found ${totalCount} serialized gear records to delete. Starting deletion process...`
    );

    let deletedCount = 0;
    let errorCount = 0;
    const errors = [];
    const delayBetweenDeletions = 200; // 200ms delay

    // 3. Loop through every single record and delete it one-by-one
    for (let i = 0; i < allGear.length; i++) {
      const gearItem = allGear[i];

      try {
        await base44.asServiceRole.entities.SerializedGear.delete(gearItem.id);
        deletedCount++;
        console.log(
          `Deleted gear ${i + 1}/${totalCount} (ID: ${gearItem.gear_id})`
        );
      } catch (deleteError) {
        console.error(
          `Error deleting gear ${gearItem.id}:`,
          deleteError.message
        );
        errorCount++;
        errors.push(`ID ${gearItem.gear_id}: ${deleteError.message}`);

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

    console.log("Serialized gear deletion process finished.");

    // 4. Log the final summary of the operation
    try {
      await base44.asServiceRole.entities.ActivityLog.create({
        activity_type: "DELETE",
        entity_type: "SerializedGear",
        details: `Bulk delete attempt finished. Deleted ${deletedCount} of ${totalCount} serialized gear records. Errors: ${errorCount}.`,
        user_full_name: user.full_name || "System",
      });
    } catch (logError) {
      console.error("Error logging activity:", logError);
    }

    // 5. Return a detailed response
    const remainingCount = totalCount - deletedCount;
    const response = {
      message: `Process completed. Deleted ${deletedCount} of ${totalCount} gear items.`,
      deletedCount,
      errorCount,
      remainingCount,
    };

    if (errors.length > 0) {
      response.errors = errors;
    }

    if (remainingCount > 0) {
      response.note = `Could not delete all gear in a single run (likely due to a timeout or rate limit). ${remainingCount} items remain. Please run the function again to continue.`;
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Critical error in deleteAllSerializedGear function:", error);
    return new Response(
      JSON.stringify({
        error: "A critical error occurred during the deletion process.",
        details: error.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
