'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isMockMode, getMockData, saveMockData, Profile, ActionLog, EmailLog } from '@/lib/supabase';

export interface ToastState {
  message: string;
  type: 'loading' | 'success' | 'error' | 'none';
}

interface AppContextType {
  user: Profile | null;
  profiles: Profile[];
  actionLogs: ActionLog[];
  emailLogs: EmailLog[];
  toast: ToastState;
  mockMode: boolean;
  rateLimits: Record<string, number>; // action_type -> timestamp
  login: (email: string, name: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  loginError: string | null;
  logout: () => void;
  triggerAction: (actionType: 'click_guide' | 'click_error' | 'click_mission') => Promise<void>;
  clearToast: () => void;
  setMockUser: (userId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [toast, setToast] = useState<ToastState>({ message: '', type: 'none' });
  const [rateLimits, setRateLimits] = useState<Record<string, number>>({});
  const [loginError, setLoginError] = useState<string | null>(null);

  // 실모드 전용: profiles map으로 user_email hydrate
  const hydrateLogs = useCallback(
    (logs: any[], profilesList: Profile[]) => {
      const map = new Map(profilesList.map((p) => [p.id, p.email]));
      return logs.map((l) => ({ ...l, user_email: l.user_email ?? map.get(l.user_id) ?? '' }));
    },
    [],
  );

  // 실모드 전용: 본인/admin 권한에 따라 RLS가 자동 필터링 — 그냥 SELECT 하면 됨
  const fetchInitialData = useCallback(
    async (currentProfile: Profile) => {
      if (!supabase) return;
      const [profilesRes, actionsRes, emailsRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase
          .from('action_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('email_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200),
      ]);
      const profilesList: Profile[] = (profilesRes.data as Profile[]) ?? [currentProfile];
      setProfiles(profilesList);
      setActionLogs(hydrateLogs(actionsRes.data ?? [], profilesList) as ActionLog[]);
      setEmailLogs(hydrateLogs(emailsRes.data ?? [], profilesList) as EmailLog[]);
      // current_status 최신값 동기화
      const refreshed = profilesList.find((p) => p.id === currentProfile.id);
      if (refreshed) setUser(refreshed);

      // localStorage rate limits 복구 (mock과 동일)
      const savedLimits = localStorage.getItem('vibe_mailer_rate_limits');
      if (savedLimits) setRateLimits(JSON.parse(savedLimits));
    },
    [hydrateLogs],
  );

  // 초기 데이터 로드
  useEffect(() => {
    if (isMockMode) {
      const { profiles, actionLogs, emailLogs, currentUser } = getMockData();
      setProfiles(profiles);
      setActionLogs(actionLogs);
      setEmailLogs(emailLogs);
      setUser(currentUser);

      // 로컬 스토리지에 저장된 rate limits 복구
      const savedLimits = localStorage.getItem('vibe_mailer_rate_limits');
      if (savedLimits) {
        setRateLimits(JSON.parse(savedLimits));
      }
      return;
    }

    // 실모드: 세션 복원 + auth state 구독
    if (!supabase) return;

    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        const { data: prof } = await supabase!
          .from('profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .maybeSingle();
        if (prof) {
          setUser(prof as Profile);
          await fetchInitialData(prof as Profile);
        }
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setProfiles([]);
        setActionLogs([]);
        setEmailLogs([]);
        return;
      }
      const { data: prof } = await supabase!
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      if (prof) {
        setUser(prof as Profile);
        await fetchInitialData(prof as Profile);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchInitialData]);

  // 실모드: Supabase Realtime 구독 (본인 데이터 + admin이면 전체)
  useEffect(() => {
    if (isMockMode) return;
    if (!supabase || !user) return;

    const isAdmin = !!user.is_admin;
    const userFilter = `user_id=eq.${user.id}`;
    const profileFilter = `id=eq.${user.id}`;

    const hydrateOne = (row: any): any => ({
      ...row,
      user_email: row.user_email ?? (row.user_id === user.id ? user.email : ''),
    });

    const channel = supabase.channel(`vibe-mailer-${user.id}`);

    channel.on(
      'postgres_changes' as any,
      {
        event: 'INSERT',
        schema: 'public',
        table: 'email_logs',
        ...(isAdmin ? {} : { filter: userFilter }),
      },
      (payload: any) => {
        setEmailLogs((prev) => [hydrateOne(payload.new) as EmailLog, ...prev]);
      },
    );
    channel.on(
      'postgres_changes' as any,
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'email_logs',
        ...(isAdmin ? {} : { filter: userFilter }),
      },
      (payload: any) => {
        setEmailLogs((prev) =>
          prev.map((e) =>
            e.id === payload.new.id
              ? ({ ...hydrateOne(payload.new), user_email: e.user_email } as EmailLog)
              : e,
          ),
        );
      },
    );
    channel.on(
      'postgres_changes' as any,
      {
        event: 'INSERT',
        schema: 'public',
        table: 'action_logs',
        ...(isAdmin ? {} : { filter: userFilter }),
      },
      (payload: any) => {
        setActionLogs((prev) => [hydrateOne(payload.new) as ActionLog, ...prev]);
      },
    );
    channel.on(
      'postgres_changes' as any,
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        ...(isAdmin ? {} : { filter: profileFilter }),
      },
      (payload: any) => {
        setProfiles((prev) =>
          prev.map((p) => (p.id === payload.new.id ? (payload.new as Profile) : p)),
        );
        if (payload.new.id === user.id) setUser(payload.new as Profile);
      },
    );

    channel.subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, [user?.id, user?.is_admin, user?.email]);

  // 주기적으로 예약된 5분(Mock 모드에서는 테스트를 위해 10초) 메일 발송 처리 시뮬레이션
  useEffect(() => {
    if (!isMockMode) return;

    const interval = setInterval(() => {
      const { emailLogs: currentLogs, profiles: currentProfiles } = getMockData();
      let changed = false;
      const now = new Date();

      const updatedLogs = currentLogs.map((log: EmailLog) => {
        if (log.status === 'scheduled' && log.scheduled_at && new Date(log.scheduled_at) <= now) {
          changed = true;
          return {
            ...log,
            status: 'sent',
            sent_at: now.toISOString(),
          } as EmailLog;
        }
        return log;
      });

      if (changed) {
        setEmailLogs(updatedLogs);
        saveMockData({ emailLogs: updatedLogs });
        
        // 브로드캐스트 이벤트 시뮬레이션 (Toast 알림으로 예약 메일 도착 알림)
        const sentMail = updatedLogs.find(
          (log: EmailLog) => {
            const old = currentLogs.find((ol: EmailLog) => ol.id === log.id);
            return old && old.status === 'scheduled' && log.status === 'sent';
          }
        );
        
        if (sentMail && user && sentMail.user_id === user.id) {
          setToast({
            message: `후속 이메일(5분 지연 심화 강의 제안) 발송이 완료되었습니다!`,
            type: 'success',
          });
          setTimeout(() => setToast({ message: '', type: 'none' }), 5000);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [user]);

  // Toast 클리어
  const clearToast = useCallback(() => {
    setToast({ message: '', type: 'none' });
  }, []);

  // 로그인 기능
  const login = async (
    email: string,
    name: string,
    password?: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const fail = (error: string) => {
      setLoginError(error);
      return { success: false, error };
    };

    if (isMockMode) {
      const { profiles: currentProfiles } = getMockData();
      let matched = currentProfiles.find((p: Profile) => p.email === email);

      if (!matched) {
        matched = {
          id: `user-${Date.now()}`,
          email,
          name,
          current_status: 'none',
          updated_at: new Date().toISOString(),
        };
        const newProfiles = [...currentProfiles, matched];
        setProfiles(newProfiles);
        saveMockData({ profiles: newProfiles });
      } else if (name && matched.name !== name) {
        matched.name = name;
        const newProfiles = currentProfiles.map((p: Profile) =>
          p.id === matched?.id ? matched! : p,
        );
        setProfiles(newProfiles);
        saveMockData({ profiles: newProfiles });
      }

      setUser(matched);
      saveMockData({ currentUser: matched });
      return { success: true };
    }

    // 실모드: signInWithPassword 시도 → 자격 오류면 signUp 폴백
    if (!supabase) return fail('Supabase 클라이언트가 초기화되지 않았습니다.');
    if (!password) return fail('비밀번호를 입력해 주세요.');
    setLoginError(null);

    let authUserId: string | undefined;
    const signIn = await supabase.auth.signInWithPassword({ email, password });
    if (signIn.error) {
      const msg = signIn.error.message || '';
      const looksMissing =
        /Invalid login credentials/i.test(msg) || /not found/i.test(msg);
      if (!looksMissing) return fail(msg);

      // 신규 가입 시도. 이미 가입된 이메일의 비번 오류는 여기서 잡힘 (Supabase가 보안상 같은 메시지를 줘서 구분 불가)
      const signUp = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: name || email.split('@')[0] } },
      });
      if (signUp.error) {
        const sMsg = signUp.error.message || '';
        if (/already.*registered|already.*exists|User already/i.test(sMsg)) {
          return fail('비밀번호가 올바르지 않습니다. 다시 확인해 주세요.');
        }
        return fail(sMsg);
      }
      if (!signUp.data.session) {
        return fail('확인 이메일을 보냈습니다. 메일함의 링크를 눌러 인증 후 다시 로그인해 주세요.');
      }
      authUserId = signUp.data.user?.id;
    } else {
      authUserId = signIn.data.user?.id;
    }

    if (!authUserId) return fail('로그인 후 사용자 ID를 확인할 수 없습니다.');

    const { data: prof, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUserId)
      .maybeSingle();
    if (profErr || !prof) return fail(profErr?.message || '프로필 조회에 실패했습니다.');

    setUser(prof as Profile);
    await fetchInitialData(prof as Profile);
    return { success: true };
  };

  // 로그아웃
  const logout = async () => {
    if (isMockMode) {
      setUser(null);
      saveMockData({ currentUser: null });
      return;
    }
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setProfiles([]);
    setActionLogs([]);
    setEmailLogs([]);
  };

  // 어드민용: 대시보드에서 테스트할 유저 강제 변경 기능
  const setMockUser = (userId: string) => {
    if (isMockMode) {
      const { profiles: currentProfiles } = getMockData();
      const targetUser = currentProfiles.find((p: Profile) => p.id === userId) || null;
      setUser(targetUser);
      saveMockData({ currentUser: targetUser });
    }
  };

  // 수강생용 상태 버튼 클릭 시 트리거
  const triggerAction = async (actionType: 'click_guide' | 'click_error' | 'click_mission') => {
    if (!user) {
      setToast({ message: '로그인이 필요합니다.', type: 'error' });
      return;
    }

    // 1. Rate Limit 체크 (3분 = 180,000ms)
    const lastClicked = rateLimits[actionType] || 0;
    const now = Date.now();
    const cooldown = 3 * 60 * 1000; // 3분

    if (now - lastClicked < cooldown) {
      const remainingSeconds = Math.ceil((cooldown - (now - lastClicked)) / 1000);
      const minutes = Math.floor(remainingSeconds / 60);
      const seconds = remainingSeconds % 60;
      setToast({ 
        message: `과도한 요청 방지를 위해 제한되었습니다. ${minutes}분 ${seconds}초 후에 다시 시도해 주세요.`, 
        type: 'error' 
      });
      return;
    }

    // 2. 로딩 Toast 띄우기
    setToast({ message: '이메일을 발송하고 있습니다...', type: 'loading' });

    // 3. API 호출 시뮬레이션 (Mock 또는 실제 API)
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500)); // 1.5초 딜레이

      if (isMockMode) {
        const { profiles: currentProfiles, actionLogs: currentActions, emailLogs: currentEmails } = getMockData();

        // 3-1. 유저 상태 업데이트
        let newStatus = 'none';
        let emailType: 'guide' | 'error' | 'mission_completed' | 'follow_up' = 'guide';
        
        if (actionType === 'click_guide') {
          newStatus = 'guide_requested';
          emailType = 'guide';
        } else if (actionType === 'click_error') {
          newStatus = 'error_fighting';
          emailType = 'error';
        } else if (actionType === 'click_mission') {
          newStatus = 'mission_completed';
          emailType = 'mission_completed';
        }

        const updatedUser = {
          ...user,
          current_status: newStatus,
          updated_at: new Date().toISOString(),
        };

        const updatedProfiles = currentProfiles.map((p: Profile) => p.id === user.id ? updatedUser : p);

        // 3-2. 행동 로그 추가
        const newAction: ActionLog = {
          id: `act-${Date.now()}`,
          user_id: user.id,
          user_email: user.email,
          action_type: actionType,
          created_at: new Date().toISOString(),
        };
        const updatedActions = [newAction, ...currentActions];

        // 3-3. 이메일 로그 추가 (즉시 발송)
        const newEmail: EmailLog = {
          id: `mail-${Date.now()}`,
          user_id: user.id,
          user_email: user.email,
          email_type: emailType,
          status: 'sent',
          sent_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };

        let updatedEmails = [newEmail, ...currentEmails];

        // 3-4. 후속 자동화 (미션 완료 클릭 시 5분 지연 발송 - Mock 모드 시연을 위해 15초 뒤 자동 예약)
        if (actionType === 'click_mission') {
          const delayTime = new Date(Date.now() + 15000); // 디버깅 편의를 위해 15초 뒤로 세팅 (원래 5분)
          const followUpEmail: EmailLog = {
            id: `mail-follow-${Date.now()}`,
            user_id: user.id,
            user_email: user.email,
            email_type: 'follow_up',
            status: 'scheduled',
            scheduled_at: delayTime.toISOString(),
            created_at: new Date().toISOString(),
          };
          updatedEmails = [followUpEmail, ...updatedEmails];
        }

        // 3-5. 상태 및 로컬 스토리지 저장
        setUser(updatedUser);
        setProfiles(updatedProfiles);
        setActionLogs(updatedActions);
        setEmailLogs(updatedEmails);
        
        saveMockData({
          profiles: updatedProfiles,
          actionLogs: updatedActions,
          emailLogs: updatedEmails,
          currentUser: updatedUser
        });

        // 3-6. Rate Limit 업데이트
        const updatedLimits = { ...rateLimits, [actionType]: Date.now() };
        setRateLimits(updatedLimits);
        localStorage.setItem('vibe_mailer_rate_limits', JSON.stringify(updatedLimits));

        // 성공 Toast
        setToast({ 
          message: actionType === 'click_mission' 
            ? '이메일 발송이 완료되었습니다. 15초 후에 후속 메일이 발송됩니다!' 
            : '이메일 발송이 완료되었습니다. 메일함을 확인해 주세요!', 
          type: 'success' 
        });
        
        // 3초 뒤 성공 Toast 숨기기
        setTimeout(() => {
          setToast((prev) => prev.message.includes('완료되었습니다') ? { message: '', type: 'none' } : prev);
        }, 3000);
      } else {
        // 실모드: trigger-action Edge Function 호출
        if (!supabase) {
          setToast({ message: 'Supabase 클라이언트가 초기화되지 않았습니다.', type: 'error' });
          return;
        }
        const { data, error } = await supabase.functions.invoke<{
          success: boolean;
          message?: string;
          error?: string;
          retry_after_seconds?: number;
          data?: { email_status: 'sent' | 'scheduled'; follow_up_status?: 'scheduled' | 'failed' };
        }>('trigger-action', { body: { action_type: actionType } });

        // supabase-js 는 4xx/5xx 에서도 data 를 반환할 수 있고, FunctionsHttpError 는 error 에 들어옴
        const status = (error as any)?.context?.status ?? (data?.success === false ? 429 : 200);

        if (status === 429 || (data && !data.success && /Rate limit/i.test(data.error ?? ''))) {
          // 백엔드가 더 정확 — retry_after_seconds 로 rate limit 동기화
          const retry = data?.retry_after_seconds ?? 180;
          const clickedAt = Date.now() - (180 - retry) * 1000;
          const updatedLimits = { ...rateLimits, [actionType]: clickedAt };
          setRateLimits(updatedLimits);
          localStorage.setItem('vibe_mailer_rate_limits', JSON.stringify(updatedLimits));
          const minutes = Math.floor(retry / 60);
          const seconds = retry % 60;
          setToast({
            message: `과도한 요청 방지를 위해 제한되었습니다. ${minutes}분 ${seconds}초 후에 다시 시도해 주세요.`,
            type: 'error',
          });
          return;
        }

        if (error || !data || data.success === false) {
          setToast({
            message: data?.error || error?.message || '이메일 발송 도중 오류가 발생했습니다.',
            type: 'error',
          });
          return;
        }

        // 성공 — rate limit 갱신 (mock 분기와 동일하게 클라 측 타이머도 세팅)
        const updatedLimits = { ...rateLimits, [actionType]: Date.now() };
        setRateLimits(updatedLimits);
        localStorage.setItem('vibe_mailer_rate_limits', JSON.stringify(updatedLimits));

        setToast({
          message:
            actionType === 'click_mission'
              ? '이메일 발송이 완료되었습니다. 5분 뒤 후속 메일이 자동 발송됩니다!'
              : '이메일 발송이 완료되었습니다. 메일함을 확인해 주세요!',
          type: 'success',
        });
        setTimeout(() => {
          setToast((prev) =>
            prev.message.includes('완료되었습니다') ? { message: '', type: 'none' } : prev,
          );
        }, 3000);
        // profiles / action_logs / email_logs 는 Realtime 구독이 자동 갱신
      }
    } catch (err: any) {
      setToast({
        message: err?.message ?? '이메일 발송 도중 오류가 발생했습니다.',
        type: 'error',
      });
    }
  };

  return (
    <AppContext.Provider
      value={{
        user,
        profiles,
        actionLogs,
        emailLogs,
        toast,
        mockMode: isMockMode,
        rateLimits,
        login,
        loginError,
        logout,
        triggerAction,
        clearToast,
        setMockUser,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
