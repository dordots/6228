// Conditionally import Base44 SDK
let createClient;
try {
  const base44Module = await import('@base44/sdk');
  createClient = base44Module.createClient;
} catch (e) {
  // Base44 SDK not available
}

// Only initialize Base44 client if not using Firebase
const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE !== 'false';

let base44 = null;

if (!USE_FIREBASE && createClient) {
  // Create a client with authentication required
  base44 = createClient({
    appId: "68cf9fe0686c5871dd720958", 
    requiresAuth: true // Ensure authentication is required for all operations
  });
  
  console.log('Base44 client initialized');
} else {
  console.log('Firebase mode - Base44 client not initialized');
}

export { base44 };
