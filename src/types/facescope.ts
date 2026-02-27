import type { BoundingBox, Emotion } from './emotion';

export type ModelGroup =
  | 'ssdMobilenetv1'
  | 'faceLandmark68'
  | 'faceRecognition'
  | 'faceExpression'
  | 'ageGender';

export type FaceScopeTab = 'monitor' | 'compare' | 'analyze' | 'crop';

export interface FaceComparisonResult {
  distance: number;
  similarity: number;
  isMatch: boolean;
  threshold: number;
}

export interface FaceAnalysisResult {
  box: BoundingBox;
  age: number;
  gender: string;
  genderProbability: number;
  expressions: Record<Emotion, number>;
  dominantExpression: Emotion;
}

export interface CroppedFace {
  id: string;
  dataUrl: string;
  box: BoundingBox;
  score: number;
}
