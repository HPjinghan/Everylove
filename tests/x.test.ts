/**
 * X 改版（D-252）：帖子的样子 / 配图暗号 / 赞随时间涨 / 桌面角标 / 她发帖后 TA 们的评论 prompt / 聊天里的 X 来往。
 */
import { describe, expect, it } from 'vitest';

import '@/features';

import {
  buildCharacterPostUserPrompt,
  buildMyPostCommentsSystem,
  buildMyPostCommentsUser,
  buildPostThreadUser,
  POST_PHOTO_PATTERN,
  xActivityBlock,
} from '@/content/prompts';
import { likesAt, pickPostForm, xNewCount } from '@/lib/posts';
import type { Post } from '@/lib/types';
import { NOW } from './fixtures';

const T = NOW.getTime();
const H = 3_600_000;
const post = (p: Partial<Post>): Post => ({ id: 'p', characterId: 'a', text: '今天的茶泡过头了', at: T, likes: 100, liked: false, comments: [], ...p });

describe('TA 发帖', () => {
  it('帖子的样子：多数是生活切片；没有上一条就不接着说', () => {
    expect(pickPostForm(true, 0.1)).toBe('daily');
    expect(pickPostForm(true, 0.65)).toBe('ask');
    expect(pickPostForm(true, 0.85)).toBe('followup');
    expect(pickPostForm(false, 0.85)).toBe('daily');
  });

  it('配图暗号与样子进用户消息', () => {
    const user = buildCharacterPostUserPrompt(NOW, { form: 'ask', photo: true });
    expect(user).toContain('问关注你的人');
    expect(user).toContain('[配图 你拍了什么]');
    expect('窗外下雨了\n[配图 窗台上的一盆薄荷]'.match(POST_PHOTO_PATTERN)?.[1]).toBe('窗台上的一盆薄荷');
  });

  it('赞随时间涨：刚发三成，一天涨满；她的赞另算；她自己的帖不涨', () => {
    expect(likesAt(post({}), T)).toBe(30);
    expect(likesAt(post({}), T + 24 * H)).toBe(100);
    expect(likesAt(post({ liked: true, likes: 101 }), T + 48 * H)).toBe(101);
    expect(likesAt(post({ mine: true, likes: 0 }), T + H)).toBe(0);
  });
});

describe('桌面角标', () => {
  it('上次打开之后：TA 们的新帖 + 她帖子底下到点的评论；从没打开过不标', () => {
    const posts = [
      post({ id: 'old', at: T - 5 * H }),
      post({ id: 'new', at: T - H }),
      post({ id: 'stranger', characterId: 'b', at: T - H }),
      post({
        id: 'mine',
        mine: true,
        characterId: '',
        at: T - 3 * H,
        comments: [
          { id: 'c1', from: 'other', name: 'A', characterId: 'a', text: '好看', at: T - H },
          { id: 'c2', from: 'other', name: 'A', characterId: 'a', text: '还没到', at: T + H },
        ],
      }),
    ];
    expect(xNewCount(posts, new Set(['a']), T - 2 * H, T)).toBe(2);
    expect(xNewCount(posts, new Set(['a']), undefined, T)).toBe(0);
  });
});

describe('她发帖与回帖', () => {
  it('评论的 prompt：每个人按性子和距离接她的话', () => {
    const sys = buildMyPostCommentsSystem([
      { name: '沈之言', who: '大学中文系讲师，温润', stage: '她对他来说是刚交换联系方式、还在互相了解的人；他叫她「小满」' },
      { name: '江野', who: '电竞选手，嘴硬心软', stage: '她对他来说是常常想起的人；他叫她「笨蛋」' },
    ]);
    expect(sys).toMatchSnapshot();
    expect(buildMyPostCommentsUser('今天终于把稿子交了')).toContain('今天终于把稿子交了');
  });

  it('她自己帖子底下回 TA：线里标出「你」，最后一句是回给 TA 的', () => {
    const user = buildPostThreadUser(
      { text: '今天终于把稿子交了', mine: true, comments: [{ from: 'him', text: '辛苦了' }, { from: 'me', text: '(to 沈之言) 谢谢老师' }] },
      '沈之言'
    );
    expect(user).toContain('Her post');
    expect(user).toContain('沈之言 (you): 辛苦了');
    expect(user).toContain('addressed to you');
  });

  it('聊天里的 X 来往：没有就不出现', () => {
    expect(xActivityBlock([])).toEqual([]);
    expect(xActivityBlock(['She liked your post "茶" (2h ago)'])[0]).toContain('[On X lately]');
  });
});
