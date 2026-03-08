// 伏笔状态
export type ForeshadowStatus = 'planned' | 'planted' | 'payoff_due' | 'resolved';

// 伏笔标记
export interface ForeshadowMarker {
  foreshadowId: string;
  projectId: string;
  arcId?: string;
  plantedChapterId?: string;
  payoffChapterId?: string;
  summary: string;
  status: ForeshadowStatus;
  createdAt: string;
  updatedAt: string;
}
