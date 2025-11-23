/**
 * Generate HTML equipment form for a soldier
 * @param {Object} soldier - Soldier data
 * @param {Array} assignedItems - Array of assigned items (weapons, gear, drones, equipment)
 * @returns {string} HTML string for the equipment form
 */
export function generateEquipmentFormHTML(soldier, assignedItems = []) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('he-IL');
  const timeStr = now.toLocaleTimeString('he-IL', { hour12: false });

  // Generate table rows for all items
  const itemRows = assignedItems.map((item, index) => {
    let itemType = '';
    let itemName = '';
    let serialOrQuantity = '';
    let status = '';

    if (item.type === 'Weapon') {
      itemType = 'Weapon';
      itemName = item.weapon_type || 'Unknown';
      serialOrQuantity = item.weapon_id || 'N/A';
      status = item.status || 'functioning';
    } else if (item.type === 'Gear') {
      itemType = 'Serialized Gear';
      itemName = item.gear_type || 'Unknown';
      serialOrQuantity = item.gear_id || 'N/A';
      status = item.status || 'functioning';
    } else if (item.type === 'Drone Set') {
      itemType = 'Drone Set';
      itemName = item.set_type || 'Unknown';

      // Build components list for drone set
      const components = [];
      if (item.drone_1_component_id) {
        components.push(`<li><strong style="text-transform: capitalize;">drone 1:</strong> ${item.drone_1_type || 'Drone'} (S/N: ${item.drone_1_serial_number || 'N/A'})</li>`);
      }
      if (item.goggles_component_id) {
        components.push(`<li><strong style="text-transform: capitalize;">goggles:</strong> ${item.goggles_type || 'Googles'} (S/N: ${item.goggles_serial_number || 'N/A'})</li>`);
      }
      if (item.remote_control_component_id) {
        components.push(`<li><strong style="text-transform: capitalize;">remote control:</strong> ${item.remote_control_type || 'Remote Control'} (S/N: ${item.remote_control_serial_number || 'N/A'})</li>`);
      }
      if (item.drone_2_component_id) {
        components.push(`<li><strong style="text-transform: capitalize;">drone 2:</strong> ${item.drone_2_type || 'Drone'} (S/N: ${item.drone_2_serial_number || 'N/A'})</li>`);
      }
      if (item.battery_component_id) {
        components.push(`<li><strong style="text-transform: capitalize;">battery:</strong> ${item.battery_type || 'Battery'} (S/N: ${item.battery_serial_number || 'N/A'})</li>`);
      }

      if (components.length > 0) {
        itemName += `<ul style="margin-top: 5px; padding-right: 20px; font-size: 10px; color: #333;">${components.join('')}</ul>`;
      }

      serialOrQuantity = item.set_serial_number || 'N/A';
      status = item.status || 'Operational';
    } else if (item.type === 'Equipment') {
      itemType = 'Equipment';
      itemName = item.equipment_type || 'Unknown';
      serialOrQuantity = item.quantity || '1';
      status = item.condition || 'functioning';
    }

    return `
        <tr>
            <td>${index + 1}</td>
            <td>${itemType}</td>
            <td>${itemName}</td>
            <td>${serialOrQuantity}</td>
            <td>${status}</td>
        </tr>
    `;
  }).join('');

  const fullName = `${soldier.first_name || ''} ${soldier.last_name || ''}`.trim();
  const soldierId = soldier.soldier_id || 'N/A';
  const division = soldier.division_name || 'לא צוין';

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>טופס רישום ציוד - ${fullName}</title>
    <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&family=Solitreo&display=swap" rel="stylesheet">
    <style>
        @page {
            size: A4;
            margin: 0.5in;
        }
        
        * {
            box-sizing: border-box;
        }
        
        * {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        
        body {
            font-family: 'Heebo', Arial, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: #000;
            direction: rtl;
            text-align: right;
            margin: 0;
            padding: 30px;
            background: #f5f5f5;
            white-space: normal;
            word-spacing: normal;
        }
        
        .container {
            max-width: 210mm;
            margin: 0 auto;
            background: white;
            padding: 40px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            white-space: normal;
            word-spacing: normal;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #1a1a1a;
            padding-bottom: 20px;
        }
        
        .header h1 {
            font-size: 32px;
            font-weight: 700;
            margin: 0 0 10px 0;
            direction: ltr;
            color: #1a1a1a;
            letter-spacing: 2px;
        }
        
        .header h2 {
            font-size: 24px;
            font-weight: 600;
            margin: 0;
            direction: rtl;
            color: #333;
        }
        
        .section {
            margin-bottom: 30px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            padding: 20px;
            background: #fafafa;
            page-break-inside: avoid;
        }
        
        .section h3 {
            font-size: 18px;
            font-weight: 600;
            margin: 0 0 15px 0;
            padding-bottom: 10px;
            border-bottom: 2px solid #d0d0d0;
            color: #1a1a1a;
        }
        
        .info-row {
            margin-bottom: 12px;
            font-size: 14px;
            padding: 5px 0;
            white-space: normal;
            word-spacing: normal;
        }
        
        .info-row strong {
            font-weight: 600;
            color: #333;
            margin-left: 8px;
        }
        
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            background: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .items-table th {
            background-color: #2c3e50;
            color: white;
            font-weight: 600;
            padding: 12px 10px;
            text-align: right;
            border: 1px solid #1a252f;
            font-size: 13px;
        }
        
        .items-table td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: right;
            font-size: 13px;
            white-space: normal;
            word-spacing: normal;
            word-wrap: break-word;
        }
        
        .items-table tbody tr:nth-child(even) {
            background-color: #f8f9fa;
        }
        
        .items-table tbody tr:hover {
            background-color: #e8f4f8;
        }
        
        .footer {
            display: flex;
            justify-content: space-around;
            align-items: flex-end;
            padding-top: 50px;
            margin-top: 50px;
            border-top: 2px solid #ccc;
            page-break-inside: avoid;
        }
        
        .signature-box {
            width: 45%;
            text-align: center;
            padding: 20px;
            border: 2px solid #ddd;
            border-radius: 8px;
            background: #fafafa;
        }
        
        .signature-box p {
            margin: 0 0 15px 0;
            font-weight: 600;
            font-size: 14px;
            color: #333;
        }
        
        .signature-line {
            border-bottom: 2px solid #000;
            height: 50px;
            margin-top: 20px;
            width: 100%;
        }
        
        .handwritten-name {
            font-family: 'Solitreo', cursive;
            font-size: 28px;
            color: #1a1a1a;
            padding: 15px 0;
            border-bottom: 2px solid #000;
            text-align: center;
            min-height: 50px;
        }
        
        ul {
            list-style-position: inside;
            padding-right: 0;
            margin: 5px 0;
        }
        
        li {
            margin-bottom: 5px;
            font-size: 11px;
        }
        
        @media print {
            body {
                background: white;
                padding: 0;
            }
            
            .container {
                box-shadow: none;
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Armory</h1>
            <h2>טופס רישום ציוד</h2>
        </div>
        <div class="section">
            <h3>פרטי החייל</h3>
            <div class="info-row"><strong>שם מלא:</strong> ${fullName}</div>
            <div class="info-row"><strong>מספר אישי:</strong> ${soldierId}</div>
            <div class="info-row"><strong>יחידה:</strong> ${division}</div>
            <div class="info-row"><strong>תאריך:</strong> ${dateStr} <strong>שעה:</strong> ${timeStr}</div>
        </div>
        <div class="section">
            <h3>סה"כ ציוד בחתימת החייל</h3>
            <table class="items-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>סוג</th>
                        <th>שם</th>
                        <th>מספר סידורי / כמות</th>
                        <th>סטטוס</th>
                    </tr>
                </thead>
                <tbody>
${itemRows}
                </tbody>
            </table>
        </div>
        <div class="footer">
            <div class="signature-box">
                <p><strong>חתימת החייל:</strong></p>
                <div class="handwritten-name">${fullName}</div>
            </div>
            <div class="signature-box">
                <p><strong>חתימת איש אפסנאות:</strong></p>
                <div class="signature-line"></div>
            </div>
        </div>
    </div>
</body>
</html>`;
}
