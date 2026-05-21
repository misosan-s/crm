'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { 
  LogOut, 
  BookOpen, 
  HelpCircle, 
  CheckCircle, 
  Mail, 
  Clock, 
  Activity, 
  LayoutDashboard, 
  ArrowLeft,
  ChevronRight
} from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  const { user, emailLogs, rateLimits, triggerAction, logout, mockMode } = useApp();
  const [timeLeft, setTimeLeft] = useState<Record<string, number>>({});

  // 로그인 상태 검증
  useEffect(() => {
    if (!user) {
      router.push('/');
    }
  }, [user, router]);

  // Rate Limit 잔여 시간 카운트다운 타이머
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const cooldown = 3 * 60 * 1000; // 3분
      const newTimeLeft: Record<string, number> = {};

      Object.entries(rateLimits).forEach(([action, timestamp]) => {
        const diff = now - timestamp;
        if (diff < cooldown) {
          newTimeLeft[action] = Math.ceil((cooldown - diff) / 1000);
        }
      });

      setTimeLeft(newTimeLeft);
    }, 1000);

    return () => clearInterval(interval);
  }, [rateLimits]);

  if (!user) return null;

  // 현재 유저의 이메일 로그 필터링
  const myEmailLogs = emailLogs.filter((log) => log.user_id === user.id);

  // 상태 한글 변환
  const statusLabels = {
    none: '학습 대기 중',
    guide_requested: '실습 가이드 수신 완료',
    error_fighting: '에러 디버깅 중',
    mission_completed: '미션 완료 및 검증 중',
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'guide_requested':
        return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      case 'error_fighting':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'mission_completed':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border border-gray-500/20';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0f1115]">
      {/* 상단 네비게이션 바 */}
      <header className="border-b border-gray-800/60 bg-gray-950/40 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-600/10 border border-purple-500/20 text-purple-500">
              <Activity className="w-5 h-5" />
            </div>
            <span className="font-bold tracking-tight text-gray-100 text-lg">Vibe Mailer</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-medium text-gray-200">{user.name} 수강생</span>
              <span className="text-xs text-gray-500">{user.email}</span>
            </div>
            
            {/* 어드민 대시보드 바로가기 */}
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 hover:border-gray-700 text-xs font-medium text-gray-300 transition-all cursor-pointer"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>관리자 화면</span>
            </button>

            <button
              onClick={logout}
              className="p-2 rounded-lg hover:bg-gray-900 text-gray-400 hover:text-red-400 transition-colors cursor-pointer border border-transparent hover:border-gray-800"
              title="로그아웃"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 영역 */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        {/* Mock 모드 안내 배너 */}
        {mockMode && (
          <div className="mb-6 p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/15 text-xs text-purple-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
              <span>현재 <strong>Mock 모드(로컬 데모)</strong>로 구동 중입니다. DB 없이도 완벽한 메일 시나리오 시뮬레이션이 가능합니다.</span>
            </div>
          </div>
        )}

        {/* 수강생 현재 요약 정보 */}
        <div className="metallic-card p-6 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">학습 코스</span>
            <h1 className="text-xl font-bold text-gray-100 mt-1">실전 풀스택 Next.js + Supabase 어플리케이션 구축</h1>
            <p className="text-sm text-gray-400 mt-1">1단계: 프론트엔드 환경 설정 및 UI 컴포넌트 마크업</p>
          </div>
          <div className="flex flex-col items-start md:items-end justify-center">
            <span className="text-xs text-gray-500">현재 수강생 학습 상태</span>
            <span className={`mt-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(user.current_status)}`}>
              {statusLabels[user.current_status as keyof typeof statusLabels] || user.current_status}
            </span>
          </div>
        </div>

        {/* 액션 버튼 그룹 */}
        <section className="mb-10">
          <h2 className="text-base font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-purple-500" />
            학습 진행 상황에 맞게 버튼을 눌러보세요
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. 실습 가이드 받기 */}
            <div className="metallic-card metallic-card-glow p-5 flex flex-col justify-between min-h-[180px]">
              <div>
                <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 w-fit mb-4">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-gray-100">가이드가 필요하신가요?</h3>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  이 단계에 필요한 실습 가이드북과 핵심 코드 요약본 메일을 즉시 전송합니다.
                </p>
              </div>
              <button
                onClick={() => triggerAction('click_guide')}
                disabled={!!timeLeft['click_guide']}
                className="mt-5 w-full py-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-purple-600/10 cursor-pointer"
              >
                {timeLeft['click_guide'] 
                  ? `재요청 대기 (${timeLeft['click_guide']}초)` 
                  : '실습 가이드 받기'}
              </button>
            </div>

            {/* 2. 에러와 싸우는 중 */}
            <div className="metallic-card metallic-card-glow p-5 flex flex-col justify-between min-h-[180px]">
              <div>
                <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 w-fit mb-4">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-gray-100">에러에 막히셨나요?</h3>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  자주 발생하는 주요 에러 체크리스트 및 극복 팁 메일을 즉시 전송합니다.
                </p>
              </div>
              <button
                onClick={() => triggerAction('click_error')}
                disabled={!!timeLeft['click_error']}
                className="mt-5 w-full py-2 bg-amber-600/90 hover:bg-amber-600 active:bg-amber-700 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-amber-600/10 cursor-pointer"
              >
                {timeLeft['click_error'] 
                  ? `재요청 대기 (${timeLeft['click_error']}초)` 
                  : '에러와 싸우는 중'}
              </button>
            </div>

            {/* 3. 미션 완료 */}
            <div className="metallic-card metallic-card-glow p-5 flex flex-col justify-between min-h-[180px]">
              <div>
                <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 w-fit mb-4">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-gray-100">미션을 완료했나요?</h3>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  미션 통과 축하 메일 및 5분 뒤 심화 단계 안내 메일을 추가 예약합니다.
                </p>
              </div>
              <button
                onClick={() => triggerAction('click_mission')}
                disabled={!!timeLeft['click_mission']}
                className="mt-5 w-full py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-emerald-600/10 cursor-pointer"
              >
                {timeLeft['click_mission'] 
                  ? `재요청 대기 (${timeLeft['click_mission']}초)` 
                  : '미션 완료'}
              </button>
            </div>
          </div>
        </section>

        {/* 이메일 발송 상태 피드 */}
        <section>
          <h2 className="text-base font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Mail className="w-4 h-4 text-purple-500" />
            내 이메일 수신 타임라인
          </h2>

          <div className="metallic-card overflow-hidden">
            {myEmailLogs.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                아직 발송된 이메일이 없습니다. 위 액션 버튼을 눌러 메일을 요청해 보세요.
              </div>
            ) : (
              <div className="divide-y divide-gray-800/40">
                {myEmailLogs.map((log) => {
                  const isScheduled = log.status === 'scheduled';
                  const dateStr = isScheduled 
                    ? log.scheduled_at 
                    : log.sent_at || log.created_at;
                  const dateFormatted = dateStr 
                    ? new Date(dateStr).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
                    : '-';

                  const mailTypeLabels = {
                    guide: '실습 가이드 핵심 요약',
                    error: '에러 디버깅 팁 & 위로 레터',
                    mission_completed: '미션 완료 축하 메시지',
                    follow_up: '심화 로드맵 제안 (자동 스케줄)',
                  };

                  return (
                    <div key={log.id} className="p-4 flex items-center justify-between hover:bg-gray-900/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isScheduled ? 'bg-gray-800 text-gray-400' : 'bg-purple-500/10 text-purple-400'}`}>
                          {isScheduled ? <Clock className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-200">
                            {mailTypeLabels[log.email_type as keyof typeof mailTypeLabels] || log.email_type}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">수신처: {log.user_email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider ${
                          log.status === 'sent' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' 
                            : log.status === 'scheduled' 
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/15 animate-pulse'
                            : 'bg-red-500/10 text-red-400 border border-red-500/15'
                        }`}>
                          {log.status === 'sent' && '발송 완료'}
                          {log.status === 'scheduled' && '예약됨 (15초 지연)'}
                          {log.status === 'failed' && '발송 실패'}
                        </span>
                        <p className="text-[10px] text-gray-500 mt-1">
                          {isScheduled ? `${dateFormatted} 예정` : `${dateFormatted} 발송`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
