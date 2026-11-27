import Dexie, { type Table } from 'dexie';
import type { VoiceSession, StressReading } from '../types/audio';
import type { EmotionSession, EmotionReading } from '../types/emotion';

export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code: 'QUOTA_EXCEEDED' | 'TRANSACTION_ABORT' | 'CORRUPTION' | 'UNKNOWN'
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ToneAnalyzerDB extends Dexie {
  sessions!: Table<VoiceSession, number>;
  stressReadings!: Table<StressReading & { sessionId: number }, number>;
  emotionSessions!: Table<EmotionSession, number>;
  emotionReadings!: Table<EmotionReading & { sessionId: number }, number>;

  constructor() {
    super('ToneAnalyzerDB');
    this.version(1).stores({
      sessions: '++id, name, startTime',
      stressReadings: '++id, sessionId, timestamp',
      emotionSessions: '++id, name, startTime',
      emotionReadings: '++id, sessionId, timestamp, faceId',
    });
  }
}

export const db = new ToneAnalyzerDB();

function handleDatabaseError(error: unknown): DatabaseError {
  if (error instanceof DatabaseError) {
    return error;
  }

  const errorMessage = error instanceof Error ? error.message : String(error);

  if (
    errorMessage.includes('QuotaExceededError') ||
    errorMessage.includes('quota')
  ) {
    return new DatabaseError('IndexedDB quota exceeded', 'QUOTA_EXCEEDED');
  }

  if (
    errorMessage.includes('AbortError') ||
    errorMessage.includes('transaction abort')
  ) {
    return new DatabaseError('Transaction aborted', 'TRANSACTION_ABORT');
  }

  if (
    errorMessage.includes('corruption') ||
    errorMessage.includes('corrupted')
  ) {
    return new DatabaseError('Database corruption detected', 'CORRUPTION');
  }

  return new DatabaseError(
    `Database operation failed: ${errorMessage}`,
    'UNKNOWN'
  );
}

export async function saveVoiceSession(session: VoiceSession): Promise<number> {
  try {
    return await db.transaction('rw', db.sessions, db.stressReadings, async () => {
      const id = await db.sessions.add(session);
      if (session.readings.length > 0) {
        await db.stressReadings.bulkAdd(
          session.readings.map((r) => ({ ...r, sessionId: id }))
        );
      }
      return id;
    });
  } catch (error) {
    throw handleDatabaseError(error);
  }
}

export async function getVoiceSessions(): Promise<VoiceSession[]> {
  try {
    return await db.sessions.orderBy('startTime').reverse().toArray();
  } catch (error) {
    throw handleDatabaseError(error);
  }
}

export async function getVoiceSession(id: number): Promise<VoiceSession | undefined> {
  try {
    const session = await db.sessions.get(id);
    if (session) {
      const readings = await db.stressReadings.where('sessionId').equals(id).toArray();
      session.readings = readings;
    }
    return session;
  } catch (error) {
    throw handleDatabaseError(error);
  }
}

export async function saveEmotionSession(session: EmotionSession): Promise<number> {
  try {
    return await db.transaction('rw', db.emotionSessions, db.emotionReadings, async () => {
      const id = await db.emotionSessions.add(session);
      if (session.readings.length > 0) {
        await db.emotionReadings.bulkAdd(
          session.readings.map((r) => ({ ...r, sessionId: id }))
        );
      }
      return id;
    });
  } catch (error) {
    throw handleDatabaseError(error);
  }
}

export async function getEmotionSessions(): Promise<EmotionSession[]> {
  try {
    return await db.emotionSessions.orderBy('startTime').reverse().toArray();
  } catch (error) {
    throw handleDatabaseError(error);
  }
}

export async function getEmotionSession(id: number): Promise<EmotionSession | undefined> {
  try {
    const session = await db.emotionSessions.get(id);
    if (session) {
      const readings = await db.emotionReadings.where('sessionId').equals(id).toArray();
      session.readings = readings;
    }
    return session;
  } catch (error) {
    throw handleDatabaseError(error);
  }
}
