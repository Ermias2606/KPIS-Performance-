import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';

export async function fetchCollectionFromFirestore<T>(collectionName: string): Promise<T[]> {
  try {
    const colRef = collection(db, collectionName);
    const snap = await getDocs(colRef);
    const results: T[] = [];
    snap.forEach((d) => {
      results.push(d.data() as T);
    });
    return results;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, collectionName);
    return [];
  }
}

export async function saveDocumentToFirestore<T extends { id: string | number }>(
  collectionName: string,
  item: T
): Promise<void> {
  const docId = String(item.id);
  const docPath = `${collectionName}/${docId}`;
  try {
    const docRef = doc(db, collectionName, docId);
    await setDoc(docRef, item, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, docPath);
  }
}

export async function deleteDocumentFromFirestore(
  collectionName: string,
  id: string | number
): Promise<void> {
  const docId = String(id);
  const docPath = `${collectionName}/${docId}`;
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, docPath);
  }
}

export async function batchSeedCollection<T extends { id: string | number }>(
  collectionName: string,
  items: T[]
): Promise<void> {
  if (!items || items.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const item of items) {
      const docRef = doc(db, collectionName, String(item.id));
      batch.set(docRef, item, { merge: true });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, collectionName);
  }
}
