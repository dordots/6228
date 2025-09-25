import { httpsCallable } from 'firebase/functions';
import { functions } from './config';

// Create a wrapper for Firebase Functions
const createFunction = (name) => {
  const fn = httpsCallable(functions, name);
  
  return async (data = {}) => {
    try {
      const result = await fn(data);
      return {
        success: true,
        data: result.data,
        status: 200
      };
    } catch (error) {
      console.error(`Error calling ${name}:`, error);
      
      // Return error in a format similar to Base44
      return {
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
        status: 500
      };
    }
  };
};

// Export all functions
export const firebaseFunctions = {
  // Auth functions
  generateTotp: createFunction('generateTotp'),
  verifyTotp: createFunction('verifyTotp'),
  updateUserData: createFunction('updateUserData'),
  
  // Email functions
  sendEmailViaSendGrid: createFunction('sendEmailViaSendGrid'),
  testSendGrid: createFunction('testSendGrid'),
  sendDailyReport: createFunction('sendDailyReport'),
  
  // Form functions
  generateSigningForm: createFunction('generateSigningForm'),
  generateReleaseForm: createFunction('generateReleaseForm'),
  sendSigningForm: createFunction('sendSigningForm'),
  sendReleaseFormByActivity: createFunction('sendReleaseFormByActivity'),
  sendBulkEquipmentForms: createFunction('sendBulkEquipmentForms'),
  
  // Data management functions
  exportAllData: createFunction('exportAllData'),
  deleteAllEquipment: createFunction('deleteAllEquipment'),
  deleteAllSoldiers: createFunction('deleteAllSoldiers'),
  deleteAllWeapons: createFunction('deleteAllWeapons'),
  deleteAllSerializedGear: createFunction('deleteAllSerializedGear'),
};