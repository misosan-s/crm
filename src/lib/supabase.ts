import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 실제 Supabase 환경 변수가 존재하면 클라이언트를 생성하고, 없으면 null을 반환하여 Mock 모드로 동작하게 함
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Mock 모드 판별 플래그
export const isMockMode = !supabase;

// Mock 데이터 타입 정의
export interface Profile {
  id: string;
  email: string;
  name: string;
  current_status: string;
  is_admin?: boolean;
  updated_at: string;
}

export interface ActionLog {
  id: string;
  user_id: string;
  user_email?: string;
  action_type: 'click_guide' | 'click_error' | 'click_mission';
  created_at: string;
}

export interface EmailLog {
  id: string;
  user_id: string;
  user_email?: string;
  email_type: 'guide' | 'error' | 'mission_completed' | 'follow_up';
  status: 'sent' | 'scheduled' | 'failed';
  scheduled_at?: string;
  sent_at?: string;
  created_at: string;
}

// LocalStorage Helper for Mock Data
const MOCK_STORAGE_KEYS = {
  PROFILES: 'vibe_mailer_mock_profiles',
  ACTION_LOGS: 'vibe_mailer_mock_action_logs',
  EMAIL_LOGS: 'vibe_mailer_mock_email_logs',
  CURRENT_USER: 'vibe_mailer_mock_current_user',
};

// 초기 데이터
const INITIAL_PROFILES: Profile[] = [
  { id: 'user-1', email: 'kim@gmail.com', name: '김민준', current_status: 'none', updated_at: new Date().toISOString() },
  { id: 'user-2', email: 'lee@naver.com', name: '이서연', current_status: 'error_fighting', updated_at: new Date().toISOString() },
  { id: 'user-3', email: 'park@daum.net', name: '박지우', current_status: 'mission_completed', updated_at: new Date().toISOString() },
];

const INITIAL_EMAIL_LOGS: EmailLog[] = [
  { id: 'mail-1', user_id: 'user-2', user_email: 'lee@naver.com', email_type: 'error', status: 'sent', sent_at: new Date(Date.now() - 3600000).toISOString(), created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 'mail-2', user_id: 'user-3', user_email: 'park@daum.net', email_type: 'guide', status: 'sent', sent_at: new Date(Date.now() - 7200000).toISOString(), created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: 'mail-3', user_id: 'user-3', user_email: 'park@daum.net', email_type: 'mission_completed', status: 'sent', sent_at: new Date(Date.now() - 300000).toISOString(), created_at: new Date(Date.now() - 300000).toISOString() },
  { id: 'mail-4', user_id: 'user-3', user_email: 'park@daum.net', email_type: 'follow_up', status: 'scheduled', scheduled_at: new Date(Date.now() + 300000).toISOString(), created_at: new Date(Date.now() - 300000).toISOString() },
];

export const getMockData = () => {
  if (typeof window === 'undefined') return { profiles: INITIAL_PROFILES, actionLogs: [], emailLogs: INITIAL_EMAIL_LOGS, currentUser: null };

  const getOrSet = (key: string, initial: any) => {
    const val = localStorage.getItem(key);
    if (!val) {
      localStorage.setItem(key, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };

  const profiles = getOrSet(MOCK_STORAGE_KEYS.PROFILES, INITIAL_PROFILES);
  const actionLogs = getOrSet(MOCK_STORAGE_KEYS.ACTION_LOGS, []);
  const emailLogs = getOrSet(MOCK_STORAGE_KEYS.EMAIL_LOGS, INITIAL_EMAIL_LOGS);
  const currentUser = getOrSet(MOCK_STORAGE_KEYS.CURRENT_USER, INITIAL_PROFILES[0]); // 기본 수강생 1로 세팅

  return { profiles, actionLogs, emailLogs, currentUser };
};

export const saveMockData = (data: { profiles?: Profile[], actionLogs?: ActionLog[], emailLogs?: EmailLog[], currentUser?: Profile | null }) => {
  if (typeof window === 'undefined') return;
  if (data.profiles) localStorage.setItem(MOCK_STORAGE_KEYS.PROFILES, JSON.stringify(data.profiles));
  if (data.actionLogs) localStorage.setItem(MOCK_STORAGE_KEYS.ACTION_LOGS, JSON.stringify(data.actionLogs));
  if (data.emailLogs) localStorage.setItem(MOCK_STORAGE_KEYS.EMAIL_LOGS, JSON.stringify(data.emailLogs));
  if (data.currentUser !== undefined) localStorage.setItem(MOCK_STORAGE_KEYS.CURRENT_USER, JSON.stringify(data.currentUser));
};
