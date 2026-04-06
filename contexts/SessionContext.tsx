import React, { createContext, useRef, useState, useEffect, useCallback, ReactNode } from 'react';

export type TrainingType = 'bowling_machine' | 'bowler_spinner' | 'bowler_fast' | 'side_arm' | 'over_arm' | 'under_arm';

export interface ActiveSessionState {
  isActive: boolean;          // Step 2 session in progress
  isMinimized: boolean;       // Minimized but still running
  currentStep: number;        // 1-4
  sessionStartTime: Date | null;
  elapsedSeconds: number;
  isPaused: boolean;
  ballsFacedLive: number;
  ballsFacedInput: string;
  selectedTrainingTypes: Set<TrainingType>;
  focusArea: string;
  sessionGoal: string;
  estimatedDuration: string;
  sessionMode: 'now' | 'later';
  scheduledDate: Date;
  scheduledTime: Date;
  // Step 3 ratings
  ballsFaced: string;
  ballsMiddled: string;
  shotExecution: number;
  footwork: number;
  timing: number;
  focus: number;
  confidence: number;
  pressureHandling: number;
  energyLevel: number;
  reactionSpeed: number;
  shotSelection: number;
  gameAwareness: number;
  sessionNotes: string;
  xpBreakdown: any;
  saving: boolean;
}

interface SessionContextType extends ActiveSessionState {
  startActiveSession: (startTime: Date) => void;
  minimizeSession: () => void;
  maximizeSession: () => void;
  endActiveSession: () => void;
  resetSession: () => void;
  setCurrentStep: (step: number) => void;
  setIsPaused: (paused: boolean) => void;
  setBallsFacedLive: (val: number) => void;
  setBallsFacedInput: (val: string) => void;
  setSelectedTrainingTypes: (val: Set<TrainingType>) => void;
  setFocusArea: (val: string) => void;
  setSessionGoal: (val: string) => void;
  setEstimatedDuration: (val: string) => void;
  setSessionMode: (val: 'now' | 'later') => void;
  setScheduledDate: (val: Date) => void;
  setScheduledTime: (val: Date) => void;
  setBallsFaced: (val: string) => void;
  setBallsMiddled: (val: string) => void;
  setShotExecution: (val: number) => void;
  setFootwork: (val: number) => void;
  setTiming: (val: number) => void;
  setFocus: (val: number) => void;
  setConfidence: (val: number) => void;
  setPressureHandling: (val: number) => void;
  setEnergyLevel: (val: number) => void;
  setReactionSpeed: (val: number) => void;
  setShotSelection: (val: number) => void;
  setGameAwareness: (val: number) => void;
  setSessionNotes: (val: string) => void;
  setXpBreakdown: (val: any) => void;
  setSaving: (val: boolean) => void;
}

const defaultState: ActiveSessionState = {
  isActive: false,
  isMinimized: false,
  currentStep: 1,
  sessionStartTime: null,
  elapsedSeconds: 0,
  isPaused: false,
  ballsFacedLive: 0,
  ballsFacedInput: '0',
  selectedTrainingTypes: new Set(),
  focusArea: '',
  sessionGoal: '',
  estimatedDuration: '60',
  sessionMode: 'now',
  scheduledDate: new Date(),
  scheduledTime: new Date(),
  ballsFaced: '',
  ballsMiddled: '',
  shotExecution: 0,
  footwork: 0,
  timing: 0,
  focus: 0,
  confidence: 0,
  pressureHandling: 0,
  energyLevel: 0,
  reactionSpeed: 0,
  shotSelection: 0,
  gameAwareness: 0,
  sessionNotes: '',
  xpBreakdown: null,
  saving: false,
};

export const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ActiveSessionState>(defaultState);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Run timer globally in context — keeps ticking even when session modal is closed
  useEffect(() => {
    if (state.isActive && !state.isPaused && state.currentStep === 2) {
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, elapsedSeconds: prev.elapsedSeconds + 1 }));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state.isActive, state.isPaused, state.currentStep]);

  const startActiveSession = useCallback((startTime: Date) => {
    setState(prev => ({
      ...prev,
      isActive: true,
      isMinimized: false,
      currentStep: 2,
      sessionStartTime: startTime,
      elapsedSeconds: 0,
      isPaused: false,
      ballsFacedLive: 0,
      ballsFacedInput: '0',
    }));
  }, []);

  const minimizeSession = useCallback(() => {
    setState(prev => ({ ...prev, isMinimized: true }));
  }, []);

  const maximizeSession = useCallback(() => {
    setState(prev => ({ ...prev, isMinimized: false }));
  }, []);

  const endActiveSession = useCallback(() => {
    setState(prev => ({ ...prev, isActive: false, isMinimized: false, currentStep: 3 }));
  }, []);

  const resetSession = useCallback(() => {
    setState({ ...defaultState, scheduledDate: new Date(), scheduledTime: new Date() });
  }, []);

  const makeSimpleSetter = <K extends keyof ActiveSessionState>(key: K) =>
    useCallback((val: ActiveSessionState[K]) => setState(prev => ({ ...prev, [key]: val })), []);

  return (
    <SessionContext.Provider value={{
      ...state,
      startActiveSession,
      minimizeSession,
      maximizeSession,
      endActiveSession,
      resetSession,
      setCurrentStep: (v) => setState(p => ({ ...p, currentStep: v })),
      setIsPaused: (v) => setState(p => ({ ...p, isPaused: v })),
      setBallsFacedLive: (v) => setState(p => ({ ...p, ballsFacedLive: v })),
      setBallsFacedInput: (v) => setState(p => ({ ...p, ballsFacedInput: v })),
      setSelectedTrainingTypes: (v) => setState(p => ({ ...p, selectedTrainingTypes: v })),
      setFocusArea: (v) => setState(p => ({ ...p, focusArea: v })),
      setSessionGoal: (v) => setState(p => ({ ...p, sessionGoal: v })),
      setEstimatedDuration: (v) => setState(p => ({ ...p, estimatedDuration: v })),
      setSessionMode: (v) => setState(p => ({ ...p, sessionMode: v })),
      setScheduledDate: (v) => setState(p => ({ ...p, scheduledDate: v })),
      setScheduledTime: (v) => setState(p => ({ ...p, scheduledTime: v })),
      setBallsFaced: (v) => setState(p => ({ ...p, ballsFaced: v })),
      setBallsMiddled: (v) => setState(p => ({ ...p, ballsMiddled: v })),
      setShotExecution: (v) => setState(p => ({ ...p, shotExecution: v })),
      setFootwork: (v) => setState(p => ({ ...p, footwork: v })),
      setTiming: (v) => setState(p => ({ ...p, timing: v })),
      setFocus: (v) => setState(p => ({ ...p, focus: v })),
      setConfidence: (v) => setState(p => ({ ...p, confidence: v })),
      setPressureHandling: (v) => setState(p => ({ ...p, pressureHandling: v })),
      setEnergyLevel: (v) => setState(p => ({ ...p, energyLevel: v })),
      setReactionSpeed: (v) => setState(p => ({ ...p, reactionSpeed: v })),
      setShotSelection: (v) => setState(p => ({ ...p, shotSelection: v })),
      setGameAwareness: (v) => setState(p => ({ ...p, gameAwareness: v })),
      setSessionNotes: (v) => setState(p => ({ ...p, sessionNotes: v })),
      setXpBreakdown: (v) => setState(p => ({ ...p, xpBreakdown: v })),
      setSaving: (v) => setState(p => ({ ...p, saving: v })),
    }}>
      {children}
    </SessionContext.Provider>
  );
}
