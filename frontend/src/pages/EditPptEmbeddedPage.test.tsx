import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditPptEmbeddedPage } from './EditPptEmbeddedPage';
import { apiClient } from '@/api/client';

vi.mock('@/api/client', () => ({ apiClient: { post: vi.fn() } }));
const post = vi.mocked(apiClient.post);
const welcome = { state_token: 'signed-initial', messages: [{ role: 'assistant', content: '您好，请告诉我授课年级、教材和主题。' }], turn: 0, status: 'collecting', summary: '' };
const complete = { state_token: 'signed-final', messages: [...welcome.messages, { role: 'user', content: '小学六年级光的反射' }, { role: 'assistant', content: '需求已确认，正在为您准备课件。' }], turn: 1, status: 'ready', summary: '为小学六年级准备光的反射探究课件。' };
const parameterSnapshot = {
  parameters: [
    { name: '授课对象', value: '六年级', source: 'teacher', group: 'teacher' },
    { name: '授课主题', value: '光的反射', source: 'teacher', group: 'teacher' },
    { name: '教学环节', value: ['实验演示', '知识总结'], source: 'teacher', group: 'teacher' },
    { name: '授课教材', value: '待补充', source: 'missing', group: 'teacher' },
    { name: '教室类型', value: '普通教室', source: 'default', group: 'scene' },
  ],
  supplementary: ['12页，40分钟'],
};
function mount() {
  return render(<MemoryRouter initialEntries={['/edit-ppt']}><Routes>
    <Route path="/edit-ppt" element={<EditPptEmbeddedPage />} />
    <Route path="/" element={<p>项目交接入口</p>} />
  </Routes></MemoryRouter>);
}
beforeEach(() => {
  sessionStorage.clear(); post.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('live teaching requirements', () => {
  it('keeps teacher input and old token after error; only retries on request', async () => {
    post.mockResolvedValueOnce({ data: { data: welcome } });
    post.mockRejectedValueOnce({ response: { data: { error: { message: '模型响应超时，请重试。' } } } });
    post.mockResolvedValueOnce({ data: { data: complete } });
    mount();
    const input = await screen.findByRole('textbox', { name: '您的教学需求' });
    fireEvent.change(input, { target: { value: '小学六年级光的反射' } });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));
    await screen.findByRole('alert');
    expect(input).toHaveValue('小学六年级光的反射');
    expect(post).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: '重试当前步骤' }));
    await screen.findByRole('button', { name: '下一步，查看情境参数' });
    expect(post.mock.calls[1][1]).toEqual(post.mock.calls[2][1]);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('starts fresh and hands off only the current conversation while preserving the selected template', async () => {
    sessionStorage.setItem('ppt-edit-live-teaching-context-v1', JSON.stringify(complete));
    sessionStorage.setItem('edit-ppt-context', JSON.stringify({ context: '旧需求' }));
    sessionStorage.setItem('edit-ppt-template-selection', JSON.stringify({ templateId: 'physics' }));
    post.mockResolvedValueOnce({ data: { data: welcome } });
    post.mockResolvedValueOnce({ data: { data: complete } });
    post.mockResolvedValueOnce({ data: { data: parameterSnapshot } });
    post.mockResolvedValueOnce({ data: { data: { context: { 生成要求: '光的反射课件' }, notes: {} } } });
    mount();
    const input = await screen.findByRole('textbox', { name: '您的教学需求' });
    expect(input).toHaveValue('');
    expect(screen.queryByText(complete.messages[1].content)).not.toBeInTheDocument();
    expect(sessionStorage.getItem('ppt-edit-live-teaching-context-v1')).toBeNull();
    expect(sessionStorage.getItem('edit-ppt-context')).toBeNull();
    expect(post).toHaveBeenNthCalledWith(1, '/api/teaching-context/chat', {});
    fireEvent.change(input, { target: { value: '小学六年级光的反射' } });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));
    await screen.findByRole('button', { name: '下一步，查看情境参数' });
    fireEvent.click(screen.getByRole('button', { name: '下一步，查看情境参数' }));
    const frame = await screen.findByTitle('情境参数抽取与教学思维链') as HTMLIFrameElement;
    expect(frame).toHaveAttribute('src', '/edit-ppt/main.html?view=live-workflow');
    fireEvent(window, new MessageEvent('message', {
      origin: 'https://unrelated.example',
      source: frame.contentWindow,
      data: { type: 'ppt-workflow:apply' },
    }));
    expect(post).toHaveBeenCalledTimes(3);
    fireEvent(window, new MessageEvent('message', {
      origin: window.location.origin,
      source: frame.contentWindow,
      data: { type: 'ppt-workflow:apply' },
    }));
    await screen.findByText('项目交接入口');
    expect(JSON.parse(sessionStorage.getItem('edit-ppt-template-selection')!)).toEqual({ templateId: 'physics' });
    expect(JSON.parse(sessionStorage.getItem('edit-ppt-context')!).context.生成要求).toContain('光的反射');
    expect(post).toHaveBeenCalledWith('/api/teaching-context/handoff', { state_token: 'signed-final' });
  });

  it('requires new input when the page is unmounted and opened again', async () => {
    post.mockResolvedValueOnce({ data: { data: welcome } });
    post.mockResolvedValueOnce({ data: { data: complete } });
    post.mockResolvedValueOnce({ data: { data: welcome } });
    const view = mount();
    const input = await screen.findByRole('textbox', { name: '您的教学需求' });
    fireEvent.change(input, { target: { value: '小学六年级光的反射' } });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));
    await screen.findByRole('button', { name: '下一步，查看情境参数' });
    expect(sessionStorage.getItem('ppt-edit-live-teaching-context-v1')).toBeNull();
    view.unmount();
    mount();
    expect(await screen.findByRole('textbox', { name: '您的教学需求' })).toHaveValue('');
    expect(screen.queryByRole('button', { name: '下一步，查看情境参数' })).not.toBeInTheDocument();
    expect(post).toHaveBeenNthCalledWith(3, '/api/teaching-context/chat', {});
  });

  it('prevents duplicate sends while a model response is pending', async () => {
    post.mockResolvedValueOnce({ data: { data: welcome } });
    let resolve!: (value: any) => void;
    post.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    mount();
    const input = await screen.findByRole('textbox', { name: '您的教学需求' });
    fireEvent.change(input, { target: { value: '小学六年级光的反射' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(post).toHaveBeenCalledTimes(2);
    resolve({ data: { data: complete } });
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
  });
});
