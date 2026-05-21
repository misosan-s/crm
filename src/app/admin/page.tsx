'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { 
  Users, 
  AlertCircle, 
  CheckSquare, 
  Send, 
  Search, 
  Clock, 
  ArrowLeft,
  ChevronRight,
  Activity,
  LayoutDashboard,
  Sliders,
  Mail,
  User,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import { Profile, EmailLog } from '@/lib/supabase';

export default function AdminDashboard() {
  const router = useRouter();
  const { profiles, actionLogs, emailLogs, mockMode, setMockUser, user } = useApp();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'students' | 'templates'>('dashboard');

  // 첫 번째 수강생 기본 선택
  useEffect(() => {
    if (profiles.length > 0 && !selectedStudentId) {
      setSelectedStudentId(profiles[0].id);
    }
  }, [profiles, selectedStudentId]);

  // 선택된 수강생 정보 찾기
  const selectedStudent = profiles.find((p) => p.id === selectedStudentId) || null;

  // 수강생의 메일 로그
  const studentEmails = emailLogs.filter((log) => log.user_id === selectedStudentId);

  // 수강생의 액션 로그
  const studentActions = actionLogs.filter((log) => log.user_id === selectedStudentId);

  // KPI 계산
  const totalStudents = profiles.length;
  
  // 오늘 발생한 에러 요청 수 (Mock 로그나 액션 로그 기준)
  const todayErrorRequests = actionLogs.filter(
    (act) => act.action_type === 'click_error' && 
    new Date(act.created_at).toDateString() === new Date().toDateString()
  ).length;

  // 미션 완료율
  const completedCount = profiles.filter((p) => p.current_status === 'mission_completed').length;
  const missionCompletionRate = totalStudents > 0 
    ? Math.round((completedCount / totalStudents) * 100) 
    : 0;

  // 이메일 총 발송 건수
  const totalSentEmails = emailLogs.filter((log) => log.status === 'sent').length;

  // 검색 필터링 수강생 목록
  const filteredProfiles = profiles.filter((p) => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 상태 뱃지 테마 클래스
  const getStatusBadge = (status: string) => {
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

  const getStatusLabel = (status: string) => {
    const labels = {
      none: '대기 중',
      guide_requested: '가이드 요청',
      error_fighting: '에러 중',
      mission_completed: '미션 완료',
    };
    return labels[status as keyof typeof labels] || status;
  };

  return (
    <div className="flex h-screen bg-[#0f1115] overflow-hidden text-gray-200">
      
      {/* 1. 좌측 사이드바 */}
      <aside className="w-64 border-r border-gray-800/60 bg-gray-950/40 flex flex-col justify-between hidden md:flex">
        <div>
          {/* 로고 영역 */}
          <div className="h-16 border-b border-gray-800/60 flex items-center gap-2.5 px-6">
            <div className="p-1.5 rounded-lg bg-purple-600/10 border border-purple-500/20 text-purple-500">
              <Activity className="w-4 h-4" />
            </div>
            <span className="font-bold tracking-tight text-gray-100">Vibe Mailer Admin</span>
          </div>

          {/* 메뉴 아이템 */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-purple-600/10 text-purple-400 border-l-2 border-purple-500'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900/40'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              대시보드 홈
            </button>

            <button
              onClick={() => setActiveTab('students')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeTab === 'students'
                  ? 'bg-purple-600/10 text-purple-400 border-l-2 border-purple-500'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900/40'
              }`}
            >
              <Users className="w-4 h-4" />
              수강생 관리
            </button>

            <button
              onClick={() => setActiveTab('templates')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeTab === 'templates'
                  ? 'bg-purple-600/10 text-purple-400 border-l-2 border-purple-500'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900/40'
              }`}
            >
              <Mail className="w-4 h-4" />
              이메일 템플릿 관리
            </button>
          </nav>
        </div>

        {/* 사이드바 하단 (수강생 화면으로 탈출) */}
        <div className="p-4 border-t border-gray-800/60">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-gray-900 hover:bg-gray-850 border border-gray-800 hover:border-gray-700 text-xs font-medium text-gray-300 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            수강생 화면 바로가기
          </button>
        </div>
      </aside>

      {/* 메인 콘텐츠 컨테이너 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 상단 네비게이션 헤더 */}
        <header className="h-16 border-b border-gray-800/60 bg-gray-950/20 backdrop-blur-md px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-bold text-gray-100">
              {activeTab === 'dashboard' && '관리자 리포트 대시보드'}
              {activeTab === 'students' && '수강생 모니터링'}
              {activeTab === 'templates' && 'Resend 메일 템플릿 프리뷰'}
            </h1>
            
            {mockMode && (
              <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] bg-purple-500/10 border border-purple-500/20 text-purple-400 font-semibold uppercase tracking-wider animate-pulse">
                Mock Simulating Active
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-xs font-medium text-gray-300 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>수강생용</span>
            </button>
            <div className="text-right text-xs">
              <span className="text-gray-500">어드민 계정: </span>
              <span className="font-semibold text-gray-300">instructor@vibemailer.com</span>
            </div>
          </div>
        </header>

        {/* 탭 내용 분기 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'dashboard' && (
            <>
              {/* 2. 상단 요약 위젯 (KPI) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="metallic-card p-5 border border-gray-800/50">
                  <div className="flex items-center justify-between text-gray-400">
                    <span className="text-xs font-semibold uppercase tracking-wider">전체 수강생</span>
                    <Users className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold tracking-tight text-gray-100">{totalStudents}</span>
                    <span className="text-xs text-gray-500">명 등록됨</span>
                  </div>
                </div>

                <div className="metallic-card p-5 border border-gray-800/50">
                  <div className="flex items-center justify-between text-gray-400">
                    <span className="text-xs font-semibold uppercase tracking-wider">오늘의 에러 요청</span>
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold tracking-tight text-gray-100">{todayErrorRequests}</span>
                    <span className="text-xs text-gray-500">건 발생</span>
                  </div>
                </div>

                <div className="metallic-card p-5 border border-gray-800/50">
                  <div className="flex items-center justify-between text-gray-400">
                    <span className="text-xs font-semibold uppercase tracking-wider">미션 완료율</span>
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold tracking-tight text-gray-100">{missionCompletionRate}%</span>
                    <span className="text-xs text-gray-500">({completedCount}/{totalStudents})</span>
                  </div>
                </div>

                <div className="metallic-card p-5 border border-gray-800/50">
                  <div className="flex items-center justify-between text-gray-400">
                    <span className="text-xs font-semibold uppercase tracking-wider">이메일 발송 완료</span>
                    <Send className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold tracking-tight text-gray-100">{totalSentEmails}</span>
                    <span className="text-xs text-gray-500">건 전송 완료</span>
                  </div>
                </div>
              </div>

              {/* 메인 리포트 레이아웃 (데이터 테이블 & 사이드 패널) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* 3. 중앙 메인 섹션: 수강생 목록 표 */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">수강생 학습 상태 리스트</h2>
                    
                    {/* 실시간 필터링 */}
                    <div className="relative max-w-xs w-full">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                        <Search className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type="text"
                        placeholder="이름 또는 이메일 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full pl-9 pr-4 py-1.5 bg-gray-900/60 border border-gray-850 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all text-xs"
                      />
                    </div>
                  </div>

                  <div className="metallic-card overflow-hidden border border-gray-800/40">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-950/50 border-b border-gray-800/60 text-gray-400 font-semibold uppercase tracking-wider">
                          <th className="p-4">이름 / 이메일</th>
                          <th className="p-4">현재 학습 상태</th>
                          <th className="p-4 hidden sm:table-cell">최근 활동 시간</th>
                          <th className="p-4 text-right">상세 보기</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-850/50">
                        {filteredProfiles.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-gray-500">
                              일치하는 수강생이 없습니다.
                            </td>
                          </tr>
                        ) : (
                          filteredProfiles.map((student) => {
                            const lastAction = actionLogs.find(
                              (act) => act.user_id === student.id
                            );
                            const lastActiveTime = lastAction 
                              ? new Date(lastAction.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) 
                              : '-';

                            return (
                              <tr 
                                key={student.id} 
                                className={`hover:bg-gray-900/10 transition-colors cursor-pointer ${
                                  selectedStudentId === student.id ? 'bg-purple-950/10' : ''
                                }`}
                                onClick={() => setSelectedStudentId(student.id)}
                              >
                                <td className="p-4">
                                  <p className="font-semibold text-gray-200">{student.name}</p>
                                  <p className="text-[10px] text-gray-500 mt-0.5">{student.email}</p>
                                </td>
                                <td className="p-4">
                                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${getStatusBadge(student.current_status)}`}>
                                    {getStatusLabel(student.current_status)}
                                  </span>
                                </td>
                                <td className="p-4 hidden sm:table-cell text-gray-400">
                                  {lastActiveTime}
                                </td>
                                <td className="p-4 text-right">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedStudentId(student.id);
                                    }}
                                    className="px-2.5 py-1 bg-purple-600/15 text-purple-400 border border-purple-500/20 hover:bg-purple-600/25 active:bg-purple-600/35 rounded-lg text-[10px] font-semibold tracking-wider transition-colors cursor-pointer"
                                  >
                                    조회
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 4. 프로액티브 대안: 시뮬레이션용 수강생 조작 스위치 */}
                  {selectedStudent && mockMode && (
                    <div className="metallic-card p-5 border border-purple-950/20 bg-purple-950/5">
                      <div className="flex items-center gap-2 mb-3 text-purple-400">
                        <Sliders className="w-4 h-4" />
                        <h3 className="text-xs font-semibold uppercase tracking-wider">개발 검증용: 수강생 시뮬레이션 컨트롤</h3>
                      </div>
                      <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                        현재 활성화된 테스트 수강생을 <strong>[{selectedStudent.name}]</strong>(으)로 전환하여 수강생 화면에 강제 매핑합니다. 
                        수강생 화면에서 클릭하는 상태 버튼의 데이터 흐름이 이 어드민 패널에 실시간 반영되는지 직접 검증해 보세요.
                      </p>
                      <button
                        onClick={() => {
                          setMockUser(selectedStudent.id);
                          window.open('/dashboard', '_blank');
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/10 cursor-pointer"
                      >
                        <span>이 수강생으로 가상 로그인 & 화면 열기</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* 5. 우측 사이드 패널: 이메일 수신 이력 및 타임라인 로그 */}
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                    {selectedStudent ? `${selectedStudent.name} 수강생 로그` : '수강생 상세 로그'}
                  </h2>

                  {selectedStudent ? (
                    <div className="metallic-card border border-gray-800/40 p-5 space-y-6">
                      
                      {/* 수강생 프로필 요약 */}
                      <div>
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-lg bg-gray-900 text-gray-400">
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-gray-200">{selectedStudent.name}</h3>
                            <p className="text-[10px] text-gray-500 mt-0.5">{selectedStudent.email}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-gray-850/60 pt-3 text-xs">
                          <span className="text-gray-500">학습 상태:</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getStatusBadge(selectedStudent.current_status)}`}>
                            {getStatusLabel(selectedStudent.current_status)}
                          </span>
                        </div>
                      </div>

                      {/* 이메일 발송 이력 타임라인 */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">수신 이메일 리스트</h4>
                        {studentEmails.length === 0 ? (
                          <p className="text-xs text-gray-500 text-center py-4 bg-gray-900/20 rounded-xl">
                            발송된 이메일 로그가 없습니다.
                          </p>
                        ) : (
                          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                            {studentEmails.map((log) => {
                              const isScheduled = log.status === 'scheduled';
                              const mailTypeLabels = {
                                guide: '실습 가이드 핵심 요약',
                                error: '에러 디버깅 팁 & 위로 레터',
                                mission_completed: '미션 완료 축하 메시지',
                                follow_up: '심화 로드맵 제안 (지연)',
                              };
                              return (
                                <div key={log.id} className="p-3 bg-gray-900/40 border border-gray-850 rounded-xl flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-xs">
                                    <Mail className="w-3.5 h-3.5 text-purple-400" />
                                    <div>
                                      <p className="font-medium text-gray-300">{mailTypeLabels[log.email_type as keyof typeof mailTypeLabels] || log.email_type}</p>
                                      <span className={`inline-block mt-1 text-[9px] font-semibold uppercase ${
                                        log.status === 'sent' ? 'text-emerald-400' : 'text-blue-400 animate-pulse'
                                      }`}>
                                        {log.status === 'sent' ? '발송 완료' : '예약됨'}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="text-[9px] text-gray-500">
                                    {new Date(log.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* 행동 로그 */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">행동 타임라인</h4>
                        {studentActions.length === 0 ? (
                          <p className="text-xs text-gray-500 text-center py-4 bg-gray-900/20 rounded-xl">
                            감지된 행동 로그가 없습니다.
                          </p>
                        ) : (
                          <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-800">
                            {studentActions.map((act) => {
                              const actionLabels = {
                                click_guide: '실습 가이드 받기 버튼 클릭',
                                click_error: '에러와 싸우는 중 버튼 클릭',
                                click_mission: '미션 완료 버튼 클릭',
                              };
                              return (
                                <div key={act.id} className="flex items-start gap-3 text-xs relative pl-6">
                                  <div className="absolute left-[9px] top-1.5 w-1.5 h-1.5 rounded-full bg-purple-500 shadow-sm shadow-purple-500" />
                                  <div className="flex-1">
                                    <p className="text-gray-300 font-medium">{actionLabels[act.action_type] || act.action_type}</p>
                                    <p className="text-[9px] text-gray-500 mt-0.5">
                                      {new Date(act.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                    </div>
                  ) : (
                    <div className="metallic-card p-8 text-center text-sm text-gray-500">
                      수강생을 목록에서 선택하면 상세 타임라인이 표출됩니다.
                    </div>
                  )}
                </div>

              </div>
            </>
          )}

          {activeTab === 'students' && (
            <div className="metallic-card p-6 text-center text-sm text-gray-500">
              수강생 목록 디테일 뷰 영역입니다. (통합 리포트 대시보드 홈에서 상세 보기를 지원합니다.)
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="metallic-card p-6 border border-gray-800/40">
                <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  실습 가이드 이메일 템플릿
                </h3>
                <div className="p-4 bg-gray-900/60 border border-gray-850 rounded-xl space-y-3 text-xs">
                  <p className="text-gray-400"><strong className="text-gray-300">제목:</strong> [Vibe Mailer] 실습 가이드북 및 핵심 요약본</p>
                  <div className="border-t border-gray-850/60 pt-3 text-gray-300 leading-relaxed space-y-2">
                    <p>안녕하세요, 수강생님!</p>
                    <p>요청하신 실습 과정의 1단계 가이드북입니다. 다음 핵심 로직을 확인해보세요.</p>
                    <pre className="bg-black/50 p-2.5 rounded-lg text-[10px] text-purple-300 font-mono">
                      const {`{ data, error }`} = await supabase...
                    </pre>
                    <p>궁금한 점이 있다면 언제든 대시보드의 에러 버튼을 클릭해주세요!</p>
                  </div>
                </div>
              </div>

              <div className="metallic-card p-6 border border-gray-800/40">
                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  에러 대응 이메일 템플릿
                </h3>
                <div className="p-4 bg-gray-900/60 border border-gray-850 rounded-xl space-y-3 text-xs">
                  <p className="text-gray-400"><strong className="text-gray-300">제목:</strong> [Vibe Mailer] 에러 극복 디버깅 팁 & 위로</p>
                  <div className="border-t border-gray-850/60 pt-3 text-gray-300 leading-relaxed space-y-2">
                    <p>안녕하세요! 에러 때문에 고생이 많으십니다.</p>
                    <p>포기하지 마세요! 가장 자주 발생하는 체크리스트입니다.</p>
                    <ul className="list-disc pl-4 space-y-1 text-amber-300/90">
                      <li>Supabase URL 및 Anon Key 환경변수가 잘 설정되었나요?</li>
                      <li>RLS Policy에 따른 Select 권한이 부여되었나요?</li>
                    </ul>
                    <p>화이팅입니다! 완강을 응원합니다.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
