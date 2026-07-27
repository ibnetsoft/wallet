"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Clock, Play, Save, X, AlertCircle, RefreshCw } from "lucide-react";

interface GameRound {
  id?: number;
  round_number: number;
  start_time: string;
  end_time: string;
  draw_time: string;
}

export default function GameRoundsPage() {
  const [rounds, setRounds] = useState<GameRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Form modal states
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingRoundId, setEditingRoundId] = useState<number | null>(null);
  
  const [formRoundNumber, setFormRoundNumber] = useState<number>(1);
  const [formStartTime, setFormStartTime] = useState("12:00");
  const [formEndTime, setFormEndTime] = useState("13:00");
  const [formDrawTime, setFormDrawTime] = useState("13:30");

  useEffect(() => {
    fetchRounds();
  }, []);

  // Update draw time automatically when end time changes (+30 mins)
  useEffect(() => {
    if (!formEndTime) return;
    try {
      const [h, m] = formEndTime.split(":");
      const endMinutes = parseInt(h) * 60 + parseInt(m);
      if (isNaN(endMinutes)) return;
      
      const drawMinutes = (endMinutes + 30) % 1440;
      const drawH = Math.floor(drawMinutes / 60).toString().padStart(2, "0");
      const drawM = (drawMinutes % 60).toString().padStart(2, "0");
      setFormDrawTime(`${drawH}:${drawM}`);
    } catch (e) {
      // ignore
    }
  }, [formEndTime]);

  const fetchRounds = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/game-rounds");
      const data = await res.json();
      if (data.success) {
        setRounds(data.rounds);
      } else {
        setError(data.error || "회차 목록을 불러오는데 실패했습니다.");
      }
    } catch (err: any) {
      setError(err.message || "서버와 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setModalMode("add");
    setEditingRoundId(null);
    // Auto increment round number
    const maxRound = rounds.reduce((max, r) => r.round_number > max ? r.round_number : max, 0);
    setFormRoundNumber(maxRound + 1);
    setFormStartTime("12:00");
    setFormEndTime("13:00");
    setShowModal(true);
  };

  const handleOpenEditModal = (round: GameRound) => {
    setModalMode("edit");
    setEditingRoundId(round.id || null);
    setFormRoundNumber(round.round_number);
    // Trim HH:MM:SS to HH:MM
    setFormStartTime(round.start_time.substring(0, 5));
    setFormEndTime(round.end_time.substring(0, 5));
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    const payload = {
      id: editingRoundId,
      round_number: Number(formRoundNumber),
      start_time: formStartTime + ":00",
      end_time: formEndTime + ":00",
    };

    try {
      const method = modalMode === "add" ? "POST" : "PUT";
      const res = await fetch("/api/game-rounds", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      
      if (data.success) {
        setShowModal(false);
        fetchRounds();
      } else {
        setError(data.error || "게임 회차를 저장하지 못했습니다.");
      }
    } catch (err: any) {
      setError(err.message || "서버 요청 중 오류가 발생했습니다.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("정말로 이 게임 회차를 삭제하시겠습니까?")) return;
    setError("");
    try {
      const res = await fetch(`/api/game-rounds?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        fetchRounds();
      } else {
        setError(data.error || "회차 삭제에 실패했습니다.");
      }
    } catch (err: any) {
      setError(err.message || "서버 요청 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="space-y-8 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">일일 URD 게임 회차 설정</h2>
          <p className="text-sm text-[#8E8E93] mt-1">
            유저들이 매일 참여할 수 있는 URD 로또 게임의 회차 시간대를 생성하고 삭제합니다.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-[#00D2FF] to-[#BF5AF2] text-black font-bold rounded-xl text-xs active:scale-95 transition-all shadow-[0_0_20px_rgba(0,210,255,0.2)]"
        >
          <Plus size={16} />
          <span>신규 회차 추가</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-[#FF453A]/10 border border-[#FF453A]/30 rounded-xl flex items-start space-x-2.5 text-[#FF453A] max-w-2xl">
          <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
          <span className="text-xs font-semibold">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center space-x-2 text-[#8E8E93] py-12">
          <RefreshCw size={18} className="animate-spin" />
          <span className="text-sm font-semibold">회차 설정 로딩 중...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rounds.map((round) => (
            <div
              key={round.id}
              className="bg-[#16161A] border border-[#26262B] rounded-2xl p-5 shadow-lg relative flex flex-col justify-between hover:border-[#00D2FF]/30 transition-all group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-black bg-[#FCD535]/10 text-[#FCD535] border border-[#FCD535]/20 font-mono">
                    {round.round_number}회차
                  </span>
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenEditModal(round)}
                      className="p-1.5 hover:bg-[#26262B] text-[#8E8E93] hover:text-[#FFFFFF] rounded-lg transition-colors"
                      title="수정"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(round.id!)}
                      className="p-1.5 hover:bg-[#FF453A]/10 text-[#8E8E93] hover:text-[#FF453A] rounded-lg transition-colors"
                      title="삭제"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#8E8E93]">참여 가능 시간</span>
                    <span className="font-mono font-bold text-white">
                      {round.start_time.substring(0, 5)} ~ {round.end_time.substring(0, 5)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-t border-[#26262B]/50 pt-2.5">
                    <span className="text-[#8E8E93] flex items-center">
                      <Clock size={12} className="mr-1 text-[#0ECB81]" />
                      당첨 결과 발표 (자동 +30분)
                    </span>
                    <span className="font-mono font-bold text-[#FCD535]">
                      {round.draw_time.substring(0, 5)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {rounds.length === 0 && (
            <div className="col-span-full py-12 text-center text-[#8E8E93] border border-dashed border-[#26262B] rounded-2xl bg-[#16161A]/30">
              설정된 게임 회차가 없습니다. 신규 회차를 추가해 주세요.
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#16161A] border border-[#26262B] rounded-2xl max-w-md w-full shadow-2xl p-6 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1 hover:bg-[#26262B] rounded-lg text-[#8E8E93] hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            <h3 className="text-base font-bold text-white mb-4">
              {modalMode === "add" ? "신규 게임 회차 추가" : "게임 회차 수정"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-[#8E8E93] uppercase font-bold ml-0.5">회차 번호 (숫자만)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={formRoundNumber}
                  onChange={(e) => setFormRoundNumber(parseInt(e.target.value) || 1)}
                  className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#00D2FF] rounded-xl px-4 py-3 text-xs text-white outline-none font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-[#8E8E93] uppercase font-bold ml-0.5">시작 시간 (HH:MM)</label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#00D2FF] rounded-xl px-4 py-3 text-xs text-white outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-[#8E8E93] uppercase font-bold ml-0.5">종료 시간 (HH:MM)</label>
                  <input
                    type="time"
                    required
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#00D2FF] rounded-xl px-4 py-3 text-xs text-white outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-[#8E8E93] uppercase font-bold ml-0.5">
                  AI 당첨 발표 시간 (자동 설정)
                </label>
                <div className="w-full bg-[#121215] border border-[#26262B] rounded-xl px-4 py-3 text-xs text-[#FCD535] font-mono font-bold flex items-center">
                  <Clock size={14} className="mr-2 text-[#0ECB81]" />
                  {formDrawTime} (종료 시간 +30분)
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 mt-2 bg-gradient-to-r from-[#00D2FF] to-[#BF5AF2] text-black font-black rounded-xl text-xs flex items-center justify-center space-x-2 active:scale-95 transition-transform shadow-[0_0_20px_rgba(0,210,255,0.2)]"
              >
                <Save size={14} />
                <span>회차 설정 저장</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
