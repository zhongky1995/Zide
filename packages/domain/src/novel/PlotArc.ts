import { ForeshadowMarker } from './ForeshadowMarker';

// 剧情弧状态
export type PlotArcStatus = 'draft' | 'confirmed' | 'in_progress' | 'completed';

// 节拍卡
export interface PlotBeat {
  beatId: string;
  label: string;
  goal: string;
  chapterIds?: string[];
}

// 剧情弧
export interface PlotArc {
  arcId: string;
  projectId: string;
  title: string;
  summary: string;
  goal?: string;
  status: PlotArcStatus;
  chapterIds: string[];
  beats?: PlotBeat[];
  foreshadowMarkers?: ForeshadowMarker[];
  createdAt: string;
  updatedAt: string;
}
