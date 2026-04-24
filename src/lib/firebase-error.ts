export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: FirestoreErrorInfo['operationType'], path: string | null, auth: any): never {
  const isAuthReady = !!auth && !!auth.currentUser;
  
  const authInfo = isAuthReady ? {
    userId: auth.currentUser.uid,
    email: auth.currentUser.email || '',
    emailVerified: auth.currentUser.emailVerified,
    isAnonymous: auth.currentUser.isAnonymous,
    providerData: auth.currentUser.providerData
  } : null;

  const errorString = error instanceof Error ? error.message : String(error);
  
  // If we get an insufficient permissions error, throw the specialized JSON error structure.
  if (errorString.toLowerCase().includes('missing or insufficient permissions')) {
    const errorInfo = {
      error: errorString,
      operationType,
      path,
      authInfo
    };
    throw new Error(JSON.stringify(errorInfo));
  }
  
  throw error instanceof Error ? error : new Error(String(error));
}
