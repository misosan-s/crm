'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Mail, User, ShieldAlert, LogIn, ArrowRight, Activity } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { user, login } = useApp();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 이미 로그인된 사용자는 대시보드로 자동 리다이렉트
  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('이메일 주소를 입력해주세요.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    
    try {
      const success = await login(email, name || email.split('@')[0]);
      if (success) {
        router.push('/dashboard');
      } else {
        setErrorMsg('로그인에 실패했습니다. 다시 시도해 주세요.');
      }
    } catch (err) {
      setErrorMsg('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminAccess = () => {
    router.push('/admin');
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center p-6 bg-gradient-to-br from-[#0c0e12] via-[#0f1115] to-[#171a22]">
      <div className="w-full max-w-md">
        {/* 서비스 로고 */}
        <div className="flex items-center justify-center gap-2 mb-8 animate-fade-in">
          <div className="p-2.5 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-500 shadow-lg shadow-purple-500/5">
            <Activity className="w-6 h-6" />
          </div>
          <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-purple-400 to-indigo-200 bg-clip-text text-transparent">
            Vibe Mailer
          </span>
        </div>

        {/* 메인 로그인 카드 */}
        <div className="metallic-card metallic-card-glow p-8 mb-6">
          <div className="mb-6 text-center sm:text-left">
            <h2 className="text-xl font-semibold text-gray-100">학습 대시보드 로그인</h2>
            <p className="text-sm text-gray-400 mt-1">본인의 이메일을 입력하여 맞춤 실습 가이드를 받아보세요.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                이메일 주소
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 bg-gray-900/60 border border-gray-800 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="name" className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                이름 (선택사항)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="name"
                  type="text"
                  placeholder="홍길동"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 bg-gray-900/60 border border-gray-800 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all text-sm"
                />
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs text-red-400 font-medium">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:bg-purple-600/50 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer shadow-lg shadow-purple-600/15"
            >
              {loading ? (
                <span>로그인 중...</span>
              ) : (
                <>
                  <span>로그인하기</span>
                  <LogIn className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* 어드민 대시보드 바로가기 카드 */}
        <div className="metallic-card p-5 border border-gray-800/40 hover:border-gray-700/60 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-200">강사용 관리자 대시보드</h3>
                <p className="text-xs text-gray-500">수강생의 상태 변화와 이메일 발송 현황 모니터링</p>
              </div>
            </div>
            <button
              onClick={handleAdminAccess}
              className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

