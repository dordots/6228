import { 
  collection, doc, getDoc, getDocs, addDoc, updateDoc, setDoc,
  deleteDoc, query, where, orderBy, limit, startAfter, Timestamp,
  writeBatch, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';

// Helper to convert Firestore document to Base44-like format
const convertDoc = (doc) => {
  if (!doc.exists()) return null;

  const data = doc.data();

  // Extract 'id' from document data (if it exists) so it doesn't overwrite doc.id
  const { id: dataId, ...restData } = data;

  return {
    ...restData,    // Spread data WITHOUT the id field
    id: doc.id,     // ALWAYS use Firestore document ID (takes precedence)
    // Convert Firestore timestamps to Date objects
    created_at: data.created_at?.toDate?.() || data.created_at || null,
    updated_at: data.updated_at?.toDate?.() || data.updated_at || null,
    arrival_date: data.arrival_date?.toDate?.() || data.arrival_date || null,
    last_maintenance: data.last_maintenance?.toDate?.() || data.last_maintenance || null
  };
};

// Helper to prepare data for Firestore
const prepareData = (data) => {
  const prepared = { ...data };
  
  // Convert date strings to Firestore timestamps
  if (prepared.created_at && typeof prepared.created_at === 'string') {
    prepared.created_at = Timestamp.fromDate(new Date(prepared.created_at));
  }
  if (prepared.updated_at && typeof prepared.updated_at === 'string') {
    prepared.updated_at = Timestamp.fromDate(new Date(prepared.updated_at));
  }
  if (prepared.arrival_date && typeof prepared.arrival_date === 'string') {
    prepared.arrival_date = Timestamp.fromDate(new Date(prepared.arrival_date));
  }
  if (prepared.last_maintenance && typeof prepared.last_maintenance === 'string') {
    prepared.last_maintenance = Timestamp.fromDate(new Date(prepared.last_maintenance));
  }
  
  // Remove undefined values
  Object.keys(prepared).forEach(key => {
    if (prepared[key] === undefined) {
      delete prepared[key];
    }
  });
  
  return prepared;
};

// Build Firestore query from options
const buildQuery = (collectionRef, options = {}) => {
  let q = collectionRef;
  
  // Where clauses
  if (options.where) {
    Object.entries(options.where).forEach(([field, condition]) => {
      if (condition === null || condition === undefined) {
        q = query(q, where(field, '==', null));
      } else if (typeof condition === 'object' && !Array.isArray(condition)) {
        // Handle operators
        Object.entries(condition).forEach(([operator, value]) => {
          switch(operator) {
            case 'equals':
              q = query(q, where(field, '==', value));
              break;
            case 'not':
              q = query(q, where(field, '!=', value));
              break;
            case 'gt':
              q = query(q, where(field, '>', value));
              break;
            case 'gte':
              q = query(q, where(field, '>=', value));
              break;
            case 'lt':
              q = query(q, where(field, '<', value));
              break;
            case 'lte':
              q = query(q, where(field, '<=', value));
              break;
            case 'contains':
              // For arrays
              q = query(q, where(field, 'array-contains', value));
              break;
            case 'in':
              q = query(q, where(field, 'in', value));
              break;
            case 'notIn':
              q = query(q, where(field, 'not-in', value));
              break;
            default:
              break;
          }
        });
      } else {
        // Direct equality
        q = query(q, where(field, '==', condition));
      }
    });
  }
  
  // Order by
  if (options.orderBy) {
    Object.entries(options.orderBy).forEach(([field, direction]) => {
      q = query(q, orderBy(field, direction.toLowerCase()));
    });
  }
  
  // Pagination
  if (options.take) {
    q = query(q, limit(options.take));
  }
  
  if (options.skip && options.lastDoc) {
    q = query(q, startAfter(options.lastDoc));
  }
  
  return q;
};

// Create entity adapter factory
export const createEntityAdapter = (collectionName, options = {}) => {
  const { idField = `${collectionName.slice(0, -1)}_id` } = options;

  const adapter = {
    // Create
    create: async (data) => {
      const docData = {
        ...prepareData(data),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };

      let docRef;
      if (data[idField]) {
        // Use composite ID for weapons, gear, and equipment (to allow same ID with different types)
        let documentId = data[idField];

        if (collectionName === 'weapons' && data.weapon_type) {
          documentId = `${data.weapon_id}_${data.weapon_type}`;
        } else if (collectionName === 'serialized_gear' && data.gear_type) {
          documentId = `${data.gear_id}_${data.gear_type}`;
        } else if (collectionName === 'equipment' && data.equipment_type) {
          documentId = `${data.id}_${data.equipment_type}`;
        }

        docRef = doc(db, collectionName, documentId);
        await setDoc(docRef, docData);
      } else {
        // Auto-generate ID
        docRef = await addDoc(collection(db, collectionName), docData);
        // Update with generated ID
        await updateDoc(docRef, { [idField]: docRef.id });
      }

      const newDoc = await getDoc(docRef);
      return convertDoc(newDoc);
    },
    
    // Find Many
    findMany: async (options = {}) => {
      try {
        const collectionRef = collection(db, collectionName);
        const q = buildQuery(collectionRef, options);
        const snapshot = await getDocs(q);
        
        const results = snapshot.docs.map(convertDoc);

        // Handle includes (denormalized data should already be present)
        if (options.include) {
          // In Firebase, we rely on denormalized data
        }

        return results;
      } catch (error) {
        throw error;
      }
    },
    
    // Find First
    findFirst: async (options = {}) => {
      const results = await adapter.findMany({ ...options, take: 1 });
      return results[0] || null;
    },
    
    // Find by ID
    findById: async (id) => {
      try {
        const docRef = doc(db, collectionName, id);
        const docSnap = await getDoc(docRef);
        return convertDoc(docSnap);
      } catch (error) {
        return null;
      }
    },
    
    // Update
    update: async (filter, data) => {
      try {
        // Handle both ID string and where clause
        let docRef;
        if (typeof filter === 'string') {
          docRef = doc(db, collectionName, filter);
        } else if (filter.where) {
          // Find document first by searching with where clause
          const docs = await adapter.findMany({ where: filter.where, take: 1 });
          if (!docs.length) {
            throw new Error('Document not found');
          }
          docRef = doc(db, collectionName, docs[0].id);
        } else {
          throw new Error('Invalid filter provided to update');
        }
        
        const updateData = {
          ...prepareData(data.data || data),
          updated_at: serverTimestamp()
        };
        
        await updateDoc(docRef, updateData);
        
        const updatedDoc = await getDoc(docRef);
        return convertDoc(updatedDoc);
      } catch (error) {
        throw error;
      }
    },
    
    // Delete
    delete: async (filter) => {
      try {
        // Handle both ID string and where clause
        let docId;
        if (typeof filter === 'string') {
          docId = filter;
        } else if (filter.where) {
          // Find document first by searching with where clause
          const docs = await adapter.findMany({ where: filter.where, take: 1 });
          if (!docs.length) {
            throw new Error('Document not found');
          }
          docId = docs[0].id;
        } else {
          throw new Error('Invalid filter provided to delete');
        }

        await deleteDoc(doc(db, collectionName, docId));
        return true;
      } catch (error) {
        throw error;
      }
    },
    
    // Delete Many
    deleteMany: async (filter) => {
      try {
        const docs = await adapter.findMany(filter);
        const batch = writeBatch(db);
        
        docs.forEach(doc => {
          batch.delete(doc(db, collectionName, doc.id));
        });
        
        await batch.commit();
        return { count: docs.length };
      } catch (error) {
        throw error;
      }
    },
    
    // Count
    count: async (filter) => {
      const docs = await adapter.findMany(filter);
      return docs.length;
    },
    
    // Update Many (for denormalization)
    updateMany: async (filter, data) => {
      try {
        const docs = await adapter.findMany(filter);
        const batch = writeBatch(db);
        
        const updateData = {
          ...prepareData(data.data || data),
          updated_at: serverTimestamp()
        };
        
        docs.forEach(item => {
          const docRef = doc(db, collectionName, item.id);
          batch.update(docRef, updateData);
        });
        
        await batch.commit();
        return { count: docs.length };
      } catch (error) {
        throw error;
      }
    }
  };

  return adapter;
};

// Re-export the adapter with proper binding
export const createBoundEntityAdapter = (collectionName, options) => {
  const adapter = createEntityAdapter(collectionName, options);
  
  // Bind 'this' context to all methods
  const boundAdapter = {};
  Object.keys(adapter).forEach(key => {
    if (typeof adapter[key] === 'function') {
      boundAdapter[key] = adapter[key].bind(adapter);
    } else {
      boundAdapter[key] = adapter[key];
    }
  });
  
  // Add Base44 compatibility methods
  // Filter method that wraps the where clause properly
  boundAdapter.filter = async (whereClause, orderByClause) => {
    const options = {};

    // Wrap the filter in a 'where' property for findMany
    if (whereClause) {
      options.where = whereClause;
    }

    // Handle orderBy parameter (e.g., "-created_date" or "created_date")
    if (orderByClause) {
      if (typeof orderByClause === 'string') {
        // Parse string like "-created_date" into { created_date: 'desc' }
        if (orderByClause.startsWith('-')) {
          const field = orderByClause.substring(1);
          options.orderBy = { [field]: 'desc' };
        } else {
          options.orderBy = { [orderByClause]: 'asc' };
        }
      } else if (typeof orderByClause === 'object') {
        // Already an object, use as-is
        options.orderBy = orderByClause;
      }
    }

    return adapter.findMany(options);
  };

  boundAdapter.list = boundAdapter.findMany; // Another alias
  boundAdapter.create = boundAdapter.create;
  boundAdapter.update = async (id, data) => {
    // Handle Base44 style update(id, data) calls
    if (typeof id === 'string') {
      // If we have an idField defined, search by that field instead of document ID
      if (options.idField) {
        return adapter.update({ where: { [options.idField]: id } }, data);
      }
      // Otherwise use id as document ID directly
      return adapter.update(id, data);
    }
    // Handle update with filter
    return adapter.update(id, data);
  };

  boundAdapter.delete = async (id) => {
    // Handle Base44 style delete(id) calls
    if (typeof id === 'string') {
      // If we have an idField defined, search by that field instead of document ID
      if (options.idField) {
        return adapter.delete({ where: { [options.idField]: id } });
      }
      // Otherwise use id as document ID directly
      return adapter.delete(id);
    }
    // Handle delete with filter
    return adapter.delete(id);
  };

  return boundAdapter;
};