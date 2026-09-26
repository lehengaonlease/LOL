import React from 'react';
import {
  X,
  CheckSquare,
  Plus,
  RefreshCw,
  CheckCircle2,
  Circle,
  Sparkles,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { StudioTaskReminder } from '../types';

interface GoogleTasksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isConnected: boolean;
  isConnecting: boolean;
  isLoadingTasks: boolean;
  onConnectGoogleTasks: () => void;
  onRefreshTasks: () => void;
  tasks: StudioTaskReminder[];
  onToggleTaskStatus: (task: StudioTaskReminder) => void;
  onCreateSampleTask: () => void;
  errorMsg: string | null;
}

export const GoogleTasksDrawer: React.FC<GoogleTasksDrawerProps> = ({
  isOpen,
  onClose,
  isConnected,
  isConnecting,
  isLoadingTasks,
  onConnectGoogleTasks,
  onRefreshTasks,
  tasks,
  onToggleTaskStatus,
  onCreateSampleTask,
  errorMsg,
}) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white h-full shadow-2xl border-l border-[#1C1310]/10 flex flex-col justify-between"
      >
        {/* Top Header */}
        <div className="p-6 border-b border-[#1C1310]/10 bg-[#FAF8F5] flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#E85D24] font-semibold block">
              24-Hr Next-Day Return Tracker
            </span>
            <h3 className="font-editorial text-2xl font-semibold text-[#1C1310]">
              Studio Bookings & Tasks
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-[#1C1310]/10 flex items-center justify-center text-[#1C1310]/60 hover:text-[#1C1310] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto luxury-scroll space-y-5">
          {/* Google Tasks Sync Banner */}
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#1C1310]/10 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#1C1310]">
                  Google Tasks Integration
                </h4>
                <p className="text-xs text-[#1C1310]/65 mt-1 leading-relaxed">
                  Automatically sync next-day lehenga return deadlines and steam-cleaning reminders
                  with your Google account.
                </p>
              </div>
              {isConnected && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold shrink-0">
                  Connected
                </span>
              )}
            </div>

            {errorMsg && (
              <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                {errorMsg}
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              {!isConnected ? (
                <button
                  onClick={onConnectGoogleTasks}
                  disabled={isConnecting}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-[#1C1310] text-white text-xs font-semibold hover:bg-[#E85D24] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{isConnecting ? 'Connecting...' : 'Sync With Google Tasks'}</span>
                </button>
              ) : (
                <button
                  onClick={onRefreshTasks}
                  disabled={isLoadingTasks}
                  className="py-2 px-3.5 rounded-lg border border-[#1C1310]/15 bg-white text-xs font-medium text-[#1C1310] hover:bg-[#FAF8F5] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTasks ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              )}

              <button
                onClick={onCreateSampleTask}
                className="py-2.5 px-3.5 rounded-lg border border-[#1C1310]/15 bg-white text-xs font-medium text-[#1C1310] hover:bg-[#FAF8F5] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#E85D24]" />
                <span>Add Sample Return</span>
              </button>
            </div>
          </div>

          {/* Tasks List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#1C1310]/60">
                Scheduled Returns ({tasks.length})
              </h4>
            </div>

            {tasks.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-xl border border-dashed border-[#1C1310]/15 bg-[#FAF8F5]/50">
                <CheckSquare className="w-8 h-8 text-[#1C1310]/30 mx-auto mb-2" />
                <p className="text-sm font-medium text-[#1C1310]">No active return reminders</p>
                <p className="text-xs text-[#1C1310]/55 mt-1">
                  Reserve any lehenga in the catalog to automatically schedule a 24-hour next-day
                  return reminder.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {tasks.map((task) => {
                  const isDone = task.status === 'completed';
                  return (
                    <div
                      key={task.id}
                      onClick={() => onToggleTaskStatus(task)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                        isDone
                          ? 'bg-[#FAF8F5] border-[#1C1310]/8 opacity-60'
                          : 'bg-white border-[#1C1310]/12 hover:border-[#1C1310]/30 shadow-2xs'
                      }`}
                    >
                      <button
                        type="button"
                        className="mt-0.5 text-[#E85D24] shrink-0 cursor-pointer"
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-xs font-semibold text-[#1C1310] ${
                            isDone ? 'line-through' : ''
                          }`}
                        >
                          {task.title}
                        </p>
                        {task.notes && (
                          <p className="text-[11px] text-[#1C1310]/65 mt-1 leading-relaxed">
                            {task.notes}
                          </p>
                        )}
                        {task.due && (
                          <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-[#E85D24] bg-[#E85D24]/10 px-2 py-0.5 rounded">
                            <Calendar className="w-3 h-3" />
                            <span>
                              Due: {new Date(task.due).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1C1310]/10 bg-[#FAF8F5] text-center">
          <p className="text-[11px] text-[#1C1310]/60 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#E85D24]" />
            <span>LOL By Sanjeevani • Indore Studio Concierge</span>
          </p>
        </div>
      </div>
    </div>
  );
};
