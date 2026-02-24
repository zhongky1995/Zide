// 术语实体
export interface GlossaryTerm {
  id: string;
  projectId: string;
  term: string;             // 术语
  definition: string;      // 定义/解释
  standardExpression?: string; // 标准表达
  aliases?: string[];       // 别名
  category?: string;       // 分类
  notes?: string;          // 备注
  createdAt: string;
  updatedAt: string;
}

// 术语创建参数
export interface CreateGlossaryParams {
  projectId: string;
  term: string;
  definition: string;
  standardExpression?: string;
  aliases?: string[];
  category?: string;
  notes?: string;
}

// 术语更新参数
export interface UpdateGlossaryParams {
  term?: string;
  definition?: string;
  standardExpression?: string;
  aliases?: string[];
  category?: string;
  notes?: string;
}

// 术语冲突检测结果
export interface TermConflict {
  termId: string;
  term: string;
  conflictingTerms: { id: string; expression: string }[];
  severity: 'error' | 'warning';
}

// 术语一致性检查结果
export interface GlossaryCheckResult {
  projectId: string;
  totalTerms: number;
  conflicts: TermConflict[];
  checkedAt: string;
}
