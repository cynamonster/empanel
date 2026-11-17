import React, { createContext, useContext, useEffect, useState, useMemo, useRef, useCallback } from 'react';
import type { Case, Juror, Question, CauseChallenge, PeremptoryStrikeAction, ViewMode, SyncStatus, WhisperMessage, SyncRole, ConnectedPeer } from '../types';
import { db, createDefaultCase, getSavedViewerPin, saveViewerPin, clearSavedViewerPin } from '../db';
import { getDemoCaseData } from '../data/demoCase';
import { syncSession } from '../sync/syncSession';
import { generatePin } from '../sync/crypto';

interface CaseContextValue {
  cases: Case[];
  activeCase: Case | null;
  jurors: Juror[];
  questions: Question[];
  causeChallenges: CauseChallenge[];
  peremptoryStrikes: PeremptoryStrikeAction[];
  
  // Selection and UI state
  selectedJurorId: string | null;
  setSelectedJurorId: (id: string | null) => void;
  activeQuestionId: string | null;
  setActiveQuestionId: (id: string | null) => void;
  lastSelectedQuestionId: string | null;
  toggleQuestionLogger: () => void;
  
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  statusFilter: string;
  setStatusFilter: (filter: string) => void;

  // View mode
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Real-time E2EE Sync & Pairing
  syncStatus: SyncStatus;
  syncRole: SyncRole;
  syncPin: string | null;
  syncAttempts: { current: number; max: number };
  syncLatency: number | null;
  connectedPeers: ConnectedPeer[];
  sessionEndedPrompt: boolean;
  startHostingSync: () => Promise<string>;
  joinSyncSession: (pin: string, requestedRole?: 'second_chair' | 'podium') => Promise<void>;
  changeSyncRole: (newRole: 'second_chair' | 'podium') => Promise<void>;
  resolveSessionEnded: (keepLocalCopy: boolean) => Promise<void>;
  burnSyncRoom: () => void;
  disconnectSync: () => void;

  // Real-time Whispers (Prompter cues)
  whispers: WhisperMessage[];
  activeWhisper: WhisperMessage | null;
  sendWhisper: (text: string, priority?: 'normal' | 'urgent') => Promise<WhisperMessage | undefined>;
  dismissWhisper: (messageId: string) => void;

  // Case operations
  switchCase: (caseId: string) => Promise<void>;
  createNewCase: (type: 'civil' | 'criminal', customName?: string) => Promise<Case>;
  updateActiveCase: (updates: Partial<Case>) => Promise<void>;
  deleteCase: (caseId: string) => Promise<void>;

  // Juror operations
  addJurors: (newJurors: Juror[]) => Promise<void>;
  updateJuror: (jurorId: string, updates: Partial<Juror>) => Promise<void>;
  deleteJuror: (jurorId: string) => Promise<void>;
  assignSeat: (jurorId: string, seatNumber: number, isAlternate?: boolean) => Promise<void>;
  unseatJuror: (jurorId: string) => Promise<void>;
  setJurorRating: (jurorId: string, rating: number) => Promise<void>;

  // Question operations
  addQuestion: (text: string, category?: string) => Promise<Question>;
  updateQuestion: (questionId: string, updates: Partial<Question>) => Promise<void>;
  deleteQuestion: (questionId: string) => Promise<void>;
  toggleJurorResponse: (jurorId: string, questionId: string) => Promise<void>;

  // Strike operations
  recordPeremptoryStrike: (jurorId: string, side: 'plaintiff_prosecution' | 'defense', notes?: string) => Promise<void>;
  recordCauseChallenge: (jurorId: string, grounds: string, ruling: 'pending' | 'granted' | 'denied', comment?: string) => Promise<void>;
  revertStrike: (jurorId: string) => Promise<void>;

  // Undo / Redo
  canUndo: boolean;
  canRedo: boolean;
  undo: () => Promise<void>;
  redo: () => Promise<void>;

  // Prospective Panel Auto-Fill & Refill
  prefillSequentialPanel: (enableAutoFill?: boolean) => Promise<void>;
  clearPanel: () => Promise<void>;
  toggleAutoFillPanel: () => Promise<void>;

  // Gallery Dragging & Reordering
  reorderGalleryJurors: (sourceJurorId: string, targetJurorId: string) => Promise<void>;
  moveJurorToGallerySpot: (sourceJurorId: string, targetIndex: number) => Promise<void>;
  updateAisleSplits: (splits: number[]) => Promise<void>;

  // Backup & Import
  restoreFromBackup: (backupData: any) => Promise<void>;
  loadDemoCase: () => Promise<void>;
  refreshData: () => Promise<void>;

  lastSyncActivity: number;
}

const CaseContext = createContext<CaseContextValue | null>(null);

