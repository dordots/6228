const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
admin.initializeApp();

// Get the app project ID
const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || "project-1386902152066454120";

// Import function modules
const authFunctions = require("./src/auth");
const emailFunctions = require("./src/email");
const dataFunctions = require("./src/data");
const formFunctions = require("./src/forms");

// Export all functions
module.exports = {
  // Authentication Functions
  generateTotp: authFunctions.generateTotp,
  verifyTotp: authFunctions.verifyTotp,
  updateUserData: authFunctions.updateUserData,
  
  // Email Functions
  sendEmailViaSendGrid: emailFunctions.sendEmailViaSendGrid,
  testSendGrid: emailFunctions.testSendGrid,
  sendDailyReport: emailFunctions.sendDailyReport,
  
  // Form Functions
  generateSigningForm: formFunctions.generateSigningForm,
  generateReleaseForm: formFunctions.generateReleaseForm,
  sendSigningForm: formFunctions.sendSigningForm,
  sendReleaseFormByActivity: formFunctions.sendReleaseFormByActivity,
  sendBulkEquipmentForms: formFunctions.sendBulkEquipmentForms,
  
  // Data Management Functions
  exportAllData: dataFunctions.exportAllData,
  deleteAllEquipment: dataFunctions.deleteAllEquipment,
  deleteAllSoldiers: dataFunctions.deleteAllSoldiers,
  deleteAllWeapons: dataFunctions.deleteAllWeapons,
  deleteAllSerializedGear: dataFunctions.deleteAllSerializedGear,
};