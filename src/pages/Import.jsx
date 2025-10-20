
import React, { useState } from "react";
import { Soldier, Weapon, SerializedGear, DroneSet, DroneComponent, Equipment, User, ActivityLog } from "@/api/entities";
import { UploadFile, ExtractDataFromUploadedFile } from "@/api/integrations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertTriangle, Upload, FileSpreadsheet, RefreshCw, Users, Shield, Package, Cpu, AlertCircle, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  parseCSV, 
  detectFileType, 
  validateEntityData, 
  formatPhoneNumber, 
  mapColumns, 
  generateImportSummary 
} from "@/utils/importUtils";
import { auth } from '@/firebase/config';

import ImportStep from "../components/import/ImportStep";
import UpdateSoldiersStep from "../components/import/UpdateSoldiersStep";
import ImportProgressModal from "../components/import/ImportProgressModal";

export default function ImportPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [importStatus, setImportStatus] = useState({
    soldiers: { status: 'pending', count: 0, data: [], errors: [], warnings: [] },
    weapons: { status: 'pending', count: 0, data: [], errors: [], warnings: [] },
    serialized_gear: { status: 'pending', count: 0, data: [], errors: [], warnings: [] },
    drone_sets: { status: 'pending', count: 0, data: [], errors: [], warnings: [] },
    drone_components: { status: 'pending', count: 0, data: [], errors: [], warnings: [] },
    equipment: { status: 'pending', count: 0, data: [], errors: [], warnings: [] },
    assignments: { status: 'pending', count: 0, data: [], errors: [], warnings: [] }
  });
  
  // New state for division-specific imports
  const [divisionImportStatus, setDivisionImportStatus] = useState({
    serialized_items: { status: 'pending', count: 0, data: [], division: null },
    equipment: { status: 'pending', count: 0, data: [], division: null }
  });
  
  // Progress tracking state
  const [importProgress, setImportProgress] = useState({
    isImporting: false,
    currentEntity: '',
    currentIndex: 0,
    totalItems: 0,
    entityProgress: {},
    errors: [],
    summary: null
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
      // Auto-detect file type from filename
      const detectedType = detectFileType(file.name);
      if (detectedType !== 'unknown' && detectedType !== fileType) {
        console.log(`File type mismatch: expected ${fileType}, detected ${detectedType}`);
      }
      
      console.log('Uploading file:', file.name, 'Type:', fileType);
      
      // Read file content directly for CSV parsing
      const text = await file.text();
      const rawData = parseCSV(text);
      
      if (rawData.length === 0) {
        throw new Error('No data found in CSV file');
      }
      
      // Map columns based on entity type
      const mappedData = mapColumns(rawData, fileType);
      
      // Validate data
      const validation = validateEntityData(mappedData, fileType);
      
      // Process based on file type
      let processedData = mappedData;
      
      // Special handling for specific entity types
      if (fileType === 'soldiers') {
        processedData = mappedData.map(soldier => ({
          ...soldier,
          phone_number: soldier.phone_number ? formatPhoneNumber(soldier.phone_number) : null
        }));
      }
      
      // Update import status with data and validation results
      if (fileType === 'equipment_assignments') {
        setEquipmentAssignmentStatus(prev => ({
          ...prev,
          status: validation.isValid ? 'uploaded' : 'warning',
          count: processedData.length,
          data: processedData,
          processedItems: []
        }));
      } else if (fileType.startsWith('division_')) {
        // Handle division-specific imports
        const divisionMatch = file.name.match(/^(.+?)_/);
        const divisionName = divisionMatch ? divisionMatch[1] : null;
        const importType = fileType.includes('serialized') ? 'serialized_items' : 'equipment';
        
        setDivisionImportStatus(prev => ({
          ...prev,
          [importType]: {
            status: validation.isValid ? 'uploaded' : 'warning',
            count: processedData.length,
            data: processedData,
            division: divisionName,
            errors: validation.errors,
            warnings: validation.warnings
          }
        }));
      } else {
        setImportStatus(prev => ({
          ...prev,
          [fileType]: {
            status: validation.isValid ? 'uploaded' : 'warning',
            count: processedData.length,
            data: processedData,
            errors: validation.errors,
            warnings: validation.warnings
          }
        }));
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

  // Helper function to process entity imports with progress tracking
  const processEntityImport = async (entityName, entityData, createFunction, idField) => {
    setImportProgress(prev => ({
      ...prev,
      currentEntity: entityName,
      entityProgress: {
        ...prev.entityProgress,
        [entityName]: { total: entityData.length, processed: 0, success: 0, failed: 0, status: 'processing' }
      }
    }));
    
    const results = [];
    let entityIndex = 0;
    
    for (const item of entityData) {
      try {
        await createFunction(item);
        results.push({ id: item[idField], success: true });
        
        // Update progress
        entityIndex++;
        setImportProgress(prev => ({
          ...prev,
          currentIndex: prev.currentIndex + 1,
          entityProgress: {
            ...prev.entityProgress,
            [entityName]: {
              ...prev.entityProgress[entityName],
              processed: entityIndex,
              success: prev.entityProgress[entityName].success + 1
            }
          }
        }));
      } catch (error) {
        results.push({ 
          id: item[idField], 
          success: false, 
          error: error.message,
          data: item
        });
        
        const errorDetail = {
          entity: entityName,
          id: item[idField],
          message: error.message,
          data: item
        };
        
        // Update progress with error
        entityIndex++;
        setImportProgress(prev => ({
          ...prev,
          currentIndex: prev.currentIndex + 1,
          entityProgress: {
            ...prev.entityProgress,
            [entityName]: {
              ...prev.entityProgress[entityName],
              processed: entityIndex,
              failed: prev.entityProgress[entityName].failed + 1
            }
          },
          errors: [...prev.errors, errorDetail]
        }));
      }
    }
    
    // Mark entity as completed
    setImportProgress(prev => ({
      ...prev,
      entityProgress: {
        ...prev.entityProgress,
        [entityName]: { ...prev.entityProgress[entityName], status: 'completed' }
      }
    }));
    
    return results;
  };

  const executeImport = async () => {
    setIsProcessing(true);
    const importResults = [];
    const allErrors = [];
    
    // Force token refresh to ensure we have latest permissions
    try {
      const user = auth.currentUser;
      if (user) {
        await user.getIdToken(true); // Force refresh
      }
    } catch (error) {
      console.error('Token refresh error:', error);
    }
    
    // Calculate total items to process
    const totalItems = Object.values(importStatus).reduce((sum, status) => sum + status.data.length, 0);
    
    // Initialize progress
    setImportProgress({
      isImporting: true,
      currentEntity: '',
      currentIndex: 0,
      totalItems,
      entityProgress: {},
      errors: [],
      summary: null
    });
    
    try {
      // Import soldiers first (special handling for user creation)
      if (importStatus.soldiers.data.length > 0) {
        setImportProgress(prev => ({
          ...prev,
          currentEntity: 'soldiers',
          entityProgress: {
            ...prev.entityProgress,
            soldiers: { total: importStatus.soldiers.data.length, processed: 0, success: 0, failed: 0, status: 'processing' }
          }
        }));
        
        const results = [];
        let soldierIndex = 0;
        
        for (const soldier of importStatus.soldiers.data) {
          try {
            // Validate soldier_id exists
            if (!soldier.soldier_id || String(soldier.soldier_id).trim() === '') {
              console.error('[Import] ERROR: Soldier missing soldier_id, skipping:', soldier);

              results.push({
                id: 'UNKNOWN',
                success: false,
                error: 'Missing soldier_id - this field is required',
                data: soldier
              });

              const errorDetail = {
                entity: 'soldiers',
                id: 'UNKNOWN',
                message: 'Missing soldier_id - this field is required',
                data: soldier
              };
              allErrors.push(errorDetail);

              soldierIndex++;
              setImportProgress(prev => ({
                ...prev,
                currentIndex: prev.currentIndex + 1,
                entityProgress: {
                  ...prev.entityProgress,
                  soldiers: {
                    ...prev.entityProgress.soldiers,
                    processed: soldierIndex,
                    failed: prev.entityProgress.soldiers.failed + 1
                  }
                },
                errors: [...prev.errors, errorDetail]
              }));

              continue;
            }

            // Check if soldier already exists in database
            // Note: Using findById instead of filter because filter returns all soldiers
            console.log('[Import] Checking if soldier exists:', soldier.soldier_id);
            let existingSoldier = null;
            try {
              existingSoldier = await Soldier.findById(soldier.soldier_id);
              console.log('[Import] findById result for soldier_id', soldier.soldier_id, ':', existingSoldier);
            } catch (findError) {
              // Soldier doesn't exist - this is expected for new soldiers
              console.log('[Import] Soldier does not exist (this is good for new imports)');
            }

            if (existingSoldier) {
              console.warn('[Import] Soldier already exists, skipping:', soldier.soldier_id, soldier.first_name, soldier.last_name);
              console.warn('[Import] Existing soldier data:', existingSoldier);

              results.push({
                id: soldier.soldier_id,
                success: false,
                error: `Soldier with ID "${soldier.soldier_id}" already exists in database`,
                data: soldier
              });

              const errorDetail = {
                entity: 'soldiers',
                id: soldier.soldier_id,
                message: `Soldier with ID "${soldier.soldier_id}" already exists in database`,
                data: soldier
              };
              allErrors.push(errorDetail);

              soldierIndex++;
              setImportProgress(prev => ({
                ...prev,
                currentIndex: prev.currentIndex + 1,
                entityProgress: {
                  ...prev.entityProgress,
                  soldiers: {
                    ...prev.entityProgress.soldiers,
                    processed: soldierIndex,
                    failed: prev.entityProgress.soldiers.failed + 1
                  }
                },
                errors: [...prev.errors, errorDetail]
              }));

              continue;
            }

            // Soldier doesn't exist - create it
            console.log('[Import] Creating new soldier:', soldier.soldier_id, soldier.first_name, soldier.last_name);

            // Ensure soldier_id is trimmed before creating
            const soldierToCreate = {
              ...soldier,
              soldier_id: soldier.soldier_id.trim()
            };
            await Soldier.create(soldierToCreate);
            
            // Auto-create user account if phone number exists
            if (soldier.phone_number) {
              try {
                const userData = {
                  phoneNumber: soldier.phone_number,
                  role: 'soldier',
                  custom_role: 'soldier',
                  linked_soldier_id: soldier.soldier_id,
                  displayName: `${soldier.first_name} ${soldier.last_name}`
                };
                
                // Only add email if it's valid
                if (soldier.email && soldier.email.includes('@')) {
                  userData.email = soldier.email;
                }
                
                await User.create(userData);
              } catch (userError) {
                console.log('User account already exists or creation failed:', userError);
                // Don't fail the soldier import if user creation fails
              }
            }
            
            results.push({ id: soldier.soldier_id, success: true });
            
            // Update progress
            soldierIndex++;
            setImportProgress(prev => ({
              ...prev,
              currentIndex: prev.currentIndex + 1,
              entityProgress: {
                ...prev.entityProgress,
                soldiers: {
                  ...prev.entityProgress.soldiers,
                  processed: soldierIndex,
                  success: prev.entityProgress.soldiers.success + 1
                }
              }
            }));
          } catch (error) {
            results.push({ 
              id: soldier.soldier_id, 
              success: false, 
              error: error.message,
              data: soldier
            });
            
            const errorDetail = {
              entity: 'soldiers',
              id: soldier.soldier_id,
              message: error.message,
              data: soldier
            };
            allErrors.push(errorDetail);
            
            // Update progress with error
            soldierIndex++;
            setImportProgress(prev => ({
              ...prev,
              currentIndex: prev.currentIndex + 1,
              entityProgress: {
                ...prev.entityProgress,
                soldiers: {
                  ...prev.entityProgress.soldiers,
                  processed: soldierIndex,
                  failed: prev.entityProgress.soldiers.failed + 1
                }
              },
              errors: [...prev.errors, errorDetail]
            }));
          }
        }
        
        importResults.push({ entity: 'soldiers', results });
        setImportStatus(prev => ({
          ...prev,
          soldiers: { ...prev.soldiers, status: 'completed' }
        }));
        
        // Mark entity as completed
        setImportProgress(prev => ({
          ...prev,
          entityProgress: {
            ...prev.entityProgress,
            soldiers: { ...prev.entityProgress.soldiers, status: 'completed' }
          }
        }));
      }

      // Import weapons
      if (importStatus.weapons.data.length > 0) {
        const results = await processEntityImport('weapons', importStatus.weapons.data, Weapon.create.bind(Weapon), 'weapon_id');
        
        importResults.push({ entity: 'weapons', results });
        setImportStatus(prev => ({
          ...prev,
          weapons: { ...prev.weapons, status: 'completed' }
        }));
      }

      // Import serialized gear
      if (importStatus.serialized_gear.data.length > 0) {
        const results = await processEntityImport('serialized_gear', importStatus.serialized_gear.data, SerializedGear.create.bind(SerializedGear), 'gear_id');
        importResults.push({ entity: 'serialized_gear', results });
        setImportStatus(prev => ({
          ...prev,
          serialized_gear: { ...prev.serialized_gear, status: 'completed' }
        }));
      }

      // Import drone sets
      if (importStatus.drone_sets.data.length > 0) {
        const results = await processEntityImport('drone_sets', importStatus.drone_sets.data, DroneSet.create.bind(DroneSet), 'drone_set_id');
        importResults.push({ entity: 'drone_sets', results });
        setImportStatus(prev => ({
          ...prev,
          drone_sets: { ...prev.drone_sets, status: 'completed' }
        }));
      }

      // Import drone components
      if (importStatus.drone_components.data.length > 0) {
        const results = await processEntityImport('drone_components', importStatus.drone_components.data, DroneComponent.create.bind(DroneComponent), 'component_id');
        importResults.push({ entity: 'drone_components', results });
        setImportStatus(prev => ({
          ...prev,
          drone_components: { ...prev.drone_components, status: 'completed' }
        }));
      }

      // Import equipment
      if (importStatus.equipment.data.length > 0) {
        const results = await processEntityImport('equipment', importStatus.equipment.data, Equipment.create.bind(Equipment), 'equipment_id');
        importResults.push({ entity: 'equipment', results });
        setImportStatus(prev => ({
          ...prev,
          equipment: { ...prev.equipment, status: 'completed' }
        }));
      }

      // Process assignments
      if (importStatus.assignments.data.length > 0) {
        const results = [];
        
        for (const assignment of importStatus.assignments.data) {
          try {
            // Update weapon assignments
            if (assignment.weapon_id) {
              const weapon = await Weapon.findById(assignment.weapon_id);
              if (weapon) {
                await Weapon.update(weapon.id, { assigned_to: assignment.soldier_id });
              }
            }
            
            // Update gear assignments
            if (assignment.gear_id) {
              const gear = await SerializedGear.findById(assignment.gear_id);
              if (gear) {
                await SerializedGear.update(gear.id, { assigned_to: assignment.soldier_id });
              }
            }
            
            results.push({ 
              id: `${assignment.soldier_id}_${assignment.weapon_id || assignment.gear_id}`, 
              success: true 
            });
          } catch (error) {
            results.push({ 
              id: `${assignment.soldier_id}_${assignment.weapon_id || assignment.gear_id}`, 
              success: false, 
              error: error.message,
              data: assignment
            });
          }
        }
        
        importResults.push({ entity: 'assignments', results });
        setImportStatus(prev => ({
          ...prev,
          assignments: { ...prev.assignments, status: 'completed' }
        }));
      }

      // Calculate import summary
      const allResults = importResults.reduce((acc, item) => acc.concat(item.results), []);
      console.log('[Import] importResults:', importResults);
      console.log('[Import] allResults:', allResults);
      const summary = generateImportSummary(allResults);
      console.log('[Import] Generated summary:', summary);

      // Calculate summary by entity
      const summaryByEntity = {};
      importResults.forEach(({ entity, results }) => {
        const success = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        summaryByEntity[entity] = { success, failed, total: results.length };
      });
      console.log('[Import] Summary by entity:', summaryByEntity);

      // Log import activity (optional - don't fail import if logging fails)
      try {
        await ActivityLog.create({
          activity_type: 'IMPORT',
          details: `Bulk import completed: ${summary.totals.successful} successful, ${summary.totals.failed} failed`,
          context: summary
        });
      } catch (logError) {
        console.warn('[Import] Failed to log activity, but import completed successfully:', logError);
      }

      // Update progress with final summary
      setImportProgress(prev => ({
        ...prev,
        isImporting: false,
        summary: {
          successful: summary.totals.successful,
          failed: summary.totals.failed,
          total: summary.totals.processed,
          byEntity: summaryByEntity
        }
      }));

      setCurrentStep(3);
    } catch (err) {
      console.error('Import error:', err);
      setError(`Import failed: ${err.message}`);
      
      // Show error in progress modal
      setImportProgress(prev => ({
        ...prev,
        isImporting: false,
        summary: {
          successful: 0,
          failed: 0,
          total: 0,
          error: err.message
        }
      }));
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
    
    // Initialize progress tracking
    const totalItems = updateStatus.soldiers.data.length;
    setImportProgress({
      isImporting: true,
      currentEntity: 'soldier_updates',
      currentIndex: 0,
      totalItems,
      entityProgress: {
        soldier_updates: { total: totalItems, processed: 0, success: 0, failed: 0, status: 'processing' }
      },
      errors: [],
      summary: null
    });
    
    try {
      console.log('Starting update process...');
      const updateData = updateStatus.soldiers.data;
      console.log('Update data to process:', updateData);
      
      let updatedCount = 0;
      let notFoundCount = 0;
      let processedIndex = 0;
      
      for (const soldierUpdate of updateData) {
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

              {/* Core Entity Imports */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5" />
                    Core Entity Imports
                  </CardTitle>
                  <CardDescription>
                    Import primary data entities. Files should match the export format.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <ImportStep
                      title="Personnel (Soldiers)"
                      description="Personnel_YYYY-MM-DD.csv - soldier_id, first_name, last_name, phone_number, division_name, team_name"
                      fileType="soldiers"
                      status={importStatus.soldiers}
                      onUpload={handleFileUpload}
                      isProcessing={isProcessing}
                    />
                    <ImportStep
                      title="Weapons"
                      description="Weapons_YYYY-MM-DD.csv - weapon_id, weapon_type, status, division_name, assigned_to"
                      fileType="weapons"
                      status={importStatus.weapons}
                      onUpload={handleFileUpload}
                      isProcessing={isProcessing}
                    />
                    <ImportStep
                      title="Serialized Gear"
                      description="Serialized_Gear_YYYY-MM-DD.csv - gear_id, gear_type, status, division_name, assigned_to"
                      fileType="serialized_gear"
                      status={importStatus.serialized_gear}
                      onUpload={handleFileUpload}
                      isProcessing={isProcessing}
                    />
                    <ImportStep
                      title="Drone Sets"
                      description="Drone_Sets_YYYY-MM-DD.csv - drone_set_id, set_serial_number, status, division_name, assigned_to"
                      fileType="drone_sets"
                      status={importStatus.drone_sets}
                      onUpload={handleFileUpload}
                      isProcessing={isProcessing}
                    />
                    <ImportStep
                      title="Drone Components"
                      description="Drone_Components_YYYY-MM-DD.csv - component_id, component_type, drone_set_id"
                      fileType="drone_components"
                      status={importStatus.drone_components}
                      onUpload={handleFileUpload}
                      isProcessing={isProcessing}
                    />
                    <ImportStep
                      title="Equipment"
                      description="Equipment_YYYY-MM-DD.csv - equipment_id, equipment_type, quantity, division_name"
                      fileType="equipment"
                      status={importStatus.equipment}
                      onUpload={handleFileUpload}
                      isProcessing={isProcessing}
                    />
                  </div>
                  
                  {/* Show validation warnings/errors */}
                  {Object.entries(importStatus).map(([type, status]) => 
                    status.warnings?.length > 0 || status.errors?.length > 0 ? (
                      <Alert key={type} className={status.errors?.length > 0 ? "border-red-200" : "border-yellow-200"}>
                        <AlertCircle className="w-4 h-4" />
                        <AlertTitle>{type.replace(/_/g, ' ')} validation issues</AlertTitle>
                        <AlertDescription>
                          {status.errors?.map((err, idx) => (
                            <div key={idx} className="text-red-600 text-sm">
                              Row {err.row}: {err.message}
                            </div>
                          ))}
                          {status.warnings?.map((warn, idx) => (
                            <div key={idx} className="text-yellow-600 text-sm">
                              Row {warn.row}: {warn.message}
                            </div>
                          ))}
                        </AlertDescription>
                      </Alert>
                    ) : null
                  )}
                </CardContent>
              </Card>

              {/* Assignments Import */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Assignments Import
                  </CardTitle>
                  <CardDescription>
                    Import weapon and gear assignments to soldiers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ImportStep
                    title="Assignments CSV"
                    description="Columns: soldier_id, weapon_id, gear_id - Links soldiers to their assigned equipment"
                    fileType="assignments"
                    status={importStatus.assignments}
                    onUpload={handleFileUpload}
                    isProcessing={isProcessing}
                  />
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
      
      {/* Import Progress Modal */}
      <ImportProgressModal 
        progress={importProgress} 
        onClose={() => {
          if (!importProgress.isImporting && importProgress.summary) {
            setImportProgress(prev => ({ ...prev, summary: null }));
          }
        }}
      />
    </div>
  );
}
