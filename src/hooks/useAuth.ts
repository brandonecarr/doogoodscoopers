"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/supabase/types";
import {
  hasPermission,
  hasAnyPermission,
  type Permission,
} from "@/lib/rbac";

export interface AuthState {
  user: User | null;
  profile: {
    orgId: string;
    role: UserRole;
    firstName: string | null;
    lastName: string | null;
    isActive: boolean;
  } | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    const supabase = createClient();

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user);
      } else {
        setState({
          user: null,
          profile: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadProfile(session.user);
      } else {
        setState({
          user: null,
          profile: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(user: User) {
    const supabase = createClient();

    const { data: profile } = await supabase
      .from("users")
      .select("org_id, role, first_name, last_name, is_active")
      .eq("id", user.id)
      .single<{
        org_id: string;
        role: string;
        first_name: string | null;
        last_name: string | null;
        is_active: boolean;
      }>();

    if (profile && profile.is_active) {
      setState({
        user,
        profile: {
          orgId: profile.org_id,
          role: profile.role as UserRole,
          firstName: profile.first_name,
          lastName: profile.last_name,
          isActive: profile.is_active,
        },
        isLoading: false,
        isAuthenticated: true,
      });
    } else {
      // User exists in auth but not in users table or inactive
      setState({
        user,
        profile: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setState({
      user: null,
      profile: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }, []);

  const can = useCallback(
    (permission: Permission): boolean => {
      if (!state.profile) return false;
      return hasPermission(state.profile.role, permission);
    },
    [state.profile]
  );

  const canAny = useCallback(
    (permissions: Permission[]): boolean => {
      if (!state.profile) return false;
      return hasAnyPermission(state.profile.role, permissions);
    },
    [state.profile]
  );

  return {
    ...state,
    signOut,
    can,
    canAny,
    role: state.profile?.role ?? null,
    orgId: state.profile?.orgId ?? null,
  };
}
