// Base44 Function: generateSigningForm
// This is the actual implementation running on Base44 servers

import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }

        const { activityId, fallback_soldier_id } = await req.json();
        if (!activityId) {
            return new Response(JSON.stringify({ error: 'Activity ID is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const activity = await base44.asServiceRole.entities.ActivityLog.get(activityId);
        if (!activity || activity.activity_type !== 'ASSIGN') {
            return new Response(JSON.stringify({ error: 'Invalid activity type found for signing form' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        let soldierId = activity.soldier_id || (activity.context && activity.context.soldierId) || fallback_soldier_id;
        if (!soldierId) {
            return new Response(JSON.stringify({ error: 'No soldier ID found' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const soldiers = await base44.asServiceRole.entities.Soldier.filter({ soldier_id: soldierId });
        const soldier = soldiers[0];
        if (!soldier) {
            return new Response(JSON.stringify({ error: 'Soldier not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        // Extract assigned items from context (NEW items being signed in this event)
        const assignedItems = [];
        const context = activity.context || {};
        const contextItems = context.assignedItems || [];

        for (const item of contextItems) {
            let serialId = 'N/A';
            
            if (item.type === 'Weapon') {
                try {
                    const weapon = await base44.asServiceRole.entities.Weapon.get(item.id);
                    serialId = weapon?.weapon_id || item.id || 'N/A';
                } catch { serialId = item.id || 'N/A'; }
            } else if (item.type === 'Gear' || item.type === 'Serialized Gear') {
                try {
                    const gear = await base44.asServiceRole.entities.SerializedGear.get(item.id);
                    serialId = gear?.gear_id || item.id || 'N/A';
                } catch { serialId = item.id || 'N/A'; }
            } else if (item.type === 'Drone Set') {
                try {
                    const droneSet = await base44.asServiceRole.entities.DroneSet.get(item.id);
                    serialId = droneSet?.set_serial_number || item.id || 'N/A';
                } catch { serialId = item.id || 'N/A'; }
            } else if (item.type === 'Equipment') {
                serialId = `Qty: ${item.quantity || 1}`;
            }

            assignedItems.push({
                type: item.type || 'Unknown Type',
                name: item.name || 'Unknown Item',
                serialId: serialId,
                status: 'Assigned',
            });
        }

        // Fetch TOTAL Equipment After Assignment (including new items)
        const allItems = [];
        const [allWeapons, allGear, allDrones, allEquipment] = await Promise.all([
            base44.asServiceRole.entities.Weapon.filter({ assigned_to: soldierId }),
            base44.asServiceRole.entities.SerializedGear.filter({ assigned_to: soldierId }),
            base44.asServiceRole.entities.DroneSet.filter({ assigned_to: soldierId }),
            base44.asServiceRole.entities.Equipment.filter({ assigned_to: soldierId }),
        ]);

        // Create a set of IDs for items assigned in this event for easy lookup
        const newItemIds = new Set(contextItems.map(item => item.id).filter(Boolean));

        if (Array.isArray(allWeapons)) {
            allWeapons.forEach(i => {
                allItems.push({ 
                    type: 'Weapon', 
                    name: i.weapon_type, 
                    serialId: i.weapon_id, 
                    status: i.status,
                    isNewInThisEvent: newItemIds.has(i.id) // Check if this item is new in this event
                });
            });
        }
        if (Array.isArray(allGear)) {
            allGear.forEach(i => {
                allItems.push({ 
                    type: 'Serialized Gear', 
                    name: i.gear_type, 
                    serialId: i.gear_id, 
                    status: i.status,
                    isNewInThisEvent: newItemIds.has(i.id)
                });
            });
        }
        if (Array.isArray(allDrones)) {
            allDrones.forEach(i => {
                allItems.push({ 
                    type: 'Drone Set', 
                    name: i.set_type, 
                    serialId: i.set_serial_number, 
                    status: i.status,
                    isNewInThisEvent: newItemIds.has(i.id)
                });
            });
        }
        if (Array.isArray(allEquipment)) {
            allEquipment.forEach(i => {
                // For equipment, we can't easily match by ID since it might be newly created
                // So we'll check if the equipment type and quantity match what was assigned in this event
                const matchingNewEquipment = contextItems.find(contextItem => 
                    contextItem.type === 'Equipment' && 
                    contextItem.name === i.equipment_type &&
                    contextItem.quantity === i.quantity
                );
                
                allItems.push({ 
                    type: 'Equipment', 
                    name: i.equipment_type, 
                    serialId: `Qty: ${i.quantity}`, 
                    status: i.condition,
                    isNewInThisEvent: !!matchingNewEquipment
                });
            });
        }

        // FIXED: This list now contains only equipment the soldier had BEFORE this event.
        const previouslyAssignedItems = allItems.filter(item => !item.isNewInThisEvent);

        const signatureDataUrl = context.signature || null;
        const activityDate = new Date(activity.created_date);
        const dateStr = activityDate.toLocaleDateString('en-US');
        const timeStr = activityDate.toLocaleTimeString('en-US');

        const html = `
        <!DOCTYPE html>
        <html lang="he" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>Equipment Assignment Form</title>
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
                .assigned-items { background-color: #f0fff4; }
                .total-items { background-color: #f0f9ff; }
                .signature-box { border: 1px solid #666; min-height: 120px; padding: 10px; margin-top: 10px; display: flex; align-items: center; justify-content: center; background: #fafafa; }
                .signature-box img { max-width: 100%; max-height: 100px; object-fit: contain; }
                .footer { margin-top: 30px; font-size: 10px; color: #666; text-align: center; border-top: 1px solid #ddd; padding-top: 10px; }
            </style>
        </head>
        <body>
            <div class="header"><h1>Equipment Assignment Form</h1><h2>טופס חתימה על ציוד</h2></div>
            <div class="section"><h3>פרטי הפעילות - Activity Details</h3><div class="info-row"><strong>תאריך:</strong> ${dateStr} בשעה ${timeStr}</div><div class="info-row"><strong>מאושר על ידי:</strong> ${activity.user_full_name || 'System'}</div></div>
            <div class="section"><h3>פרטי החייל - Soldier Information</h3><div class="info-row"><strong>שם:</strong> ${soldier.first_name} ${soldier.last_name}</div><div class="info-row"><strong>מספר אישי:</strong> ${soldier.soldier_id}</div><div class="info-row"><strong>יחידה:</strong> ${soldier.division_name || 'לא שויך'}</div></div>
            <div class="section assigned-items">
                <h3>ציוד שנחתם באירוע זה - Equipment Assigned in This Event (${assignedItems.length} items)</h3>
                ${assignedItems.length > 0 ? `<table class="items-table"><thead><tr><th>#</th><th>סוג</th><th>שם הפריט</th><th>מספר סידורי</th><th>סטטוס</th></tr></thead><tbody>
                        ${assignedItems.map((item, index) => `<tr><td>${index + 1}</td><td>${item.type}</td><td>${item.name}</td><td>${item.serialId}</td><td>${item.status}</td></tr>`).join('')}
                    </tbody></table>` : '<p><strong>לא נחתם ציוד באירוע זה.</strong></p>'}
            </div>
            <div class="section total-items">
                <h3>ציוד קודם ברשות החייל - Previously Assigned Equipment (${previouslyAssignedItems.length} items)</h3>
                ${previouslyAssignedItems.length > 0 ? `<table class="items-table"><thead><tr><th>#</th><th>סוג</th><th>שם הפריט</th><th>מספר סידורי</th><th>סטטוס</th></tr></thead><tbody>
                        ${previouslyAssignedItems.map((item, index) => `<tr><td>${index + 1}</td><td>${item.type}</td><td>${item.name}</td><td>${item.serialId}</td><td>${item.status}</td></tr>`).join('')}
                    </tbody></table>` : '<p><strong>לא היה ציוד קודם ברשות החייל.</strong></p>'}
            </div>
            <div class="section">
                <h3>חתימת החייל - Soldier Signature</h3>
                <div class="signature-box">${signatureDataUrl ? `<img src="${signatureDataUrl}" alt="Soldier Signature" style="max-width:100%;max-height:100px;" />` : `<p><em>לא סופקה חתימה עבור חתימה זו</em></p>`}</div>
            </div>
            <div class="footer"><p>נוצר ב-${new Date().toLocaleString('he-IL')}</p></div>
        </body></html>`;

        return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message, stack: error.stack }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
});
