
import React, { useState } from "react";
import { Soldier } from "@/api/entities";
import { Weapon } from "@/api/entities";
import { SerializedGear } from "@/api/entities";
import { DroneComponent } from "@/api/entities";
import { Equipment } from "@/api/entities"; // Import Equipment entity
import { UploadFile, ExtractDataFromUploadedFile } from "@/api/integrations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertTriangle, Upload, FileSpreadsheet, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import ImportStep from "../components/import/ImportStep";
import UpdateSoldiersStep from "../components/import/UpdateSoldiersStep";

export default function ImportPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [importStatus, setImportStatus] = useState({
    soldiers: { status: 'pending', count: 0, data: [] },
    weapons: { status: 'pending', count: 0, data: [] },
    gear: { status: 'pending', count: 0, data: [] },
    droneComponents: { status: 'pending', count: 0, data: [] },
    equipment: { status: 'pending', count: 0, data: [] }, // Added for equipment
    assignments: { status: 'pending', count: 0, data: [] }
  });
  // New state for soldier update functionality
  const [updateStatus, setUpdateStatus] = useState({
    soldiers: { status: 'pending', count: 0, data: [], updated: 0, notFound: 0 }
  });
  // New state for equipment assignment import
  const [equipmentAssignmentStatus, setEquipmentAssignmentStatus] = useState({
    status: 'pending', count: 0, data: [], processed: 0, errors: 0, processedItems: []
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  // New state for active tab (Import vs. Update)
  const [activeTab, setActiveTab] = useState('create'); // Renamed from 'import'

  // New state for template generation
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);

  const handleFileUpload = async (fileType, file) => {
    setIsProcessing(true);
    setError('');
    
    try {
      console.log('Uploading file:', file.name, 'Type:', fileType); // Debug log
      const { file_url } = await UploadFile({ file });
      console.log('File uploaded to:', file_url); // Debug log
      
      let schema;
      switch (fileType) {
        case 'soldiers':
          schema = {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                first_name: { type: "string" },
                last_name: { type: "string" },
                division_name: { type: "string" },
                team_name: { type: "string" },
                profession: { type: "string" },
                phone_number: { type: "string" },
                email: { type: "string" },
                street_address: { type: "string" },
                city: { type: "string" }
              }
            }
          };
          break;
        case 'weapons':
          schema = {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                type: { type: "string" },
                status: { type: "string" },
                division_name: { type: "string" } // Added division_name
              }
            }
          };
          break;
        case 'gear':
          schema = {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                type: { type: "string" },
                status: { type: "string" },
                division_name: { type: "string" }
              }
            }
          };
          break;
        case 'droneComponents':
          schema = {
            type: "array",
            items: {
              type: "object",
              properties: {
                component_id: { type: "string" },
                component_type: { type: "string" },
                status: { type: "string" }
              }
            }
          };
          break;
        case 'equipment': // Add equipment import case
          schema = {
            type: "array",
            items: {
              type: "object",
              properties: {
                equipment_type: { type: "string" },
                serial_number: { type: "string" },
                condition: { type: "string" },
                division_name: { type: "string" },
                assigned_to: { type: "string" },
                quantity: { type: "number" }
              },
              required: ["equipment_type", "division_name"]
            }
          };
          break;
        case 'assignments':
          schema = {
            type: "array",
            items: {
              type: "object",
              properties: {
                soldier_id: { type: "string" },
                weapon_id: { type: "string" },
                gear_id: { type: "string" }
              }
            }
          };
          break;
        case 'equipment_assignments':
          schema = {
            type: "array",
            items: {
              type: "object",
              properties: {
                soldier_id: { type: "string" },
                division_name: { type: "string" }
              },
              required: ["division_name"],
              additionalProperties: { type: ["string", "number"] } // Allows for dynamic equipment type columns
            }
          };
          break;
        default:
            throw new Error('Unknown file type for import.');
      }

      console.log('Extracting data with schema for', fileType); // Debug log
      const result = await ExtractDataFromUploadedFile({
        file_url,
        json_schema: schema
      });

      console.log('Extraction result:', result); // Debug log

      if (result.status === 'success' && result.output) {
        // Handle direct array response
        const data = Array.isArray(result.output) ? result.output : [];
        console.log('Parsed data:', data); // Debug log
        
        if (fileType === 'equipment_assignments') {
          setEquipmentAssignmentStatus(prev => ({
            ...prev,
            status: 'uploaded',
            count: data.length,
            data: data,
            processedItems: [] // Clear processed items on new upload
          }));
        } else {
          setImportStatus(prev => ({
            ...prev,
            [fileType]: {
              status: 'uploaded',
              count: data.length,
              data: data
            }
          }));
        }
      } else {
        throw new Error(`Failed to extract data from ${fileType} file: ${result.details || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Upload error:', err); // Debug log
      setError(`Error processing ${fileType} file: ${err.message}`);
      if (fileType === 'equipment_assignments') {
        setEquipmentAssignmentStatus(prev => ({ ...prev, status: 'error', count: 0, data: [], processed: 0, errors: 0, processedItems: [] }));
      } else {
        setImportStatus(prev => ({
          ...prev,
          [fileType]: { status: 'error', count: 0, data: [] }
        }));
      }
    }
    
    setIsProcessing(false);
  };

  const executeImport = async () => {
    setIsProcessing(true);
    
    try {
      // Import soldiers first
      if (importStatus.soldiers.data.length > 0) {
        const soldiersData = importStatus.soldiers.data.map(s => ({
          soldier_id: s.id, // Assuming 'id' from CSV maps to 'soldier_id' in Soldier entity
          first_name: s.first_name,
          last_name: s.last_name,
          division_name: s.division_name,
          team_name: s.team_name,
          profession: s.profession,
          phone_number: s.phone_number,
          email: s.email,
          street_address: s.street_address,
          city: s.city
        }));
        
        await Soldier.bulkCreate(soldiersData);
        setImportStatus(prev => ({
          ...prev,
          soldiers: { ...prev.soldiers, status: 'completed' }
        }));
      }

      // Import weapons
      if (importStatus.weapons.data.length > 0) {
        const weaponsData = importStatus.weapons.data.map(w => ({
          weapon_id: w.id, // Assuming 'id' from CSV maps to 'weapon_id' in Weapon entity
          weapon_type: w.type,
          status: w.status?.toLowerCase() === 'functioning' ? 'functioning' : 'not_functioning',
          division_name: w.division_name || null // Added division_name
        }));
        
        await Weapon.bulkCreate(weaponsData);
        setImportStatus(prev => ({
          ...prev,
          weapons: { ...prev.weapons, status: 'completed' }
        }));
      }

      // Import serialized gear
      if (importStatus.gear.data.length > 0) {
        const gearData = importStatus.gear.data.map(g => ({
          gear_id: g.id, // Assuming 'id' from CSV maps to 'gear_id' in SerializedGear entity
          gear_type: g.type,
          status: g.status?.toLowerCase() === 'functioning' ? 'functioning' : 'not_functioning',
          division_name: g.division_name || null
        }));
        
        await SerializedGear.bulkCreate(gearData);
        setImportStatus(prev => ({
          ...prev,
          gear: { ...prev.gear, status: 'completed' }
        }));
      }

      // Import drone components
      if (importStatus.droneComponents.data.length > 0) {
        const droneComponentsData = importStatus.droneComponents.data.map(d => ({
          component_id: d.component_id,
          component_type: d.component_type,
          status: d.status || 'Operational' // Assuming a default status if not provided
        }));
        
        await DroneComponent.bulkCreate(droneComponentsData);
        setImportStatus(prev => ({
          ...prev,
          droneComponents: { ...prev.droneComponents, status: 'completed' }
        }));
      }

      // Add equipment import
      if (importStatus.equipment && importStatus.equipment.data.length > 0) {
        console.log('Importing equipment:', importStatus.equipment.data); // Debug log
        const equipmentData = importStatus.equipment.data.map(e => ({
          equipment_type: e.equipment_type,
          serial_number: e.serial_number || null,
          condition: e.condition?.toLowerCase() === 'functioning' ? 'functioning' : 'not_functioning',
          division_name: e.division_name,
          assigned_to: e.assigned_to || null,
          quantity: parseInt(e.quantity) || 1
        }));
        
        await Equipment.bulkCreate(equipmentData);
        setImportStatus(prev => ({
          ...prev,
          equipment: { ...prev.equipment, status: 'completed' }
        }));
        console.log('Equipment import completed'); // Debug log
      }

      // Process assignments
      if (importStatus.assignments.data.length > 0) {
        const assignments = importStatus.assignments.data;
        
        // Update weapons assignments
        const weaponAssignments = assignments.filter(a => a.weapon_id);
        for (const assignment of weaponAssignments) {
          const weapons = await Weapon.filter({ weapon_id: assignment.weapon_id });
          if (weapons.length > 0) {
            await Weapon.update(weapons[0].id, { assigned_to: assignment.soldier_id });
          }
        }

        // Update gear assignments
        const gearAssignments = assignments.filter(a => a.gear_id);
        for (const assignment of gearAssignments) {
          const gear = await SerializedGear.filter({ gear_id: assignment.gear_id });
          if (gear.length > 0) {
            await SerializedGear.update(gear[0].id, { assigned_to: assignment.soldier_id });
          }
        }
        
        setImportStatus(prev => ({
          ...prev,
          assignments: { ...prev.assignments, status: 'completed' }
        }));
      }

      setCurrentStep(3);
    } catch (err) {
      console.error('Import error:', err); // Debug log
      setError(`Import failed: ${err.message}`);
    }
    
    setIsProcessing(false);
  };

  const executeEquipmentAssignmentImport = async () => {
    setIsProcessing(true);
    setError('');

    let processedCount = 0;
    let errorCount = 0;
    const processedItems = [];

    try {
      const data = equipmentAssignmentStatus.data;
      console.log('Processing equipment assignments:', data);
      
      // Fetch all equipment and soldiers once to optimize lookups
      const allEquipment = await Equipment.list();
      const allSoldiers = await Soldier.list();

      for (const row of data) {
        const { soldier_id, division_name, ...assignments } = row;

        // Division name is always required
        if (!division_name || String(division_name).trim() === '') {
          processedItems.push(`❌ Error: Row skipped due to missing division name.`);
          errorCount++;
          continue;
        }

        const trimmedDivision = String(division_name).trim();
        const hasSoldierId = soldier_id && String(soldier_id).trim() !== '';

        for (const [equipment_type, quantityStr] of Object.entries(assignments)) {
          const quantity = parseInt(String(quantityStr).trim(), 10);
          if (isNaN(quantity) || quantity < 0) {
            continue; // Skip invalid quantity entries
          }

          try {
            if (hasSoldierId) { 
              // ASSIGN TO SPECIFIC SOLDIER
              const trimmedSoldierId = String(soldier_id).trim();
              const foundSoldier = allSoldiers.find(s => s.soldier_id === trimmedSoldierId);
              if (!foundSoldier) {
                processedItems.push(`❌ Error: Soldier ID '${trimmedSoldierId}' not found. No assignment made for ${equipment_type}.`);
                errorCount++;
                continue; // Skip this specific equipment assignment
              }
              
              const existingAssignment = allEquipment.find(e => 
                e.assigned_to === foundSoldier.soldier_id && 
                e.equipment_type === equipment_type
              );
              
              if (existingAssignment) {
                if (quantity === 0) {
                  await Equipment.delete(existingAssignment.id);
                  processedItems.push(`🗑️ Removed ${equipment_type} from ${foundSoldier.first_name} ${foundSoldier.last_name}`);
                } else {
                  await Equipment.update(existingAssignment.id, { quantity });
                  processedItems.push(`✏️ Updated ${equipment_type} quantity to ${quantity} for ${foundSoldier.first_name} ${foundSoldier.last_name}`);
                }
              } else if (quantity > 0) {
                // Create new assignment to soldier - no serial number required
                await Equipment.create({
                  equipment_type,
                  quantity,
                  assigned_to: foundSoldier.soldier_id,
                  division_name: foundSoldier.division_name,
                  condition: 'functioning',
                  serial_number: null // Serial number not required for assignments
                });
                processedItems.push(`👤 Assigned ${quantity}x ${equipment_type} to ${foundSoldier.first_name} ${foundSoldier.last_name}`);
              }
            } else { 
              // ADD TO DIVISION STORAGE (no soldier_id provided)
              const existingStock = allEquipment.find(e => 
                !e.assigned_to && 
                e.division_name === trimmedDivision && 
                e.equipment_type === equipment_type
              );
              
              if (existingStock) {
                if (quantity === 0) {
                  await Equipment.delete(existingStock.id);
                  processedItems.push(`🗑️ Removed ${equipment_type} from ${trimmedDivision} division storage`);
                } else {
                  await Equipment.update(existingStock.id, { quantity });
                  processedItems.push(`✏️ Updated ${equipment_type} quantity to ${quantity} in ${trimmedDivision} division storage`);
                }
              } else if (quantity > 0) {
                // Create new equipment in division storage - no serial number required
                await Equipment.create({
                  equipment_type,
                  quantity,
                  division_name: trimmedDivision,
                  assigned_to: null, // Not assigned to anyone - in division storage
                  condition: 'functioning',
                  serial_number: null // Serial number not required for bulk equipment
                });
                processedItems.push(`🏢 Added ${quantity}x ${equipment_type} to ${trimmedDivision} division storage`);
              }
            }
          } catch (itemError) {
            console.error(`Error processing ${equipment_type}:`, itemError);
            processedItems.push(`❌ Error processing ${equipment_type}: ${itemError.message}`);
            errorCount++;
          }
        }
        processedCount++;
      }

      setEquipmentAssignmentStatus(prev => ({
        ...prev,
        status: 'completed',
        processed: processedCount,
        errors: errorCount,
        processedItems: processedItems
      }));

      console.log('Equipment assignment import completed:', {
        processed: processedCount,
        errors: errorCount,
        items: processedItems
      });

    } catch (err) {
      console.error("Equipment assignment import error:", err);
      setError(`Equipment assignment import failed: ${err.message}`);
      setEquipmentAssignmentStatus(prev => ({ 
        ...prev, 
        status: 'error', 
        processed: processedCount, 
        errors: errorCount,
        processedItems: processedItems
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateFileUpload = async (file) => {
    setIsProcessing(true);
    setError('');
    
    try {
      console.log('Starting file upload...', file.name);
      const { file_url } = await UploadFile({ file });
      console.log('File uploaded to:', file_url);
      
      // Simplified schema - just extract everything as strings
      const schema = {
        type: "array",
        items: {
          type: "object",
          properties: {
            soldier_id: { type: "string" },
            first_name: { type: "string" },
            last_name: { type: "string" },
            email: { type: "string" },
            street_address: { type: "string" },
            city: { type: "string" },
            phone_number: { type: "string" },
            division_name: { type: "string" },
            team_name: { type: "string" },
            profession: { type: "string" }
          },
          required: ["soldier_id"]
        }
      };

      console.log('Extracting data with schema:', schema);
      const result = await ExtractDataFromUploadedFile({
        file_url,
        json_schema: schema
      });

      console.log('Extraction result:', result);

      if (result.status === 'success' && result.output) {
        const data = Array.isArray(result.output) ? result.output : [];
        console.log('Parsed data:', data);
        
        setUpdateStatus(prev => ({
          ...prev,
          soldiers: {
            status: 'uploaded',
            count: data.length,
            data: data,
            updated: 0,
            notFound: 0
          }
        }));
      } else {
        throw new Error(`Failed to extract data: ${result.details || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(`Error processing update file: ${err.message}`);
      setUpdateStatus(prev => ({
        ...prev,
        soldiers: { status: 'error', count: 0, data: [], updated: 0, notFound: 0 }
      }));
    }
    
    setIsProcessing(false);
  };

  const executeUpdate = async () => {
    setIsProcessing(true);
    setError('');
    
    try {
      console.log('Starting update process...');
      const updateData = updateStatus.soldiers.data;
      console.log('Update data to process:', updateData);
      
      let updatedCount = 0;
      let notFoundCount = 0;
      
      for (const soldierUpdate of updateData) { // Changed loop structure as per outline suggestion
        console.log(`Processing soldier:`, soldierUpdate);
        
        if (!soldierUpdate.soldier_id) {
          console.log('No soldier_id found, skipping...');
          notFoundCount++;
          continue;
        }
        
        // Find existing soldier
        console.log('Looking for soldier with ID:', soldierUpdate.soldier_id);
        const existingSoldiers = await Soldier.filter({ soldier_id: soldierUpdate.soldier_id });
        console.log('Found existing soldiers:', existingSoldiers);
        
        if (existingSoldiers.length > 0) {
          const existingSoldier = existingSoldiers[0];
          console.log('Found existing soldier:', existingSoldier);
          
          // Prepare update data
          const updateFields = {};
          
          // Check each field and add to update if it has a value
          const fieldsToUpdate = ['first_name', 'last_name', 'email', 'street_address', 'city', 'phone_number', 'division_name', 'team_name', 'profession'];
          
          fieldsToUpdate.forEach(field => {
            // Keep String() and trim() for robustness as per original code's intent
            if (soldierUpdate[field] && String(soldierUpdate[field]).trim() !== '') {
              updateFields[field] = String(soldierUpdate[field]).trim();
            }
          });
          
          console.log('Update fields:', updateFields);
          
          if (Object.keys(updateFields).length > 0) {
            updateFields.enlistment_status = 'completed'; // Set status to completed on update
            console.log('Updating soldier with ID:', existingSoldier.id);
            await Soldier.update(existingSoldier.id, updateFields);
            updatedCount++;
            console.log('Successfully updated soldier');
          } else {
            console.log('No fields to update for this soldier.');
          }
        } else {
          console.log('Soldier not found with provided soldier_id.');
          notFoundCount++;
        }
      }
      
      console.log('Update completed. Updated:', updatedCount, 'Not found:', notFoundCount);
      
      setUpdateStatus(prev => ({
        ...prev,
        soldiers: {
          ...prev.soldiers,
          status: 'completed',
          updated: updatedCount,
          notFound: notFoundCount
        }
      }));
      
    } catch (err) {
      console.error('Update error:', err);
      setError(`Update failed: ${err.message}`);
      setUpdateStatus(prev => ({
        ...prev,
        soldiers: { ...prev.soldiers, status: 'error' }
      }));
    }
    
    setIsProcessing(false);
  };

  const generateEquipmentTemplate = async () => {
    setIsGeneratingTemplate(true);
    setError(''); // Clear any previous error
    try {
      // Get all existing equipment to extract unique types
      const allEquipment = await Equipment.list();
      const equipmentTypes = [...new Set(allEquipment.map(e => e.equipment_type))].sort();
      
      // Create CSV header
      const headers = ['soldier_id', 'division_name', ...equipmentTypes];
      
      // Create sample rows
      const sampleRows = [
        ['', 'Division A', ...equipmentTypes.map(() => '0')], // Division storage example
        ['S001', 'Division A', ...equipmentTypes.map((_, index) => index < 3 ? '1' : '0')], // Soldier example
        ['S002', 'Division B', ...equipmentTypes.map((_, index) => index === 0 ? '2' : '0')], // Another soldier example
      ];
      
      // Convert to CSV format
      const csvContent = [
        headers.join(','),
        ...sampleRows.map(row => row.join(','))
      ].join('\n');
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'equipment_assignment_template.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url); // Clean up the object URL
      
    } catch (error) {
      console.error('Error generating template:', error);
      setError('Failed to generate template. Please try again.');
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'uploaded': return <CheckCircle className="w-4 h-4 text-blue-600" />;
      default: return <Upload className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status, count) => {
    const colors = {
      pending: "bg-gray-100 text-gray-800",
      uploaded: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      error: "bg-red-100 text-red-800"
    };
    
    return (
      <Badge className={colors[status]}>
        {status.toUpperCase()} {count > 0 && `(${count})`}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Import & Update Data</h1>
        <p className="text-slate-600">Import new data or update existing records from CSV files</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create">Create New Records</TabsTrigger>
          <TabsTrigger value="update_assign">Update & Assign</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3].map(step => (
              <div key={step} className={`flex items-center gap-2 p-3 rounded-lg border ${
                currentStep >= step ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium ${
                  currentStep >= step ? 'bg-blue-600' : 'bg-gray-400'
                }`}>
                  {step}
                </div>
                <span className="font-medium text-sm">
                  {step === 1 && 'Upload Files'}
                  {step === 2 && 'Review & Import'}
                  {step === 3 && 'Complete'}
                </span>
              </div>
            ))}
          </div>

          {error && activeTab === 'create' && ( // Display error only if active tab is 'create'
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {currentStep === 1 && (
            <div className="space-y-6">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Important:</strong> Please export your Excel files as CSV format before uploading. 
                  In Excel, use "File → Save As → CSV (Comma delimited)" to convert your files.
                </AlertDescription>
              </Alert>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5" />
                    CSV File Upload Requirements
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                    <ImportStep
                      title="Soldiers CSV"
                      description="Columns: ID, First Name, Last Name, Division, Team, Profession, Phone, Email, Street Address, City"
                      fileType="soldiers"
                      status={importStatus.soldiers}
                      onUpload={handleFileUpload}
                      isProcessing={isProcessing}
                    />
                    <ImportStep
                      title="Weapons CSV"
                      description="Columns: ID, Type, Status, Division Name"
                      fileType="weapons"
                      status={importStatus.weapons}
                      onUpload={handleFileUpload}
                      isProcessing={isProcessing}
                    />
                    <ImportStep
                      title="Serialized Gear CSV"
                      description="Columns: ID, Type, Status, Division Name"
                      fileType="gear"
                      status={importStatus.gear}
                      onUpload={handleFileUpload}
                      isProcessing={isProcessing}
                    />
                    <ImportStep
                      title="Equipment CSV"
                      description="Columns: equipment_type, division_name, condition, quantity, serial_number, assigned_to"
                      fileType="equipment"
                      status={importStatus.equipment}
                      onUpload={handleFileUpload}
                      isProcessing={isProcessing}
                    />
                    <ImportStep
                      title="Drone Components CSV"
                      description="Columns: Component ID, Component Type, Status"
                      fileType="droneComponents"
                      status={importStatus.droneComponents}
                      onUpload={handleFileUpload}
                      isProcessing={isProcessing}
                    />
                    <ImportStep
                      title="Assignments CSV"
                      description="Columns: Soldier ID, Weapon ID, Gear ID"
                      fileType="assignments"
                      status={importStatus.assignments}
                      onUpload={handleFileUpload}
                      isProcessing={isProcessing}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button 
                  onClick={() => setCurrentStep(2)}
                  disabled={Object.values(importStatus).every(s => s.status === 'pending')}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Continue to Review
                </Button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Review Import Data</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(importStatus).map(([type, status]) => (
                      <div key={type} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(status.status)}
                          <div>
                            <p className="font-medium capitalize">{type.replace(/_/g, ' ')}</p>
                            <p className="text-sm text-slate-600">{status.count} records</p>
                          </div>
                        </div>
                        {getStatusBadge(status.status, status.count)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  Back to Upload
                </Button>
                <Button 
                  onClick={executeImport}
                  disabled={isProcessing || Object.values(importStatus).every(s => s.status === 'pending' || s.status === 'error')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isProcessing ? 'Importing...' : 'Execute Import'}
                </Button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-8 text-center">
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-green-900 mb-2">Import Completed Successfully!</h2>
                <p className="text-green-700 mb-6">
                  All data has been imported and assignments have been processed.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  {Object.entries(importStatus).map(([type, status]) => (
                    <div key={type} className="bg-white rounded-lg p-3 border border-green-200">
                      <p className="font-medium capitalize text-sm">{type.replace(/_/g, ' ')}</p>
                      <p className="text-2xl font-bold text-green-700">{status.count}</p>
                    </div>
                  ))}
                </div>
                <Button 
                  onClick={() => window.location.href = '/Dashboard'}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Go to Dashboard
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="update_assign" className="space-y-6">
          {error && activeTab === 'update_assign' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {/* Update Soldiers Card */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Update Existing Soldier Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <RefreshCw className="h-4 w-4" />
                <AlertDescription>
                  <strong>Update Existing Soldiers:</strong> Upload a CSV file with a `soldier_id` column and any other fields you want to update (e.g., `email`, `street_address`, `city`, `phone_number`). Only existing soldiers will be updated with the non-empty values you provide.
                </AlertDescription>
              </Alert>
              <UpdateSoldiersStep
                title="Soldier Update CSV"
                description="Columns: soldier_id (required), and any other fields like first_name, email, street_address, city, etc."
                status={updateStatus.soldiers}
                onUpload={handleUpdateFileUpload}
                isProcessing={isProcessing}
              />
              
              {updateStatus.soldiers.status === 'uploaded' && (
                <div className="flex justify-end">
                  <Button 
                    onClick={executeUpdate}
                    disabled={isProcessing}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isProcessing ? 'Updating...' : 'Execute Soldier Updates'}
                  </Button>
                </div>
              )}

              {updateStatus.soldiers.status === 'completed' && (
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-6 text-center">
                    <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-green-900 mb-2">Update Completed</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-white rounded-lg p-3 border border-green-200">
                        <p className="font-medium text-sm">Soldiers Updated</p>
                        <p className="text-2xl font-bold text-green-700">{updateStatus.soldiers.updated}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-amber-200">
                        <p className="font-medium text-sm">Soldiers Not Found</p>
                        <p className="text-2xl font-bold text-amber-600">{updateStatus.soldiers.notFound}</p>
                      </div>
                    </div>
                     <Button 
                      onClick={() => {
                        // Reset update status to allow another update session
                        setUpdateStatus({ soldiers: { status: 'pending', count: 0, data: [], updated: 0, notFound: 0 } });
                        setError(''); // Clear any previous error
                      }}
                      variant="outline"
                      className="mt-4"
                    >
                      Update More Soldiers
                    </Button>
                  </CardContent>
                </Card>
              )}
              {updateStatus.soldiers.status === 'error' && (
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="p-6 text-center">
                    <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-red-900 mb-2">Soldier Update Failed</h3>
                    <p className="text-red-700">Please check the error message and try again.</p>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
          
          {/* New Equipment Assignment Card */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Import Equipment Assignments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <Alert>
                <FileSpreadsheet className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p><strong>CSV Format Rules:</strong></p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li><strong>soldier_id:</strong> Leave empty to add equipment to division storage</li>
                      <li><strong>division_name:</strong> Always required - specifies which division</li>  
                      <li><strong>Equipment columns:</strong> Each column represents an equipment type with quantities.</li>
                      <li><strong>Serial numbers:</strong> Not required for bulk equipment assignments.</li>
                      <li><strong>Condition:</strong> Automatically set to "functioning" for all imported equipment.</li>
                    </ul>
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={generateEquipmentTemplate}
                        disabled={isGeneratingTemplate}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        {isGeneratingTemplate ? 'Generating...' : 'Download Template with Current Equipment Types'}
                      </Button>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

               <ImportStep
                title="Equipment Assignments CSV"
                description="Use the template above or create your own CSV with soldier_id, division_name, and equipment type columns."
                fileType="equipment_assignments"
                status={equipmentAssignmentStatus}
                onUpload={handleFileUpload}
                isProcessing={isProcessing}
              />
              
              {equipmentAssignmentStatus.status === 'uploaded' && (
                <div className="flex justify-end">
                  <Button 
                    onClick={executeEquipmentAssignmentImport}
                    disabled={isProcessing}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isProcessing ? 'Processing...' : `Process ${equipmentAssignmentStatus.count} Records`}
                  </Button>
                </div>
              )}
              
              {equipmentAssignmentStatus.status === 'completed' && (
                 <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-6">
                    <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-green-900 mb-2 text-center">Assignment Import Completed</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-white rounded-lg p-3 border border-green-200">
                        <p className="font-medium text-sm">Rows Processed</p>
                        <p className="text-2xl font-bold text-green-700">{equipmentAssignmentStatus.processed}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-amber-200">
                        <p className="font-medium text-sm">Rows with Errors</p>
                        <p className="text-2xl font-bold text-amber-600">{equipmentAssignmentStatus.errors}</p>
                      </div>
                    </div>
                    
                    {equipmentAssignmentStatus.processedItems && equipmentAssignmentStatus.processedItems.length > 0 && (
                      <div className="bg-white rounded-lg p-4 border border-green-200 mt-4">
                        <h4 className="font-medium text-sm text-green-900 mb-2">Import Details:</h4>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {equipmentAssignmentStatus.processedItems.slice(0, 20).map((item, index) => (
                            <p key={index} className="text-xs text-green-700">• {item}</p>
                          ))}
                          {equipmentAssignmentStatus.processedItems.length > 20 && (
                            <p className="text-xs text-green-600">... and {equipmentAssignmentStatus.processedItems.length - 20} more items</p>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <Button 
                      onClick={() => {
                        setEquipmentAssignmentStatus({ status: 'pending', count: 0, data: [], processed: 0, errors: 0, processedItems: [] });
                        setError('');
                      }}
                      variant="outline"
                      className="w-full mt-4"
                    >
                      Import More Equipment
                    </Button>
                  </CardContent>
                </Card>
              )}
              {equipmentAssignmentStatus.status === 'error' && (
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="p-6 text-center">
                    <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-red-900 mb-2">Assignment Import Failed</h3>
                    <p className="text-red-700">Please check the error message and file format. Processed: {equipmentAssignmentStatus.processed}, Errors: {equipmentAssignmentStatus.errors}</p>
                    {equipmentAssignmentStatus.processedItems && equipmentAssignmentStatus.processedItems.length > 0 && (
                      <div className="bg-white rounded-lg p-4 border border-red-200 mt-4">
                        <h4 className="font-medium text-sm text-red-900 mb-2">Partial Import Details:</h4>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {equipmentAssignmentStatus.processedItems.slice(0, 20).map((item, index) => (
                            <p key={index} className="text-xs text-red-700">• {item}</p>
                          ))}
                          {equipmentAssignmentStatus.processedItems.length > 20 && (
                            <p className="text-xs text-red-600">... and {equipmentAssignmentStatus.processedItems.length - 20} more items</p>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>
    </div>
  );
}
