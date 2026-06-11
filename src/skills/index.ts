export interface BundledSkill {
  name: string;
  description: string;
  filename: string;
  content: string;
}

export { modelBenchmark } from './bundled/model-benchmark';
export { takoAgent } from './bundled/tako-agent';

import { modelBenchmark } from './bundled/model-benchmark';
import { takoAgent } from './bundled/tako-agent';

export const BUNDLED_SKILLS: BundledSkill[] = [modelBenchmark, takoAgent];
