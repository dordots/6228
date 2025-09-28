// Conditionally import Base44 SDK
let base44 = null;

// Only initialize Base44 client if not using Firebase
const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE !== 'false';

// Initialize Base44 client asynchronously
const initBase44 = async () => {
  if (!USE_FIREBASE) {
    try {
      const base44Module = await import('@base44/sdk');
      const createClient = base44Module.createClient;
      
      // Create a client with authentication required
      base44 = createClient({
        appId: "68cf9fe0686c5871dd720958", 
        requiresAuth: true // Ensure authentication is required for all operations
      });
      
      console.log('Base44 client initialized');
    } catch (e) {
      // Base44 SDK not available
      console.log('Base44 SDK not available:', e);
    }
  } else {
    console.log('Firebase mode - Base44 client not initialized');
  }
};

// Initialize on module load
initBase44();

export { base44 };
