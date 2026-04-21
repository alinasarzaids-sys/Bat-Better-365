import React, { createContext, useRef, useState, useEffect, useCallback, ReactNode } from 'react';

export type TrainingType = 'bowling_machine' | 'bowler_spinner' | 'bowler_fast' | 'side_arm' | 'over_arm' | 'under_arm';

export interface DrillSessionState {
  isActive: boolean;
  isMinimized: boolean;
  drillId: string;
  drillName: string;
  pillar: string;
  elapsedSeconds: number;
  isPaused: boolean;
  returnPath: string;
  returnParams: Record<string, string>;
}

// Academy session state stored in context so it survives minimize
export interface AcademySessionState {
  isActive: boolean;
  isMinimized: boolean;
  kind: string;          // Batting | Bowling | Fielding | Fitness
  color: string;
  elapsedSeconds: number;
  isPaused: boolean;
  counters: number[];    // up to 3 counters depending on session type
  objective: string;     // single focused objective
  // Closing state
  step: number;          // which step the user was on when minimized
  objectiveDone: boolean | null;
  answers: Record<string, number>;
  academyId: string;
}

export interface ActiveSessionState {
  isActive: boolean;
  isMinimized: boolean;
  currentStep: number;
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
  drillSession: DrillSessionState;
  academySession: AcademySessionState;

  // Drill session
  startDrillSession: (drillId: string, drillName: string, pillar: string, returnPath: string, returnParams?: Record<string, string>) => void;
  minimizeDrillSession: () => void;
  maximizeDrillSession: () => void;
  endDrillSession: () => void;
  setDrillIsPaused: (val: boolean) => void;

  // Academy session
  startAcademySession: (kind: string, color: string, objective: string, academyId: string) => void;
  minimizeAcademySession: (step: number, counters: number[], objectiveDone: boolean | null, answers: Record<string, number>) => void;
  maximizeAcademySession: () => void;
  updateAcademySessionStep: (step: number) => void;
  setAcademyIsPaused: (val: boolean) => void;
  endAcademySession: () => void;

  // Freestyle session
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

const defaultDrillSession: DrillSessionState = {
  isActive: false,
  isMinimized: false,
  drillId: '',
  drillName: '',
  pillar: '',
  elapsedSeconds: 0,
  isPaused: false,
  returnPath: '',
  returnParams: {},
};

const defaultAcademySession: AcademySessionState = {
  isActive: false,
  isMinimized: false,
  kind: '',
  color: '',
  elapsedSeconds: 0,
  isPaused: false,
  counters: [0, 0, 0],
  objective: '',
  step: 2,
  objectiveDone: null,
  answers: {},
  academyId: '',
};

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
  const [drillSession, setDrillSession] = useState<DrillSessionState>(defaultDrillSession);
  const [academySession, setAcademySession] = useState<AcademySessionState>(defaultAcademySession);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const drillTimerRef = useRef<NodeJS.Timeout | null>(null);
  const academyTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Freestyle timer
  useEffect(() => {
    if (state.isActive && !state.isPaused && state.currentStep === 2) {
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, elapsedSeconds: prev.elapsedSeconds + 1 }));
      }, 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [state.isActive, state.isPaused, state.currentStep]);

  // Drill timer
  useEffect(() => {
    if (drillSession.isActive && !drillSession.isPaused) {
      drillTimerRef.current = setInterval(() => {
        setDrillSession(prev => ({ ...prev, elapsedSeconds: prev.elapsedSeconds + 1 }));
      }, 1000);
    } else {
      if (drillTimerRef.current) { clearInterval(drillTimerRef.current); drillTimerRef.current = null; }
    }
    return () => { if (drillTimerRef.current) { clearInterval(drillTimerRef.current); drillTimerRef.current = null; } };
  }, [drillSession.isActive, drillSession.isPaused]);

  // Academy timer — runs even when minimized
  useEffect(() => {
    if (academySession.isActive && !academySession.isPaused) {
      academyTimerRef.current = setInterval(() => {
        setAcademySession(prev => ({ ...prev, elapsedSeconds: prev.elapsedSeconds + 1 }));
      }, 1000);
    } else {
      if (academyTimerRef.current) { clearInterval(academyTimerRef.current); academyTimerRef.current = null; }
    }
    return () => { if (academyTimerRef.current) { clearInterval(academyTimerRef.current); academyTimerRef.current = null; } };
  }, [academySession.isActive, academySession.isPaused]);

  // ── Freestyle session actions ────────────────────────────────────────────────
  const startActiveSession = useCallback((startTime: Date) => {
    setState(prev => ({
      ...prev, isActive: true, isMinimized: false, currentStep: 2,
      sessionStartTime: startTime, elapsedSeconds: 0, isPaused: false,
      ballsFacedLive: 0, ballsFacedInput: '0',
    }));
  }, []);

  const minimizeSession = useCallback(() => setState(prev => ({ ...prev, isMinimized: true })), []);
  const maximizeSession = useCallback(() => setState(prev => ({ ...prev, isMinimized: false })), []);
  const endActiveSession = useCallback(() => setState(prev => ({ ...prev, isActive: false, isMinimized: false, currentStep: 3 })), []);
  const resetSession = useCallback(() => setState({ ...defaultState, scheduledDate: new Date(), scheduledTime: new Date() }), []);

  // ── Drill session actions ────────────────────────────────────────────────────
  const startDrillSession = useCallback((drillId: string, drillName: string, pillar: string, returnPath: string, returnParams: Record<string, string> = {}) => {
    setDrillSession({ isActive: true, isMinimized: false, drillId, drillName, pillar, elapsedSeconds: 0, isPaused: false, returnPath, returnParams });
  }, []);
  const minimizeDrillSession = useCallback(() => setDrillSession(prev => ({ ...prev, isMinimized: true })), []);
  const maximizeDrillSession = useCallback(() => setDrillSession(prev => ({ ...prev, isMinimized: false })), []);
  const endDrillSession = useCallback(() => setDrillSession(defaultDrillSession), []);
  const setDrillIsPaused = useCallback((val: boolean) => setDrillSession(prev => ({ ...prev, isPaused: val })), []);

  // ── Academy session actions ──────────────────────────────────────────────────
  const startAcademySession = useCallback((kind: string, color: string, objective: string, academyId: string) => {
    setAcademySession({ ...defaultAcademySession, isActive: true, isMinimized: false, kind, color, objective, academyId });
  }, []);

  const minimizeAcademySession = useCallback((step: number, counters: number[], objectiveDone: boolean | null, answers: Record<string, number>) => {
    setAcademySession(prev => ({ ...prev, isMinimized: true, step, counters, objectiveDone, answers }));
  }, []);

  const maximizeAcademySession = useCallback(() => {
    setAcademySession(prev => ({ ...prev, isMinimized: false }));
  }, []);

  const updateAcademySessionStep = useCallback((step: number) => {
    setAcademySession(prev => ({ ...prev, step }));
  }, []);

  const setAcademyIsPaused = useCallback((val: boolean) => {
    setAcademySession(prev => ({ ...prev, isPaused: val }));
  }, []);

  const endAcademySession = useCallback(() => {
    setAcademySession(defaultAcademySession);
  }, []);

  return (
    <SessionContext.Provider value={{
      ...state,
      drillSession,
      academySession,
      startDrillSession, minimizeDrillSession, maximizeDrillSession, endDrillSession, setDrillIsPaused,
      startAcademySession, minimizeAcademySession, maximizeAcademySession, updateAcademySessionStep, setAcademyIsPaused, endAcademySession,
      startActiveSession, minimizeSession, maximizeSession, endActiveSession, resetSession,
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
