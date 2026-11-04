import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

interface ParameterItem {
  key: string;
  value: string;
  collected: boolean;
}

interface LessonPlan {
  values: { topic: string; audience: string };
  phases: { id: string; title: string; summary: string; description: string; thoughts: string[] }[];
}

const source = readFileSync(resolve('public/edit-ppt/live-workflow.js'), 'utf8');
const sandbox = { window: {} as { PptTeachingWorkflow?: { createLessonPlan: (items: ParameterItem[], translate: (key: string) => string) => LessonPlan } } };
vm.runInNewContext(source, sandbox);
const createLessonPlan = sandbox.window.PptTeachingWorkflow!.createLessonPlan;
const item = (key: string, value: string): ParameterItem => ({ key, value, collected: true });
const textOf = (plan: LessonPlan) => JSON.stringify(plan.phases);

describe('teaching workflow content follows live dialogue parameters', () => {
  it('binds every phase and expanded item to the current topic and grade', () => {
    const plan = createLessonPlan([
      item('topic', '光的反射'), item('grade', '小学'), item('teaching_audience', '六年级'),
      item('textbook_info', '苏教版'), item('steps', '实验演示、知识总结'),
      item('model', '探究式教学'), item('teaching_style', '自然型'),
      item('style', '卡通趣味'), item('resource_design', '文本/图片'),
      item('length', '1课时'), item('supplementary', '12页；40分钟；不使用激光照射眼睛'),
    ], key => key);
    expect(plan.values).toEqual({ topic: '光的反射', audience: '小学六年级' });
    expect(plan.phases).toHaveLength(6);
    for (const phase of plan.phases) {
      expect(phase.summary).toContain('光的反射');
      expect(phase.thoughts.every(thought => thought.includes('光的反射'))).toBe(true);
    }
    expect(textOf(plan)).not.toMatch(/摆长|摆锤|秋千|15 秒|三年级|小车的运动/);
    expect(plan.phases[3].thoughts[0]).toContain('40分钟');
    expect(plan.phases[3].thoughts[0]).toContain('不使用激光照射眼睛');
  });

  it('replaces an earlier topic and never uses teaching strategy as subject content', () => {
    const plan = createLessonPlan([
      item('topic', '小车的运动'), item('grade', '小学'), item('teaching_audience', '三年级'),
      item('teaching_strategy', '支架式教学策略'), item('steps', '实验演示、互动讨论'),
      item('length', '40分钟'), item('resource_design', '视频/模型'),
      item('teaching_style', '理智型'),
    ], key => key);
    expect(plan.values.audience).toBe('小学三年级');
    expect(textOf(plan)).not.toMatch(/光的反射|六年级|支架式教学策略|摆长|摆锤/);
    expect(plan.phases[3].summary).toContain('40分钟');
    expect(plan.phases[5].summary).toContain('理智型');
  });

  it('keeps the confirmed topic when textbook text mentions a different unit', () => {
    const plan = createLessonPlan([
      item('topic', '电路连接'), item('textbook_info', '教材目录包含《物体的运动》'),
      item('grade', '小学'), item('teaching_audience', '六年级'),
    ], key => key);
    expect(plan.values.topic).toBe('电路连接');
    expect(plan.phases[4].summary).toContain('电路连接');
  });

  it('keeps unavailable grade and duration unknown', () => {
    const plan = createLessonPlan([
      item('topic', '浮力与沉浮'), item('grade', '高中'),
      item('teaching_audience', '待补充'), item('length', '待补充'),
    ], key => key);
    expect(plan.values.audience).toBe('高中');
    expect(plan.phases[3].summary).toContain('待补充的课时安排');
    expect(textOf(plan)).not.toContain('40分钟');
  });
});
