/**
 * 实时通话（D-232）：断句与打断的纯逻辑。
 */
import { describe, expect, it } from 'vitest';

import { isBargeIn, LIVE, novelSpeech, speakableText, takeSentences, utteranceDone } from '@/lib/call';
import { takeSseEvents } from '@/features/providers';

describe('断句', () => {
  it('有字、字不再变、也没声音满 endMs 才算说完', () => {
    const t0 = 10_000;
    expect(utteranceDone({ text: '', lastTextAt: t0, lastLoudAt: t0, now: t0 + 5000 })).toBe(false);
    expect(utteranceDone({ text: '我今天', lastTextAt: t0, lastLoudAt: t0, now: t0 + LIVE.endMs - 1 })).toBe(false);
    expect(utteranceDone({ text: '我今天', lastTextAt: t0, lastLoudAt: t0 + 500, now: t0 + LIVE.endMs + 100 })).toBe(false);
    expect(utteranceDone({ text: '我今天', lastTextAt: t0, lastLoudAt: t0, now: t0 + LIVE.endMs })).toBe(true);
  });
});

describe('打断', () => {
  const said = '嗯，我刚下班，正好想给你打电话呢。今天过得怎么样？';
  it('麦克风认出来的是 TA 自己这句（回声）不算', () => {
    expect(isBargeIn('我刚下班正好想给你打电话', said, 'zh')).toBe(false);
    expect(novelSpeech('今天过得怎么样', said, 'zh').novel).toBe(0);
  });
  it('她插进来的话里够多不是 TA 这句的字才算', () => {
    expect(isBargeIn('等一下我跟你说', said, 'zh')).toBe(true);
    expect(isBargeIn('等等', said, 'zh')).toBe(false);
  });
  it('英 / 韩按词算', () => {
    const en = 'I just got off work and wanted to call you.';
    expect(isBargeIn('just got off work', en, 'en')).toBe(false);
    expect(isBargeIn('wait hold on a second', en, 'en')).toBe(true);
  });
});

describe('边出字边合成', () => {
  it('暗号与（）描写不念，没闭合的括号先扣着', () => {
    expect(speakableText('好啊。[好奇 20]今天')).toBe('好啊。今天');
    expect(speakableText('好啊。[发红')).toBe('好啊。');
    expect(speakableText('嗯（笑）知道啦')).toBe('嗯知道啦');
  });
  it('只取说完整的句子，太短的并进下一句，游标往后走', () => {
    const a = takeSentences('嗯。我刚下班，正好想你。今天', 0);
    expect(a.sentences).toEqual(['嗯。我刚下班，正好想你。']);
    const b = takeSentences('嗯。我刚下班，正好想你。今天怎么样？', a.next);
    expect(b.sentences).toEqual(['今天怎么样？']);
    expect(takeSentences('Hi there. How was', 0).sentences).toEqual(['Hi there.']);
  });
});

describe('SSE', () => {
  it('取出完整事件，半截留到下一次', () => {
    const { events, rest } = takeSseEvents('event: a\ndata: {"type":"message_start"}\n\nevent: b\ndata: {"type":"content_bl');
    expect(events.map((e) => e.type)).toEqual(['message_start']);
    expect(rest).toBe('event: b\ndata: {"type":"content_bl');
  });
});
