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
  login: (email: string, name: string) => Promise<boolean>;
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
    } else {
      // 실제 Supabase 연동 시 Auth 및 DB 세팅 (백엔드 클로드코드가 연결할 영역)
      // 초기 프론트 구현에서는 기본 Mock 모드와 유사하게 동작하도록 폴백
    }
  }, []);

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
  const login = async (email: string, name: string): Promise<boolean> => {
    if (isMockMode) {
      const { profiles: currentProfiles } = getMockData();
      let matched = currentProfiles.find((p: Profile) => p.email === email);
      
      if (!matched) {
        // 새 유저 생성
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
        // 이름 업데이트
        matched.name = name;
        const newProfiles = currentProfiles.map((p: Profile) => p.id === matched?.id ? matched! : p);
        setProfiles(newProfiles);
        saveMockData({ profiles: newProfiles });
      }

      setUser(matched);
      saveMockData({ currentUser: matched });
      return true;
    } else {
      // 실제 Supabase Auth 로그인 구현부
      return false;
    }
  };

  // 로그아웃
  const logout = () => {
    if (isMockMode) {
      setUser(null);
      saveMockData({ currentUser: null });
    }
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
        // 실제 백엔드 Edge Function API 호출
        // (백엔드 클로드코드가 trigger-action Endpoint 설계 완료 후 이 부분 완성 예정)
      }
    } catch (err) {
      setToast({ message: '이메일 발송 도중 오류가 발생했습니다.', type: 'error' });
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
