import { base44 } from './base44Client';
import { firebaseFunctions } from '../firebase/functions';

// Use Firebase functions if enabled, otherwise fall back to Base44
const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE !== 'false';

let sendDailyReport, deleteAllEquipment, deleteAllSoldiers, deleteAllWeapons, 
    deleteAllSerializedGear, generateTotp, verifyTotp, exportAllData,
    generateSigningForm, generateReleaseForm, sendSigningForm, 
    sendReleaseFormByActivity, sendBulkEquipmentForms, sendEmailViaSendGrid, testSendGrid;

if (USE_FIREBASE) {
  // Use real Firebase functions
  sendDailyReport = firebaseFunctions.sendDailyReport;
  deleteAllEquipment = firebaseFunctions.deleteAllEquipment;
  deleteAllSoldiers = firebaseFunctions.deleteAllSoldiers;
  deleteAllWeapons = firebaseFunctions.deleteAllWeapons;
  deleteAllSerializedGear = firebaseFunctions.deleteAllSerializedGear;
  generateTotp = firebaseFunctions.generateTotp;
  verifyTotp = firebaseFunctions.verifyTotp;
  exportAllData = firebaseFunctions.exportAllData;
  generateSigningForm = firebaseFunctions.generateSigningForm;
  generateReleaseForm = firebaseFunctions.generateReleaseForm;
  sendSigningForm = firebaseFunctions.sendSigningForm;
  sendReleaseFormByActivity = firebaseFunctions.sendReleaseFormByActivity;
  sendBulkEquipmentForms = firebaseFunctions.sendBulkEquipmentForms;
  sendEmailViaSendGrid = firebaseFunctions.sendEmailViaSendGrid;
  testSendGrid = firebaseFunctions.testSendGrid;
  
  console.log('Using Firebase functions');
} else {
  // Use Base44 SDK
  if (base44 && base44.functions) {
    sendDailyReport = base44.functions.sendDailyReport;
    deleteAllEquipment = base44.functions.deleteAllEquipment;
    deleteAllSoldiers = base44.functions.deleteAllSoldiers;
    deleteAllWeapons = base44.functions.deleteAllWeapons;
    deleteAllSerializedGear = base44.functions.deleteAllSerializedGear;
    generateTotp = base44.functions.generateTotp;
    verifyTotp = base44.functions.verifyTotp;
    exportAllData = base44.functions.exportAllData;
    generateSigningForm = base44.functions.generateSigningForm;
    generateReleaseForm = base44.functions.generateReleaseForm;
    sendSigningForm = base44.functions.sendSigningForm;
    sendReleaseFormByActivity = base44.functions.sendReleaseFormByActivity;
    sendBulkEquipmentForms = base44.functions.sendBulkEquipmentForms;
    sendEmailViaSendGrid = base44.functions.sendEmailViaSendGrid;
    testSendGrid = base44.functions.testSendGrid;
  }
  
  console.log('Using Base44 functions');
}

// Export functions
export {
  sendDailyReport,
  deleteAllEquipment,
  deleteAllSoldiers,
  deleteAllWeapons,
  deleteAllSerializedGear,
  generateTotp,
  verifyTotp,
  exportAllData,
  generateSigningForm,
  generateReleaseForm,
  sendSigningForm,
  sendReleaseFormByActivity,
  sendBulkEquipmentForms,
  sendEmailViaSendGrid,
  testSendGrid
};