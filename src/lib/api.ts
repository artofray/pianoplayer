import { collection, doc, setDoc, getDocs, query, where, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';
import { handleFirestoreError } from './firebase-error';

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

export interface Scene {
  id: string;
  ownerId: string;
  name: string;
  prompt: string;
  imageUrl: string;
  effectMode: 'reveal' | 'particles' | 'ripples';
  threshold: number;
  objects: any[];
  createdAt: any;
  updatedAt: any;
}

export interface LibraryObject {
  id: string;
  name: string;
  modelUrl: string;
  thumbnailUrl: string;
  category: string;
  creatorId: string;
  createdAt: any;
}

export async function saveScene(sceneData: Omit<Scene, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>) {
  if (!auth.currentUser) return;
  
  const id = generateId();
  const sceneRef = doc(db, 'scenes', id);
  
  const payload = {
    ...sceneData,
    ownerId: auth.currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(sceneRef, payload);
    return id;
  } catch (error) {
    handleFirestoreError(error, 'create', `/scenes/${id}`, auth);
  }
}

export async function updateScene(id: string, sceneData: Partial<Scene>) {
  if (!auth.currentUser) return;
  const sceneRef = doc(db, 'scenes', id);
  
  const payload = {
    ...sceneData,
    updatedAt: serverTimestamp()
  };

  try {
    // Only update fields allowed by rules
    await updateDoc(sceneRef, payload);
  } catch (error) {
    handleFirestoreError(error, 'update', `/scenes/${id}`, auth);
  }
}

export async function getUserScenes(): Promise<Scene[]> {
  if (!auth.currentUser) return [];
  
  try {
    const q = query(collection(db, 'scenes'), where('ownerId', '==', auth.currentUser.uid));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Scene));
  } catch (error) {
    handleFirestoreError(error, 'list', '/scenes', auth);
  }
}

export async function getLibraryObjects(): Promise<LibraryObject[]> {
  if (!auth.currentUser) return [];
  
  try {
    const q = collection(db, 'library_objects');
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LibraryObject));
  } catch (error) {
    handleFirestoreError(error, 'list', '/library_objects', auth);
  }
}

export async function addLibraryObject(objectData: Omit<LibraryObject, 'id' | 'creatorId' | 'createdAt'>) {
  if (!auth.currentUser) return;
  
  const id = generateId();
  const objRef = doc(db, 'library_objects', id);
  
  const payload = {
    ...objectData,
    creatorId: auth.currentUser.uid,
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(objRef, payload);
    return id;
  } catch (error) {
    handleFirestoreError(error, 'create', `/library_objects/${id}`, auth);
  }
}
