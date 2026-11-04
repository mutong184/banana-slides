/* Connect the original teaching workflow renderer to the live conversation.
 * Layout, parameter graph, extraction panel and lesson animation live in the
 * original main.html bundle. Only its input schema and values are adapted here.
 */
(() => {
  const sourceLabels = {
    teacher: '教师提供',
    inferred: '合理推断',
    default: '默认设置',
    missing: '待补充',
  };
  const fieldKeys = {
    '授课年级': 'grade',
    '授课对象': 'teaching_audience',
    '授课教材': 'textbook_info',
    '授课主题': 'topic',
    '教学环节': 'steps',
    '教学模式': 'model',
    '教学风格': 'teaching_style',
    '模板风格': 'style',
    '多媒体类型': 'resource_design',
    '教学策略': 'teaching_strategy',
    '教学方法': 'teaching_method',
    '课时分配': 'length',
    '教学设备-硬件': 'technology_environment',
    '教室类型': 'classroom_environment',
  };
  const categoryGroups = [
    { name: '教学内容', fields: ['授课年级', '授课对象', '授课教材', '授课主题', '授课阶段', '授课类型'] },
    { name: '教学模式', fields: ['教学环节', '教学模式', '教学风格', '教学策略', '教学方法'] },
    { name: '课件设计', fields: ['模板风格', '色彩主题', '字体字号', '布局排版', '多媒体类型', '辅助工具'] },
    { name: '时空信息', fields: ['课时分配', '教室类型', '教室规模', '教室布局'] },
    { name: '课堂环境', fields: ['教学设备-硬件', '课堂氛围', '师生互动模式'] },
  ];

  function notify(type) {
    window.parent.postMessage({ type }, window.location.origin);
  }

  function createLessonPlan(items, translate) {
    const valueOf = key => {
      const parameter = items.find(item => item.key === key && item.collected);
      const value = String(parameter?.value || '').trim();
      return value && value !== '待补充' ? value : '';
    };
    const topic = valueOf('topic') || '待补充的授课主题';
    const school = valueOf('grade');
    const grade = valueOf('teaching_audience');
    const audience = grade.includes(school) ? grade : `${school}${grade}`;
    const textbook = valueOf('textbook_info') || '待补充的教材';
    const mode = valueOf('model') || '待补充的教学模式';
    const steps = valueOf('steps') || '待补充的教学环节';
    const style = valueOf('teaching_style') || '待补充的教学风格';
    const visualStyle = valueOf('style') || '待补充的模板风格';
    const media = valueOf('resource_design') || '待补充的多媒体形式';
    const tools = valueOf('live-辅助工具');
    const technology = valueOf('technology_environment') || '待补充的教学设备';
    const supplementary = valueOf('supplementary');
    const duration = valueOf('length') || '待补充的课时安排';
    const resources = tools ? `${media}，配合${tools}` : media;
    const learners = audience || '待补充的授课对象';
    const definitions = [
      {
        title: 'lesson_stage_1',
        summary: `围绕「${topic}」，面向「${learners}」，结合教材「${textbook}」中的本课内容，从相关生活现象引入学习。`,
        task: `用与「${topic}」有关的现象或材料引出本课主题。`,
      },
      {
        title: 'lesson_stage_2',
        summary: `结合教师确认的「${steps}」，将「${topic}」中的观察转化为可讨论或验证的问题，明确本课关注的内容。`,
        task: `围绕「${topic}」提出适合「${learners}」的课堂问题。`,
      },
      {
        title: 'lesson_stage_3',
        summary: `依据「${mode}」的课堂组织方式，引导学生对「${topic}」作出预测、说明依据，并设计与本课任务相符的探究或交流方案。`,
        task: `让关于「${topic}」的想法形成可交流、可检查的方案。`,
      },
      {
        title: 'lesson_stage_4',
        summary: `按已确认的「${steps}」及「${duration}」组织与「${topic}」有关的活动，使用「${resources}」，适配「${technology}」，并落实教师提出的操作与安全要求。`,
        task: `按本次课堂安排开展「${topic}」的观察、演示或操作，保留活动记录。`,
      },
      {
        title: 'lesson_stage_5',
        summary: `围绕「${topic}」分析本课观察、操作或讨论所得的记录，用证据回应前面的课堂问题，区分观察事实和解释。`,
        task: `对照「${topic}」的活动记录，检查结论是否得到证据支持。`,
      },
      {
        title: 'lesson_stage_6',
        summary: `归纳「${topic}」的学习收获，结合「${resources}」安排回顾与迁移，采用「${style}」的表达方式和「${visualStyle}」的课件呈现完成课堂收束。`,
        task: `回到「${topic}」的核心问题，总结本课发现并尝试迁移应用。`,
      },
    ];
    return {
      values: { topic, audience: learners },
      phases: definitions.map((phase, index) => ({
        id: `lesson-phase-${index + 1}`,
        topic,
        title: translate(`teaching_flow.${phase.title}`),
        summary: phase.summary,
        description: phase.task,
        thoughts: [
          `本环节围绕「${topic}」，面向「${learners}」，依据「${textbook}」及已确认的「${steps}」安排。${phase.task}${index === 3 && supplementary ? `教师补充要求：${supplementary}` : ''}`,
          `概念核对要点：梳理「${topic}」相关概念及其联系，核对其科学准确性、教材依据及对「${learners}」的适切性。`,
          `教学资源需求：与「${topic}」对应的「${resources}」，适配「${technology}」和「${duration}」，并结合本次教师补充要求。`,
        ],
      })),
    };
  }

  function configureScene(runtime, snapshot, conversation) {
    const parameters = snapshot.parameters.map(parameter => ({
      ...parameter,
      key: fieldKeys[parameter.name] || `live-${parameter.name}`,
      text: Array.isArray(parameter.value) ? parameter.value.join('、') : parameter.value,
    }));
    if (snapshot.supplementary.length) {
      parameters.push({
        key: 'supplementary',
        name: '补充要求',
        text: snapshot.supplementary.join('；'),
        source: 'teacher',
        group: 'teacher',
        evidence: '教师补充说明',
      });
    }
    const scene = runtime.scene;
    scene.params = parameters.map(parameter => ({ key: parameter.key, label: parameter.name }));
    runtime.framework.mapping.slides = Object.fromEntries(parameters.map(parameter => [
      parameter.key, [parameter.group, parameter.name],
    ]));
    runtime.framework.frameworks.slides = parameters.map((parameter, index) => ({
      dimension: parameter.group,
      primary: categoryGroups.find(group => group.fields.includes(parameter.name))?.name || '补充信息',
      label: parameter.name,
      details: [],
      sources: [],
      id: `live-category-${index}`,
      field_keys: [parameter.key],
    }));
    const groups = categoryGroups.map(group => parameters.filter(parameter => group.fields.includes(parameter.name)));
    const unmapped = parameters.filter(parameter => !categoryGroups.some(group => group.fields.includes(parameter.name)));
    if (unmapped.length) groups.push(unmapped);
    scene.script = groups.filter(group => group.length).map(group => ({
      a: '',
      updates: group.map(parameter => ({
        key: parameter.key,
        v: parameter.text,
        evidence: parameter.evidence || sourceLabels[parameter.source],
      })),
    }));
    scene.questions = conversation.messages.filter(message => message.role === 'assistant').map(message => message.content);
    scene.answers = conversation.messages.filter(message => message.role === 'user').map(message => message.content);
  }

  window.PptTeachingWorkflow = {
    createLessonPlan,
    mount(runtime) {
      if (window.parent === window) {
        window.location.replace('/edit-ppt');
        return;
      }
      const { React, jsx, root, Provider, i18n, Page } = runtime;
      let activeSession = '';
      let setPresentationState;

      function LiveWorkflow({ owner, presentationState }) {
        const [status, setStatus] = React.useState(presentationState);
        setPresentationState = setStatus;
        return jsx.jsx(Provider, {
          i18n,
          children: jsx.jsx('main', {
            className: 'standalone-page',
            children: jsx.jsxs(React.Fragment, {
              children: [
                jsx.jsx(Page, {
                  owner,
                  sceneId: 'slides',
                  onChooseScene: () => notify('ppt-workflow:dialogue'),
                  onBackSelection: () => notify('ppt-workflow:dialogue'),
                  onClose: () => notify('ppt-workflow:dialogue'),
                  onApply: () => notify('ppt-workflow:apply'),
                  documentUploads: [],
                  documentParsing: false,
                  templateUploading: false,
                  applying: status.applying,
                  error: status.error || null,
                }),
                status.error ? jsx.jsx('div', {
                  className: 'ppt-teaching-apply',
                  children: jsx.jsx('button', {
                    type: 'button',
                    className: 'is-primary',
                    disabled: status.applying,
                    onClick: () => notify('ppt-workflow:apply'),
                    children: '重试当前步骤',
                  }),
                }) : null,
              ],
            }),
          }),
        });
      }

      window.addEventListener('message', event => {
        if (event.source !== window.parent || event.origin !== window.location.origin) return;
        const data = event.data;
        if (data?.type === 'ppt-workflow:status') {
          setPresentationState?.({ applying: Boolean(data.applying), error: data.error || '' });
          return;
        }
        if (data?.type !== 'ppt-workflow:init' || !Array.isArray(data.snapshot?.parameters)) return;
        if (activeSession === data.sessionId) return;
        activeSession = data.sessionId;
        configureScene(runtime, data.snapshot, data.conversation);
        const owner = `live-teaching-${data.sessionId}`;
        const events = runtime.timeline('slides');
        const contextStart = events.findIndex(event => event.type === 'stage' && event.stage === 'context') + 1;
        runtime.saveState(window.sessionStorage, owner, {
          selectedId: 'slides',
          cursors: {},
          presentations: { slides: contextStart },
        });
        root.render(jsx.jsx(LiveWorkflow, {
          owner,
          presentationState: { applying: Boolean(data.applying), error: data.error || '' },
        }, owner));
      });

      // Return to the live dialogue instead of entering the old demo input loop.
      document.addEventListener('click', event => {
        const button = event.target.closest?.('.ppt-teaching-stages button');
        if (!button) return;
        if (button === document.querySelector('.ppt-teaching-stages button')) {
          event.preventDefault();
          event.stopImmediatePropagation();
          notify('ppt-workflow:dialogue');
        }
      }, true);
      notify('ppt-workflow:ready');
    },
  };
})();
