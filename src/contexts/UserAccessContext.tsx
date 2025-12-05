import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';

export interface UserPermissions {
  can_view_accounts: boolean;
  can_view_journal: boolean;
  can_view_auxiliary: boolean;
  can_view_ledger: boolean;
  can_view_reports: boolean;
}

export interface SharedAccessInfo {
  owner_id: string;
  owner_email?: string;
  permissions: UserPermissions;
}

interface UserAccessContextType {
  isOwner: boolean;
  isViewer: boolean;
  isReadOnly: boolean;
  loading: boolean;
  sharedAccessList: SharedAccessInfo[];
  currentAccess: SharedAccessInfo | null;
  permissions: UserPermissions;
  selectAccess: (ownerId: string) => void;
  targetUserId: string | null; // The owner's user_id to load data from
}

const defaultPermissions: UserPermissions = {
  can_view_accounts: true,
  can_view_journal: true,
  can_view_auxiliary: true,
  can_view_ledger: true,
  can_view_reports: true,
};

const UserAccessContext = createContext<UserAccessContextType | undefined>(undefined);

export function useUserAccess() {
  const context = useContext(UserAccessContext);
  if (!context) {
    throw new Error('useUserAccess must be used within a UserAccessProvider');
  }
  return context;
}

interface UserAccessProviderProps {
  children: React.ReactNode;
}

export function UserAccessProvider({ children }: UserAccessProviderProps) {
  const { user } = useAuth();
  const [isOwner, setIsOwner] = useState(false);
  const [isViewer, setIsViewer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sharedAccessList, setSharedAccessList] = useState<SharedAccessInfo[]>([]);
  const [currentAccess, setCurrentAccess] = useState<SharedAccessInfo | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    checkUserAccess();
  }, [user]);

  const checkUserAccess = async () => {
    if (!user) return;
    
    try {
      // Check user role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleError) throw roleError;

      const userRole = roleData?.role;
      const userIsOwner = userRole === 'owner';
      const userIsViewer = userRole === 'viewer';

      setIsOwner(userIsOwner);
      setIsViewer(userIsViewer);

      // If viewer, load shared access list
      if (userIsViewer) {
        const { data: accessData, error: accessError } = await supabase
          .from('shared_access')
          .select('*')
          .eq('viewer_id', user.id);

        if (accessError) throw accessError;

        const accessList: SharedAccessInfo[] = (accessData || []).map(access => ({
          owner_id: access.owner_id,
          permissions: {
            can_view_accounts: access.can_view_accounts,
            can_view_journal: access.can_view_journal,
            can_view_auxiliary: access.can_view_auxiliary,
            can_view_ledger: access.can_view_ledger,
            can_view_reports: access.can_view_reports,
          }
        }));

        setSharedAccessList(accessList);

        // Auto-select first access if available
        if (accessList.length > 0) {
          setCurrentAccess(accessList[0]);
        }
      }
    } catch (error) {
      console.error('Error checking user access:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectAccess = (ownerId: string) => {
    const access = sharedAccessList.find(a => a.owner_id === ownerId);
    if (access) {
      setCurrentAccess(access);
    }
  };

  // Determine permissions and target user
  const permissions = currentAccess?.permissions || defaultPermissions;
  const isReadOnly = isViewer;
  const targetUserId = isViewer && currentAccess ? currentAccess.owner_id : user?.id || null;

  return (
    <UserAccessContext.Provider value={{
      isOwner,
      isViewer,
      isReadOnly,
      loading,
      sharedAccessList,
      currentAccess,
      permissions,
      selectAccess,
      targetUserId,
    }}>
      {children}
    </UserAccessContext.Provider>
  );
}
