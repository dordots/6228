import { base44 } from './base44Client';

// Use Firebase integrations if enabled, otherwise fall back to Base44
const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE !== 'false';

let Core, InvokeLLM, SendEmail, UploadFile, GenerateImage, 
    ExtractDataFromUploadedFile, CreateFileSignedUrl, UploadPrivateFile;

if (USE_FIREBASE) {
  // Firebase integration stubs - these will be implemented as needed
  const notImplemented = (name) => async () => {
    console.warn(`Firebase integration '${name}' not implemented yet`);
    return { success: false, message: 'Integration not implemented in Firebase yet' };
  };
  
  Core = {};
  InvokeLLM = notImplemented('InvokeLLM');
  SendEmail = notImplemented('SendEmail');
  UploadFile = notImplemented('UploadFile');
  GenerateImage = notImplemented('GenerateImage');
  ExtractDataFromUploadedFile = notImplemented('ExtractDataFromUploadedFile');
  CreateFileSignedUrl = notImplemented('CreateFileSignedUrl');
  UploadPrivateFile = notImplemented('UploadPrivateFile');
  
  console.log('Using Firebase integrations (stubs)');
} else {
  // Use Base44 SDK
  if (base44 && base44.integrations) {
    Core = base44.integrations.Core;
    InvokeLLM = base44.integrations.Core.InvokeLLM;
    SendEmail = base44.integrations.Core.SendEmail;
    UploadFile = base44.integrations.Core.UploadFile;
    GenerateImage = base44.integrations.Core.GenerateImage;
    ExtractDataFromUploadedFile = base44.integrations.Core.ExtractDataFromUploadedFile;
    CreateFileSignedUrl = base44.integrations.Core.CreateFileSignedUrl;
    UploadPrivateFile = base44.integrations.Core.UploadPrivateFile;
  }
  
  console.log('Using Base44 integrations');
}

// Export integrations
export {
  Core,
  InvokeLLM,
  SendEmail,
  UploadFile,
  GenerateImage,
  ExtractDataFromUploadedFile,
  CreateFileSignedUrl,
  UploadPrivateFile
};