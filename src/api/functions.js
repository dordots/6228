import { base44 } from './base44Client';


export const sendDailyReport = base44.functions.sendDailyReport;

export const deleteAllEquipment = base44.functions.deleteAllEquipment;

export const deleteAllSoldiers = base44.functions.deleteAllSoldiers;

export const deleteAllWeapons = base44.functions.deleteAllWeapons;

export const deleteAllSerializedGear = base44.functions.deleteAllSerializedGear;

export const generateTotp = base44.functions.generateTotp;

export const verifyTotp = base44.functions.verifyTotp;

export const exportAllData = base44.functions.exportAllData;

export const generateSigningForm = base44.functions.generateSigningForm;

export const generateReleaseForm = base44.functions.generateReleaseForm;

export const sendSigningForm = base44.functions.sendSigningForm;

export const sendReleaseFormByActivity = base44.functions.sendReleaseFormByActivity;

export const sendBulkEquipmentForms = base44.functions.sendBulkEquipmentForms;

export const sendEmailViaSendGrid = base44.functions.sendEmailViaSendGrid;

export const testSendGrid = base44.functions.testSendGrid;