export const CaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [activeCase, setActiveCase] = useState<Case | null>(null);
  const [jurors, setJurors] = useState<Juror[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [causeChallenges, setCauseChallenges] = useState<CauseChallenge[]>([]);
  const [peremptoryStrikes, setPeremptoryStrikes] = useState<PeremptoryStrikeAction[]>([]);
  
  const [selectedJurorId, setSelectedJurorId] = useState<string | null>(null);
  const [activeQuestionId, setActiveQuestionIdState] = useState<string | null>(null);
  const [lastSelectedQuestionId, setLastSelectedQuestionId] = useState<string | null>(null);

  const setActiveQuestionId = (id: string | null) => {
    setActiveQuestionIdState(id);
    if (id && id !== 'new') {
      setLastSelectedQuestionId(id);
    }
  };

  const toggleQuestionLogger = () => {
    if (activeQuestionId) {
      setActiveQuestionIdState(null);
    } else {
      if (lastSelectedQuestionId && questions.some(q => q.id === lastSelectedQuestionId)) {
        setActiveQuestionIdState(lastSelectedQuestionId);
      } else if (questions.length > 0) {
        setActiveQuestionIdState(questions[0].id);
      } else {
        setActiveQuestionIdState('new');
      }
    }
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // View Mode & E2EE Sync State
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      if (typeof window !== 'undefined' && localStorage.getItem('empanel_viewer_pin')) {
        return 'podium';
      }
    } catch (e) {}
    return 'table';
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncRole, setSyncRole] = useState<SyncRole>(() => {
    try {
      if (typeof window !== 'undefined' && localStorage.getItem('empanel_viewer_pin')) {
        return 'second_chair';
      }
    } catch (e) {}
    return null;
  });
  const [syncPin, setSyncPin] = useState<string | null>(null);
  const [syncAttempts, setSyncAttempts] = useState<{ current: number; max: number }>({ current: 0, max: 3 });
  const [syncLatency, setSyncLatency] = useState<number | null>(null);
  const [connectedPeers, setConnectedPeers] = useState<ConnectedPeer[]>([]);
  const [sessionEndedPrompt, setSessionEndedPrompt] = useState(false);
  const priorCaseIdRef = useRef<string | null>(null);
  const [whispers, setWhispers] = useState<WhisperMessage[]>([]);
  const [activeWhisper, setActiveWhisper] = useState<WhisperMessage | null>(null);
  const [lastSyncActivity, setLastSyncActivity] = useState<number>(0);

  const activeCaseRef = useRef(activeCase);
  activeCaseRef.current = activeCase;
  const jurorsRef = useRef(jurors);
  jurorsRef.current = jurors;
  const questionsRef = useRef(questions);
  questionsRef.current = questions;
  const causeChallengesRef = useRef(causeChallenges);
  causeChallengesRef.current = causeChallenges;
  const peremptoryStrikesRef = useRef(peremptoryStrikes);
  peremptoryStrikesRef.current = peremptoryStrikes;

  // History for Undo / Redo
  const [undoStack, setUndoStack] = useState<{
    jurors: Juror[];
    peremptoryStrikes: PeremptoryStrikeAction[];
    causeChallenges: CauseChallenge[];
  }[]>([]);
  const [redoStack, setRedoStack] = useState<{
    jurors: Juror[];
    peremptoryStrikes: PeremptoryStrikeAction[];
    causeChallenges: CauseChallenge[];
  }[]>([]);

  const pushSnapshot = () => {
    setUndoStack(prev => [
      ...prev.slice(-35),
      {
        jurors: JSON.parse(JSON.stringify(jurors)),
        peremptoryStrikes: JSON.parse(JSON.stringify(peremptoryStrikes)),
        causeChallenges: JSON.parse(JSON.stringify(causeChallenges)),
      }
    ]);
    setRedoStack([]);
  };

  const refreshData = async () => {
    const allCases = await db.cases.orderBy('updatedAt').reverse().toArray();
    setCases(allCases);

    let currentCase = activeCase;
    if (!currentCase && allCases.length > 0) {
      currentCase = allCases[0];
      setActiveCase(currentCase);
    } else if (allCases.length === 0) {
      const def = await createDefaultCase('criminal');
      setCases([def]);
      currentCase = def;
      setActiveCase(def);
    }

    if (currentCase) {
      const [caseJurors, caseQuestions, caseCauses, caseStrikes] = await Promise.all([
        db.jurors.where('caseId').equals(currentCase.id).toArray(),
        db.questions.where('caseId').equals(currentCase.id).sortBy('order'),
        db.causeChallenges.where('caseId').equals(currentCase.id).reverse().sortBy('timestamp'),
        db.peremptoryStrikes.where('caseId').equals(currentCase.id).reverse().sortBy('timestamp'),
      ]);

      setJurors(caseJurors);
      setQuestions(caseQuestions);
      setCauseChallenges(caseCauses);
      setPeremptoryStrikes(caseStrikes);
    }
  };

  useEffect(() => {
    refreshData();

    // Auto-reconnect viewer session if a PIN is stored in IndexedDB / localStorage
    getSavedViewerPin().then(savedPin => {
      if (savedPin) {
        joinSyncSession(savedPin).catch(err => {
          console.warn('Failed to auto-reconnect viewer session:', err);
        });
      }
    });
  }, []);

  // Listen for real-time E2EE sync events from peer (Podium or Second Chair)
  useEffect(() => {
    syncSession.setEvents({
      onStatusChange: (status) => {
        setSyncStatus(status);
        if (status === 'connected_p2p' || status === 'connected_relay') {
          if (syncSession.getRole() === 'host') {
            // Broadcast initial state snapshot to the newly paired viewer
            syncSession.sendMutation({
              type: 'SNAPSHOT',
              payload: {
                activeCase: activeCaseRef.current,
                jurors: jurorsRef.current,
                questions: questionsRef.current,
                causeChallenges: causeChallengesRef.current,
                peremptoryStrikes: peremptoryStrikesRef.current,
              },
            });
          }
        }
      },
      onPeerJoined: () => {
        if (syncSession.getRole() === 'host') {
          // Re-broadcast state snapshot when additional peers join
          syncSession.sendMutation({
            type: 'SNAPSHOT',
            payload: {
              activeCase: activeCaseRef.current,
              jurors: jurorsRef.current,
              questions: questionsRef.current,
              causeChallenges: causeChallengesRef.current,
              peremptoryStrikes: peremptoryStrikesRef.current,
            },
          });
        }
      },
      onAttemptChange: (current, max) => {
        setSyncAttempts({ current, max });
      },
      onPeersChange: (peers) => {
        setConnectedPeers(peers);
      },
      onHostDisconnected: () => {
        setSessionEndedPrompt(true);
      },
      onLatencyUpdate: (latencyMs) => {
        setSyncLatency(latencyMs);
      },
      onWhisperReceived: (whisper) => {
        setWhispers(prev => [whisper, ...prev]);
        setActiveWhisper(whisper);
      },
      onMutationReceived: async (mutation) => {
        setLastSyncActivity(Date.now());
        switch (mutation.type) {
          case 'SNAPSHOT':
            if (mutation.payload.activeCase) {
              setActiveCase(mutation.payload.activeCase);
              db.cases.put(mutation.payload.activeCase).catch(() => {});
            }
            if (mutation.payload.jurors) {
              setJurors(mutation.payload.jurors);
              db.jurors.bulkPut(mutation.payload.jurors).catch(() => {});
            }
            if (mutation.payload.questions) {
              setQuestions(mutation.payload.questions);
              db.questions.bulkPut(mutation.payload.questions).catch(() => {});
            }
            if (mutation.payload.causeChallenges) {
              setCauseChallenges(mutation.payload.causeChallenges);
              db.causeChallenges.bulkPut(mutation.payload.causeChallenges).catch(() => {});
            }
            if (mutation.payload.peremptoryStrikes) {
              setPeremptoryStrikes(mutation.payload.peremptoryStrikes);
              db.peremptoryStrikes.bulkPut(mutation.payload.peremptoryStrikes).catch(() => {});
            }
            break;

          case 'REQUEST_SNAPSHOT':
            if (syncSession.getRole() === 'host') {
              syncSession.sendMutation({
                type: 'SNAPSHOT',
                payload: {
                  activeCase: activeCaseRef.current,
                  jurors: jurorsRef.current,
                  questions: questionsRef.current,
                  causeChallenges: causeChallengesRef.current,
                  peremptoryStrikes: peremptoryStrikesRef.current,
                },
              });
            }
            break;

          case 'BATCH_JUROR_UPDATE':
            setJurors(prev => {
              const map = new Map(mutation.jurors.map((u: any) => [u.id, u]));
              return prev.map(j => map.get(j.id) || j);
            });
            db.jurors.bulkPut(mutation.jurors).catch(() => {});
            break;

          case 'UPDATE_JUROR':
            setJurors(prev => {
              const updated = prev.map(j => (j.id === mutation.jurorId ? { ...j, ...mutation.updates, updatedAt: Date.now() } : j));
              const juror = updated.find(j => j.id === mutation.jurorId);
              if (juror) db.jurors.put(juror).catch(() => {});
              return updated;
            });
            break;

          case 'DELETE_JUROR': {
            const { jurorId } = mutation;
            db.jurors.delete(jurorId).catch(() => {});
            setJurors(prev => prev.filter(j => j.id !== jurorId));
            if (selectedJurorId === jurorId) {
              setSelectedJurorId(null);
            }
            setActiveCase(prev => {
              if (!prev || !prev.galleryOrder?.includes(jurorId)) return prev;
              const updatedOrder = prev.galleryOrder.map(id => id === jurorId ? null : id);
              const updated = { ...prev, galleryOrder: updatedOrder, updatedAt: Date.now() };
              db.cases.put(updated).catch(() => {});
              return updated;
            });
            db.peremptoryStrikes.where('jurorId').equals(jurorId).delete().catch(() => {});
            db.causeChallenges.where('jurorId').equals(jurorId).delete().catch(() => {});
            setPeremptoryStrikes(prev => prev.filter(s => s.jurorId !== jurorId));
            setCauseChallenges(prev => prev.filter(c => c.jurorId !== jurorId));
            break;
          }

          case 'UPDATE_CASE':
            setActiveCase(prev => {
              if (!prev) return null;
              const updated = { ...prev, ...mutation.updates, updatedAt: Date.now() };
              db.cases.put(updated).catch(() => {});
              return updated;
            });
            break;

          case 'TOGGLE_RESPONSE':
            setJurors(prev => {
              const updated = prev.map(j => {
                if (j.id !== mutation.jurorId) return j;
                const existing = j.responses?.[mutation.questionId]?.answeredYes;
                const existingNote = j.responses?.[mutation.questionId]?.note;
                return {
                  ...j,
                  responses: {
                    ...(j.responses || {}),
                    [mutation.questionId]: {
                      answeredYes: !existing,
                      note: existingNote,
                    },
                  },
                };
              });
              const juror = updated.find(j => j.id === mutation.jurorId);
              if (juror) db.jurors.put(juror).catch(() => {});
              return updated;
            });
            break;

          case 'ASSIGN_SEAT':
            setJurors(prev => {
              const updated = prev.map(j => {
                if (j.id === mutation.jurorId) {
                  return {
                    ...j,
                    seatNumber: mutation.seatNumber,
                    isAlternate: mutation.isAlternate,
                    status: mutation.isAlternate ? ('alternate' as const) : ('seated' as const),
                  };
                }
                return j;
              });
              const juror = updated.find(j => j.id === mutation.jurorId);
              if (juror) db.jurors.put(juror).catch(() => {});
              return updated;
            });
            break;

          case 'UNSEAT_JUROR':
            setJurors(prev => {
              const updated = prev.map(j => {
                if (j.id === mutation.jurorId) {
                  return {
                    ...j,
                    seatNumber: undefined,
                    isAlternate: false,
                    status: j.status === 'seated' || j.status === 'alternate' ? ('active' as const) : j.status,
                  };
                }
                return j;
              });
              const juror = updated.find(j => j.id === mutation.jurorId);
              if (juror) db.jurors.put(juror).catch(() => {});
              return updated;
            });
            break;

          case 'RECORD_STRIKE':
            setPeremptoryStrikes(prev => [mutation.strike, ...prev]);
            db.peremptoryStrikes.put(mutation.strike).catch(() => {});
            setJurors(prev => {
              const updated = prev.map(j =>
                j.id === mutation.strike.jurorId
                  ? {
                      ...j,
                      status:
                        mutation.strike.side === 'plaintiff_prosecution'
                          ? ('struck_plaintiff' as const)
                          : ('struck_defense' as const),
                      seatNumber: undefined,
                      isAlternate: false,
                    }
                  : j
              );
              const juror = updated.find(j => j.id === mutation.strike.jurorId);
              if (juror) db.jurors.put(juror).catch(() => {});
              return updated;
            });
            break;

          case 'RECORD_CAUSE':
            setCauseChallenges(prev => [mutation.challenge, ...prev]);
            db.causeChallenges.put(mutation.challenge).catch(() => {});
            if (mutation.challenge.ruling === 'granted') {
              setJurors(prev => {
                const updated = prev.map(j =>
                  j.id === mutation.challenge.jurorId
                    ? { ...j, status: 'cause_granted' as const, seatNumber: undefined, isAlternate: false }
                    : j
                );
                const juror = updated.find(j => j.id === mutation.challenge.jurorId);
                if (juror) db.jurors.put(juror).catch(() => {});
                return updated;
              });
            }
            break;

          case 'REVERT_STRIKE':
            setPeremptoryStrikes(prev => prev.filter(s => s.jurorId !== mutation.jurorId));
            setCauseChallenges(prev => prev.filter(c => c.jurorId !== mutation.jurorId));
            db.peremptoryStrikes.where('jurorId').equals(mutation.jurorId).delete().catch(() => {});
            db.causeChallenges.where('jurorId').equals(mutation.jurorId).delete().catch(() => {});
            setJurors(prev => {
              const updated = prev.map(j => {
                if (j.id === mutation.jurorId) {
                  return {
                    ...j,
                    status: j.seatNumber !== undefined ? (j.isAlternate ? ('alternate' as const) : ('seated' as const)) : ('active' as const),
                  };
                }
                return j;
              });
              const juror = updated.find(j => j.id === mutation.jurorId);
              if (juror) db.jurors.put(juror).catch(() => {});
              return updated;
            });
            break;

          case 'DISMISS_WHISPER':
            setActiveWhisper(prev => (prev?.id === mutation.messageId ? null : prev));
            setWhispers(prev =>
              prev.map(w => (w.id === mutation.messageId ? { ...w, dismissed: true } : w))
            );
            break;
        }
      },
    });
  }, []);

  const switchCase = async (caseId: string) => {
    const target = await db.cases.get(caseId);
    if (target) {
      setActiveCase(target);
      setSelectedJurorId(null);
      setActiveQuestionId(null);
      const [caseJurors, caseQuestions, caseCauses, caseStrikes] = await Promise.all([
        db.jurors.where('caseId').equals(target.id).toArray(),
        db.questions.where('caseId').equals(target.id).sortBy('order'),
        db.causeChallenges.where('caseId').equals(target.id).reverse().sortBy('timestamp'),
        db.peremptoryStrikes.where('caseId').equals(target.id).reverse().sortBy('timestamp'),
      ]);
      setJurors(caseJurors);
      setQuestions(caseQuestions);
      setCauseChallenges(caseCauses);
      setPeremptoryStrikes(caseStrikes);
    }
  };

  const createNewCase = async (type: 'civil' | 'criminal', customName?: string) => {
    const newCase = await createDefaultCase(type);
    if (customName) {
      newCase.name = customName;
      await db.cases.put(newCase);
    }
    await refreshData();
    await switchCase(newCase.id);
    return newCase;
  };

  const updateActiveCase = async (updates: Partial<Case>) => {
    if (!activeCase) return;
    const updated = { ...activeCase, ...updates, updatedAt: Date.now() };
    await db.cases.put(updated);
    setActiveCase(updated);
    setCases(prev => prev.map(c => c.id === updated.id ? updated : c));
    syncSession.sendMutation({ type: 'UPDATE_CASE', updates });
  };

  const deleteCase = async (caseId: string) => {
    await Promise.all([
      db.cases.delete(caseId),
      db.jurors.where('caseId').equals(caseId).delete(),
      db.questions.where('caseId').equals(caseId).delete(),
      db.causeChallenges.where('caseId').equals(caseId).delete(),
      db.peremptoryStrikes.where('caseId').equals(caseId).delete(),
    ]);
    const remaining = cases.filter(c => c.id !== caseId);
    setCases(remaining);
    if (remaining.length > 0) {
      await switchCase(remaining[0].id);
    } else {
      const def = await createDefaultCase('criminal');
      setCases([def]);
      await switchCase(def.id);
    }
  };

  const addJurors = async (newJurors: Juror[]) => {
    if (!activeCase) return;
    await db.jurors.bulkPut(newJurors);
    setJurors(prev => {
      const existingIds = new Set(newJurors.map(j => j.id));
      return [...prev.filter(j => !existingIds.has(j.id)), ...newJurors];
    });
  };

  const updateJuror = async (jurorId: string, updates: Partial<Juror>) => {
    const existing = jurors.find(j => j.id === jurorId);
    if (!existing) return;
    const updated: Juror = { ...existing, ...updates, updatedAt: Date.now() };
    await db.jurors.put(updated);
    setJurors(prev => prev.map(j => j.id === jurorId ? updated : j));
    syncSession.sendMutation({ type: 'UPDATE_JUROR', jurorId, updates });
    setLastSyncActivity(Date.now());
  };

  const deleteJuror = async (jurorId: string) => {
    pushSnapshot();
    await db.jurors.delete(jurorId).catch(() => {});
    setJurors(prev => prev.filter(j => j.id !== jurorId));
    if (selectedJurorId === jurorId) {
      setSelectedJurorId(null);
    }
    // Clean up galleryOrder if juror was in it
    if (activeCase?.galleryOrder && activeCase.galleryOrder.includes(jurorId)) {
      const updatedGallery = activeCase.galleryOrder.map(id => id === jurorId ? null : id);
      await updateActiveCase({ galleryOrder: updatedGallery });
    }
    await db.peremptoryStrikes.where('jurorId').equals(jurorId).delete().catch(() => {});
    await db.causeChallenges.where('jurorId').equals(jurorId).delete().catch(() => {});
    setPeremptoryStrikes(prev => prev.filter(s => s.jurorId !== jurorId));
    setCauseChallenges(prev => prev.filter(c => c.jurorId !== jurorId));

    syncSession.sendMutation({ type: 'DELETE_JUROR', jurorId });
    setLastSyncActivity(Date.now());
  };

  const assignSeat = async (jurorId: string, seatNumber: number, isAlternate = false) => {
    pushSnapshot();
    // If another juror occupies this seat, swap or unseat
    const occupant = jurors.find(j => j.seatNumber === seatNumber && j.isAlternate === isAlternate);
    const target = jurors.find(j => j.id === jurorId);
    if (!target) return;

    const oldSeat = target.seatNumber;
    const oldAlt = target.isAlternate;

    const toUpdate: Juror[] = [];

    if (occupant && occupant.id !== target.id) {
      // Swap seats if target had a seat, or unseat occupant
      if (oldSeat !== undefined) {
        toUpdate.push({
          ...occupant,
          seatNumber: oldSeat,
          isAlternate: oldAlt,
          updatedAt: Date.now()
        });
      } else {
        toUpdate.push({
          ...occupant,
          seatNumber: undefined,
          isAlternate: false,
          status: occupant.status === 'seated' || occupant.status === 'alternate' ? 'active' : occupant.status,
          updatedAt: Date.now()
        });
      }
    }

    toUpdate.push({
      ...target,
      seatNumber,
      isAlternate,
      status: isAlternate ? 'alternate' : 'seated',
      updatedAt: Date.now()
    });

    await db.jurors.bulkPut(toUpdate);
    setJurors(prev => {
      const map = new Map(toUpdate.map(u => [u.id, u]));
      return prev.map(j => map.get(j.id) || j);
    });
    syncSession.sendMutation({ type: 'ASSIGN_SEAT', jurorId, seatNumber, isAlternate });
  };

  const unseatJuror = async (jurorId: string) => {
    pushSnapshot();
    const juror = jurors.find(j => j.id === jurorId);
    if (!juror) return;
    const oldSeatNumber = juror.seatNumber;
    const oldIsAlternate = juror.isAlternate;

    const updated: Juror = {
      ...juror,
      seatNumber: undefined,
      isAlternate: false,
      status: juror.status === 'seated' || juror.status === 'alternate' ? 'active' : juror.status,
      updatedAt: Date.now()
    };

    if (activeCase?.autoFillPanel && oldSeatNumber !== undefined) {
      await shiftAndPullReplacement(oldSeatNumber, jurorId, oldIsAlternate, updated);
    } else {
      await db.jurors.put(updated);
      setJurors(prev => prev.map(j => j.id === jurorId ? updated : j));
    }
    syncSession.sendMutation({ type: 'UNSEAT_JUROR', jurorId });
  };

  const setJurorRating = async (jurorId: string, rating: number) => {
    pushSnapshot();
    await updateJuror(jurorId, { rating });
  };

  const addQuestion = async (text: string, category = 'General') => {
    if (!activeCase) throw new Error('No active case');
    const newQ: Question = {
      id: `q-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      caseId: activeCase.id,
      text,
      category,
      order: questions.length + 1,
      createdAt: Date.now(),
    };
    await db.questions.add(newQ);
    setQuestions(prev => [...prev, newQ]);
    return newQ;
  };

  const updateQuestion = async (questionId: string, updates: Partial<Question>) => {
    const existing = questions.find(q => q.id === questionId);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    await db.questions.put(updated);
    setQuestions(prev => prev.map(q => q.id === questionId ? updated : q));
  };

  const deleteQuestion = async (questionId: string) => {
    await db.questions.delete(questionId);
    setQuestions(prev => prev.filter(q => q.id !== questionId));
    if (activeQuestionId === questionId) {
      setActiveQuestionId(null);
    }
  };

  const toggleJurorResponse = async (jurorId: string, questionId: string) => {
    const juror = jurors.find(j => j.id === jurorId);
    if (!juror) return;
    
    const existing = juror.responses?.[questionId]?.answeredYes;
    const existingNote = juror.responses?.[questionId]?.note;
    const newResponses = {
      ...(juror.responses || {}),
      [questionId]: {
        answeredYes: !existing,
        note: existingNote,
      }
    };
    
    await updateJuror(jurorId, { responses: newResponses });
    syncSession.sendMutation({ type: 'TOGGLE_RESPONSE', jurorId, questionId });
  };

  const recordPeremptoryStrike = async (
    jurorId: string,
    side: 'plaintiff_prosecution' | 'defense',
    notes?: string
  ) => {
    if (!activeCase) return;
    const juror = jurors.find(j => j.id === jurorId);
    if (!juror) return;

    pushSnapshot();

    const oldSeatNumber = juror.seatNumber;
    const oldIsAlternate = juror.isAlternate;

    // Calculate round for this side (supports supplemental / extra strikes granted by court)
    const priorStrikesForSide = peremptoryStrikes.filter(s => s.side === side).length;
    const round = priorStrikesForSide + 1;

    const strikeAction: PeremptoryStrikeAction = {
      id: `strike-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      caseId: activeCase.id,
      jurorId,
      jurorNumber: juror.jurorNumber,
      jurorName: juror.fullName,
      side,
      round,
      timestamp: Date.now(),
      notes,
    };

    await db.peremptoryStrikes.add(strikeAction);
    setPeremptoryStrikes(prev => [strikeAction, ...prev]);

    // Update juror status and remove from seat
    const newStatus = side === 'plaintiff_prosecution' ? 'struck_plaintiff' : 'struck_defense';
    const struckUpdate: Juror = {
      ...juror,
      status: newStatus,
      statusNotes: `Peremptory Strike Round ${round} (${side === 'plaintiff_prosecution' ? 'Plaintiff/Pros' : 'Defense'})`,
      seatNumber: undefined,
      isAlternate: false,
      updatedAt: Date.now(),
    };

    // If autoFillPanel is enabled and the struck juror occupied a panel/alternate seat:
    if (activeCase.autoFillPanel && oldSeatNumber !== undefined) {
      await shiftAndPullReplacement(oldSeatNumber, jurorId, oldIsAlternate, struckUpdate);
    } else {
      await db.jurors.put(struckUpdate);
      setJurors(prev => prev.map(j => j.id === jurorId ? struckUpdate : j));
    }
    syncSession.sendMutation({ type: 'RECORD_STRIKE', strike: strikeAction });
  };

  const shiftAndPullReplacement = async (
    vacatedSeat: number,
    excludedJurorId: string,
    isAlternateVacated = false,
    primaryUpdate?: Juror
  ) => {
    if (!activeCase) return;
    const boxSize = activeCase.boxSize || 6;
    const alternateCount = activeCase.alternateCount || 1;

    const updates: Juror[] = [];
    if (primaryUpdate) {
      updates.push(primaryUpdate);
    }
    const handledIds = new Set<string>([excludedJurorId]);

    // Pool candidate finder helper
    const findPoolCandidate = (): Juror | undefined => {
      return jurors
        .filter(j =>
          !handledIds.has(j.id) &&
          !j.status.startsWith('struck_') &&
          j.status !== 'cause_granted' &&
          j.seatNumber === undefined &&
          !updates.some(u => u.id === j.id)
        )
        .sort((a, b) => {
          const numA = parseInt(a.jurorNumber, 10);
          const numB = parseInt(b.jurorNumber, 10);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return a.jurorNumber.localeCompare(b.jurorNumber);
        })[0];
    };

    if (!isAlternateVacated) {
      // 1. Regular panel jurors seated AFTER the eliminated juror shift over one spot!
      const remainingPanelJurors = jurors
        .filter(j => j.id !== excludedJurorId && j.seatNumber !== undefined && !j.isAlternate)
        .sort((a, b) => (a.seatNumber || 0) - (b.seatNumber || 0));

      remainingPanelJurors.forEach(j => {
        if (j.seatNumber !== undefined && j.seatNumber > vacatedSeat) {
          updates.push({
            ...j,
            seatNumber: j.seatNumber - 1,
            updatedAt: Date.now(),
          });
          handledIds.add(j.id);
        }
      });

      // The open regular panel seat to fill (at the end of the panel)
      const endPanelSeatNumber = Math.min(boxSize, remainingPanelJurors.length + 1);

      // 2. Check if we have seated alternates available to promote into the regular panel
      const seatedAlternates = jurors
        .filter(j => j.id !== excludedJurorId && j.seatNumber !== undefined && j.isAlternate)
        .sort((a, b) => (a.seatNumber || 0) - (b.seatNumber || 0));

      if (seatedAlternates.length > 0) {
        // First alternate promotes into the panel!
        const promotedAlt = seatedAlternates[0];
        updates.push({
          ...promotedAlt,
          seatNumber: endPanelSeatNumber,
          isAlternate: false,
          status: 'seated',
          updatedAt: Date.now(),
        });
        handledIds.add(promotedAlt.id);

        // Remaining alternates (Alt 2, Alt 3, ...) shift down by 1 spot
        for (let i = 1; i < seatedAlternates.length; i++) {
          const alt = seatedAlternates[i];
          updates.push({
            ...alt,
            seatNumber: (alt.seatNumber || (i + 1)) - 1,
            isAlternate: true,
            status: 'alternate',
            updatedAt: Date.now(),
          });
          handledIds.add(alt.id);
        }

        // Fill the vacated alternate seat from the pool
        const openAltSeat = seatedAlternates.length;
        if (openAltSeat <= alternateCount) {
          const candidate = findPoolCandidate();
          if (candidate) {
            updates.push({
              ...candidate,
              seatNumber: openAltSeat,
              isAlternate: true,
              status: 'alternate',
              updatedAt: Date.now(),
            });
            handledIds.add(candidate.id);
          }
        }
      } else {
        // No alternates seated: pull directly from pool into the regular panel
        const candidate = findPoolCandidate();
        if (candidate) {
          updates.push({
            ...candidate,
            seatNumber: endPanelSeatNumber,
            isAlternate: false,
            status: 'seated',
            updatedAt: Date.now(),
          });
          handledIds.add(candidate.id);
        }
      }
    } else {
      // An alternate was struck: shift remaining alternates with seatNumber > vacatedSeat
      const seatedAlternates = jurors
        .filter(j => j.id !== excludedJurorId && j.seatNumber !== undefined && j.isAlternate)
        .sort((a, b) => (a.seatNumber || 0) - (b.seatNumber || 0));

      seatedAlternates.forEach(alt => {
        if (alt.seatNumber !== undefined && alt.seatNumber > vacatedSeat) {
          updates.push({
            ...alt,
            seatNumber: alt.seatNumber - 1,
            updatedAt: Date.now(),
          });
          handledIds.add(alt.id);
        }
      });

      // Fill open alternate seat from the pool
      const openAltSeat = Math.min(alternateCount, seatedAlternates.length + 1);
      const candidate = findPoolCandidate();
      if (candidate) {
        updates.push({
          ...candidate,
          seatNumber: openAltSeat,
          isAlternate: true,
          status: 'alternate',
          updatedAt: Date.now(),
        });
        handledIds.add(candidate.id);
      }
    }

    if (updates.length > 0) {
      await db.jurors.bulkPut(updates);
      setJurors(prev => {
        const updateMap = new Map(updates.map(u => [u.id, u]));
        return prev.map(j => updateMap.get(j.id) || j);
      });
      syncSession.sendMutation({ type: 'BATCH_JUROR_UPDATE', jurors: updates });
    }
  };

  const recordCauseChallenge = async (
    jurorId: string,
    grounds: string,
    ruling: 'pending' | 'granted' | 'denied',
    comment?: string
  ) => {
    if (!activeCase) return;
    const juror = jurors.find(j => j.id === jurorId);
    if (!juror) return;

    pushSnapshot();

    const oldSeatNumber = juror.seatNumber;
    const oldIsAlternate = juror.isAlternate;

    const cause: CauseChallenge = {
      id: `cause-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      caseId: activeCase.id,
      jurorId,
      jurorNumber: juror.jurorNumber,
      jurorName: juror.fullName,
      raisedBy: 'our_side',
      grounds,
      ruling,
      judgeComment: comment,
      timestamp: Date.now(),
    };

    await db.causeChallenges.add(cause);
    setCauseChallenges(prev => [cause, ...prev]);

    let newStatus = juror.status;
    let seatNumber = juror.seatNumber;
    let isAlternate = juror.isAlternate;

    if (ruling === 'granted') {
      newStatus = 'cause_granted';
      seatNumber = undefined;
      isAlternate = false;
    } else if (ruling === 'denied') {
      newStatus = 'cause_denied';
    }

    const causeUpdate: Juror = {
      ...juror,
      status: newStatus,
      statusNotes: `Cause Challenge: ${grounds} (${ruling.toUpperCase()})`,
      seatNumber,
      isAlternate,
      updatedAt: Date.now(),
    };

    // If cause was granted and autoFillPanel is enabled, shift panel jurors and pull replacement at end
    if (ruling === 'granted' && activeCase.autoFillPanel && oldSeatNumber !== undefined) {
      await shiftAndPullReplacement(oldSeatNumber, jurorId, oldIsAlternate, causeUpdate);
    } else {
      await db.jurors.put(causeUpdate);
      setJurors(prev => prev.map(j => j.id === jurorId ? causeUpdate : j));
    }
    syncSession.sendMutation({ type: 'RECORD_CAUSE', challenge: cause });
  };

  const revertStrike = async (jurorId: string) => {
    pushSnapshot();

    // Delete any peremptory strikes or cause challenges for this juror
    await db.peremptoryStrikes.where('jurorId').equals(jurorId).delete();
    await db.causeChallenges.where('jurorId').equals(jurorId).delete();

    setPeremptoryStrikes(prev => prev.filter(s => s.jurorId !== jurorId));
    setCauseChallenges(prev => prev.filter(c => c.jurorId !== jurorId));

    await updateJuror(jurorId, {
      status: 'active',
      statusNotes: undefined,
    });
    syncSession.sendMutation({ type: 'REVERT_STRIKE', jurorId });
  };

  // E2EE Sync Session & Whisper Controls
  const startHostingSync = async (): Promise<string> => {
    const pin = generatePin();
    setSyncPin(pin);
    setSyncRole('host');
    await syncSession.startHosting(pin);
    return pin;
  };

  const joinSyncSession = async (pin: string, requestedRole: 'second_chair' | 'podium' = 'second_chair'): Promise<void> => {
    if (activeCase?.id && !priorCaseIdRef.current) {
      priorCaseIdRef.current = activeCase.id;
    }
    setSyncPin(pin);
    setSyncRole(requestedRole);
    await saveViewerPin(pin);
    await syncSession.joinSession(pin, requestedRole);
    if (requestedRole === 'podium') {
      setViewMode('podium');
    } else {
      setViewMode('table');
    }
  };

  const changeSyncRole = async (newRole: 'second_chair' | 'podium'): Promise<void> => {
    setSyncRole(newRole);
    if (newRole === 'podium') {
      setViewMode('podium');
    } else {
      setViewMode('table');
    }
    await syncSession.setRole(newRole);
  };

  const resolveSessionEnded = async (keepLocalCopy: boolean): Promise<void> => {
    setSessionEndedPrompt(false);
    clearSavedViewerPin().catch(() => {});
    syncSession.cleanup();
    setSyncPin(null);
    setSyncRole(null);
    setConnectedPeers([]);
    setSyncStatus('idle');

    if (!keepLocalCopy && priorCaseIdRef.current) {
      const priorId = priorCaseIdRef.current;
      priorCaseIdRef.current = null;
      await switchCase(priorId);
    } else {
      priorCaseIdRef.current = null;
    }
  };

  const burnSyncRoom = () => {
    // Deprecated alias for disconnectSync
    disconnectSync();
  };

  const disconnectSync = () => {
    clearSavedViewerPin().catch(() => {});
    syncSession.disconnect();
    setSyncPin(null);
    setSyncRole(null);
    setConnectedPeers([]);
    setSyncStatus('idle');
    setViewMode('table');
  };

  const sendWhisper = async (text: string, priority: 'normal' | 'urgent' = 'normal') => {
    const w = await syncSession.sendWhisper(text, priority);
    if (w) {
      setWhispers(prev => [w, ...prev]);
      setActiveWhisper(w);
    }
    return w;
  };

  const dismissWhisper = (messageId: string) => {
    setActiveWhisper(null);
    setWhispers(prev =>
      prev.map(w => (w.id === messageId ? { ...w, dismissed: true } : w))
    );
    syncSession.sendMutation({ type: 'DISMISS_WHISPER', messageId });
  };

  const undo = async () => {
    if (syncRole === 'second_chair' || syncRole === 'podium') return;
    if (undoStack.length === 0 || !activeCase) return;
    const previous = undoStack[undoStack.length - 1];
    const newUndo = undoStack.slice(0, -1);

    const currentSnapshot = {
      jurors: JSON.parse(JSON.stringify(jurors)),
      peremptoryStrikes: JSON.parse(JSON.stringify(peremptoryStrikes)),
      causeChallenges: JSON.parse(JSON.stringify(causeChallenges)),
    };
    setRedoStack(prev => [...prev, currentSnapshot]);
    setUndoStack(newUndo);

    await db.jurors.where('caseId').equals(activeCase.id).delete();
    await db.jurors.bulkPut(previous.jurors);

    await db.peremptoryStrikes.where('caseId').equals(activeCase.id).delete();
    await db.peremptoryStrikes.bulkPut(previous.peremptoryStrikes);

    await db.causeChallenges.where('caseId').equals(activeCase.id).delete();
    await db.causeChallenges.bulkPut(previous.causeChallenges);

    setJurors(previous.jurors);
    setPeremptoryStrikes(previous.peremptoryStrikes);
    setCauseChallenges(previous.causeChallenges);
  };

  const redo = async () => {
    if (syncRole === 'second_chair' || syncRole === 'podium') return;
    if (redoStack.length === 0 || !activeCase) return;
    const next = redoStack[redoStack.length - 1];
    const newRedo = redoStack.slice(0, -1);

    const currentSnapshot = {
      jurors: JSON.parse(JSON.stringify(jurors)),
      peremptoryStrikes: JSON.parse(JSON.stringify(peremptoryStrikes)),
      causeChallenges: JSON.parse(JSON.stringify(causeChallenges)),
    };
    setUndoStack(prev => [...prev, currentSnapshot]);
    setRedoStack(newRedo);

    await db.jurors.where('caseId').equals(activeCase.id).delete();
    await db.jurors.bulkPut(next.jurors);

    await db.peremptoryStrikes.where('caseId').equals(activeCase.id).delete();
    await db.peremptoryStrikes.bulkPut(next.peremptoryStrikes);

    await db.causeChallenges.where('caseId').equals(activeCase.id).delete();
    await db.causeChallenges.bulkPut(next.causeChallenges);

    setJurors(next.jurors);
    setPeremptoryStrikes(next.peremptoryStrikes);
    setCauseChallenges(next.causeChallenges);
  };

  const prefillSequentialPanel = async (enableAutoFill = true) => {
    if (!activeCase) return;
    pushSnapshot();

    const boxSize = activeCase.boxSize || 12;
    const alternateCount = activeCase.alternateCount || 2;

    const available = jurors
      .filter(j => !j.status.startsWith('struck_') && j.status !== 'cause_granted')
      .sort((a, b) => {
        const numA = parseInt(a.jurorNumber, 10);
        const numB = parseInt(b.jurorNumber, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.jurorNumber.localeCompare(b.jurorNumber);
      });

    const updatedJurors = jurors.map(j => {
      const idx = available.findIndex(a => a.id === j.id);
      if (idx !== -1 && idx < boxSize) {
        return {
          ...j,
          seatNumber: idx + 1,
          isAlternate: false,
          status: 'seated' as const,
          updatedAt: Date.now(),
        };
      }
      if (idx >= boxSize && idx < boxSize + alternateCount) {
        return {
          ...j,
          seatNumber: idx - boxSize + 1,
          isAlternate: true,
          status: 'alternate' as const,
          updatedAt: Date.now(),
        };
      }
      return {
        ...j,
        seatNumber: undefined,
        isAlternate: false,
        status: j.status === 'seated' || j.status === 'alternate' ? 'active' as const : j.status,
        updatedAt: Date.now(),
      };
    });

    await db.jurors.bulkPut(updatedJurors);
    setJurors(updatedJurors);
    syncSession.sendMutation({ type: 'BATCH_JUROR_UPDATE', jurors: updatedJurors });

    if (enableAutoFill !== undefined) {
      await updateActiveCase({ autoFillPanel: enableAutoFill });
    }
  };

  const clearPanel = async () => {
    if (!activeCase) return;
    pushSnapshot();

    const updatedJurors = jurors.map(j => {
      if (j.seatNumber !== undefined) {
        return {
          ...j,
          seatNumber: undefined,
          isAlternate: false,
          status: j.status === 'seated' || j.status === 'alternate' ? ('active' as const) : j.status,
          updatedAt: Date.now(),
        };
      }
      return j;
    });

    await db.jurors.bulkPut(updatedJurors);
    setJurors(updatedJurors);
    syncSession.sendMutation({ type: 'BATCH_JUROR_UPDATE', jurors: updatedJurors });
  };

  const toggleAutoFillPanel = async () => {
    if (!activeCase) return;
    const nextVal = !activeCase.autoFillPanel;
    if (nextVal) {
      await prefillSequentialPanel(true);
    } else {
      await updateActiveCase({ autoFillPanel: false });
    }
  };

  const reorderGalleryJurors = async (sourceJurorId: string, targetJurorId: string) => {
    if (!activeCase || sourceJurorId === targetJurorId) return;
    pushSnapshot();

    const sourceJuror = jurors.find(j => j.id === sourceJurorId);
    if (sourceJuror && sourceJuror.seatNumber !== undefined) {
      await unseatJuror(sourceJurorId);
    }

    let order: (string | null)[] = activeCase.galleryOrder ? [...activeCase.galleryOrder] : [];
    if (order.length === 0) {
      const sorted = [...jurors].sort((a, b) => {
        const numA = parseInt(a.jurorNumber, 10);
        const numB = parseInt(b.jurorNumber, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.jurorNumber.localeCompare(b.jurorNumber);
      });
      order = sorted.map(j => j.id);
    }

    if (!order.includes(sourceJurorId)) order.push(sourceJurorId);
    if (!order.includes(targetJurorId)) order.push(targetJurorId);

    const sIdx = order.indexOf(sourceJurorId);
    const tIdx = order.indexOf(targetJurorId);
    if (sIdx !== -1 && tIdx !== -1) {
      const temp = order[sIdx];
      order[sIdx] = order[tIdx];
      order[tIdx] = temp;
      await updateActiveCase({ galleryOrder: order });
    }
  };

  const moveJurorToGallerySpot = async (sourceJurorId: string, targetIndex: number) => {
    if (!activeCase || targetIndex < 0) return;
    pushSnapshot();

    const sourceJuror = jurors.find(j => j.id === sourceJurorId);
    if (sourceJuror && sourceJuror.seatNumber !== undefined) {
      await unseatJuror(sourceJurorId);
    }

    const sorted = [...jurors].sort((a, b) => {
      const numA = parseInt(a.jurorNumber, 10);
      const numB = parseInt(b.jurorNumber, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.jurorNumber.localeCompare(b.jurorNumber);
    });

    let order: (string | null)[] = activeCase.galleryOrder ? [...activeCase.galleryOrder] : [];
    if (order.length === 0) {
      order = sorted.map(j => j.id);
    }

    while (order.length <= targetIndex) {
      order.push(null);
    }

    const currIdx = order.indexOf(sourceJurorId);
    if (currIdx !== -1) {
      order[currIdx] = null;
    }

    order[targetIndex] = sourceJurorId;
    await updateActiveCase({ galleryOrder: order });
  };

  const updateAisleSplits = async (splits: number[]) => {
    if (!activeCase) return;
    await updateActiveCase({ customSplits: splits });
  };

  // Keyboard shortcut listener for Undo / Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && !e.altKey) {
        if (e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
          e.preventDefault();
          redo();
        } else if (!e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
          e.preventDefault();
          undo();
        } else if (!e.shiftKey && (e.key === 'y' || e.key === 'Y')) {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack, jurors, peremptoryStrikes, causeChallenges, activeCase]);

  const restoreFromBackup = async (backupData: any) => {
    if (!backupData || !backupData.caseData) {
      throw new Error('Invalid backup file format');
    }

    const { caseData, jurors: importedJurors, questions: importedQuestions, causeChallenges: importedCauses, peremptoryStrikes: importedStrikes } = backupData;

    await db.cases.put(caseData);
    if (importedJurors?.length) await db.jurors.bulkPut(importedJurors);
    if (importedQuestions?.length) await db.questions.bulkPut(importedQuestions);
    if (importedCauses?.length) await db.causeChallenges.bulkPut(importedCauses);
    if (importedStrikes?.length) await db.peremptoryStrikes.bulkPut(importedStrikes);

    await refreshData();
    await switchCase(caseData.id);
  };

  const loadDemoCase = async () => {
    const demo = getDemoCaseData();
    await db.cases.put(demo.caseData);
    await db.jurors.bulkPut(demo.jurors);
    await db.questions.bulkPut(demo.questions);
    await db.causeChallenges.bulkPut(demo.causeChallenges);
    await db.peremptoryStrikes.bulkPut(demo.peremptoryStrikes);

    await refreshData();
    await switchCase(demo.caseData.id);
  };

  const value = useMemo(() => ({
    cases,
    activeCase,
    jurors,
    questions,
    causeChallenges,
    peremptoryStrikes,
    selectedJurorId,
    setSelectedJurorId,
    activeQuestionId,
    setActiveQuestionId,
    lastSelectedQuestionId,
    toggleQuestionLogger,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    viewMode,
    setViewMode,
    syncStatus,
    syncRole,
    syncPin,
    syncAttempts,
    syncLatency,
    connectedPeers,
    sessionEndedPrompt,
    startHostingSync,
    joinSyncSession,
    changeSyncRole,
    resolveSessionEnded,
    burnSyncRoom,
    disconnectSync,
    whispers,
    activeWhisper,
    sendWhisper,
    dismissWhisper,
    switchCase,
    createNewCase,
    updateActiveCase,
    deleteCase,
    addJurors,
    updateJuror,
    deleteJuror,
    assignSeat,
    unseatJuror,
    setJurorRating,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    toggleJurorResponse,
    recordPeremptoryStrike,
    recordCauseChallenge,
    revertStrike,
    restoreFromBackup,
    loadDemoCase,
    refreshData,
    canUndo: syncRole !== 'second_chair' && syncRole !== 'podium' && undoStack.length > 0,
    canRedo: syncRole !== 'second_chair' && syncRole !== 'podium' && redoStack.length > 0,
    undo,
    redo,
    prefillSequentialPanel,
    clearPanel,
    toggleAutoFillPanel,
    reorderGalleryJurors,
    moveJurorToGallerySpot,
    updateAisleSplits,
    lastSyncActivity,
  }), [
    cases,
    activeCase,
    jurors,
    questions,
    causeChallenges,
    peremptoryStrikes,
    selectedJurorId,
    activeQuestionId,
    lastSelectedQuestionId,
    searchTerm,
    statusFilter,
    viewMode,
    syncStatus,
    syncRole,
    syncPin,
    syncAttempts,
    syncLatency,
    connectedPeers,
    sessionEndedPrompt,
    whispers,
    activeWhisper,
    undoStack.length,
    redoStack.length,
  ]);

  return <CaseContext.Provider value={value}>{children}</CaseContext.Provider>;
};

export const useCase = () => {
  const context = useContext(CaseContext);
  if (!context) {
    throw new Error('useCase must be used within a CaseProvider');
  }
  return context;
};
