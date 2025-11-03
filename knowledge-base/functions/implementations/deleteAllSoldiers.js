// Base44 Function: deleteAllSoldiers
// This is the actual implementation running on Base44 servers

import { createClientFromRequest } from "npm:@base44/sdk@0.5.0";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Verify user is authenticated and is admin
    const user = await base44.auth.me();
    if (!user || user.role !== "admin") {
      return new Response(
        JSON.stringify({
          error: "Unauthorized. Admin access required.",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get all soldier records
    const allSoldiers = await base44.asServiceRole.entities.Soldier.list();

    if (!Array.isArray(allSoldiers) || allSoldiers.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No soldier records found to delete.",
          deletedCount: 0,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Delete all soldier records
    let deletedCount = 0;
    for (const soldier of allSoldiers) {
      try {
        await base44.asServiceRole.entities.Soldier.delete(soldier.id);
        deletedCount++;
      } catch (deleteError) {
        // Continue with other deletions even if one fails
      }
    }

    // Log the action
    await base44.asServiceRole.entities.ActivityLog.create({
      activity_type: "DELETE",
      entity_type: "Soldier",
      details: `Bulk deleted ${deletedCount} soldier records`,
      user_full_name: user.full_name || "System",
    });

    return new Response(
      JSON.stringify({
        message: `Successfully deleted ${deletedCount} soldier records`,
        deletedCount: deletedCount,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to delete soldier records",
        details: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
