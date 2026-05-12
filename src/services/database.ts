import Dexie, { type Table } from 'dexie';
import type { VoiceSession, StressReading } from '../types/audio';
import type { EmotionSession, EmotionReading } from '../types/emotion';

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

export async function saveVoiceSession(session: VoiceSession): Promise<number> {
  return db.transaction('rw', db.sessions, db.stressReadings, async () => {
    const id = await db.sessions.add(session);
    if (session.readings.length > 0) {
      await db.stressReadings.bulkAdd(
        session.readings.map((r) => ({ ...r, sessionId: id }))
      );
    }
    return id;
  });
}

export async function getVoiceSessions(): Promise<VoiceSession[]> {
  return db.sessions.orderBy('startTime').reverse().toArray();
}

export async function getVoiceSession(id: number): Promise<VoiceSession | undefined> {
  const session = await db.sessions.get(id);
  if (session) {
    const readings = await db.stressReadings.where('sessionId').equals(id).toArray();
    session.readings = readings;
  }
  return session;
}

export async function saveEmotionSession(session: EmotionSession): Promise<number> {
  return db.transaction('rw', db.emotionSessions, db.emotionReadings, async () => {
    const id = await db.emotionSessions.add(session);
    if (session.readings.length > 0) {
      await db.emotionReadings.bulkAdd(
        session.readings.map((r) => ({ ...r, sessionId: id }))
      );
    }
    return id;
  });
}

export async function getEmotionSessions(): Promise<EmotionSession[]> {
  return db.emotionSessions.orderBy('startTime').reverse().toArray();
}

export async function getEmotionSession(id: number): Promise<EmotionSession | undefined> {
  const session = await db.emotionSessions.get(id);
  if (session) {
    const readings = await db.emotionReadings.where('sessionId').equals(id).toArray();
    session.readings = readings;
  }
  return session;
}
