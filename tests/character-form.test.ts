/**
 * 分步捏人（D-260）：解析结果落进表单、档案卡按填上的字段列；表单 → 角色；恋爱类型的示例台词三语都有；
 * 试听录音的句子清单（代理只认它）与源码一致。
 */
import { describe, expect, it } from 'vitest';

import { LOVE_STYLES } from '@/content/characters';
import { VOICES } from '@/content/voices';
import { applyParsed, BLANK_FORM, blocked, characterFromForm, heuristicParse } from '@/lib/character-form';
import { hasTranslation, setLang, t } from '@/lib/i18n';
import { SAMPLE_LINES, SAMPLE_VOICES } from '@/supabase/functions/_shared/voice-sample-lines';
import { sampleHash, samplePath } from '@/supabase/functions/_shared/voice-samples';

describe('解析结果落进表单', () => {
  it('合法的字段填上并记下是哪些；不认识的恋爱类型 / MBTI 不填；不在表里的种族进「其他」', () => {
    const { form, filled } = applyParsed(BLANK_FORM, {
      name: '沈之言之言之言之言之言',
      gender: 'female',
      loveStyle: '腹黑',
      mbti: 'infj',
      race: '半人马',
      birthday: '3月14日',
      story: '大学讲师',
    });
    expect(form).toMatchObject({ name: '沈之言之言之言之言之言'.slice(0, 12), gender: 'female', loveStyle: '腹黑', mbti: 'INFJ', race: '其他', raceCustom: '半人马', birthday: '03-14' });
    expect(filled).toEqual(expect.arrayContaining(['name', 'gender', 'loveStyle', 'mbti', 'raceCustom', 'birthday', 'story']));
    const bad = applyParsed(BLANK_FORM, { loveStyle: '不存在', mbti: 'ABCD' });
    expect(bad.filled).toEqual([]);
  });

  it('规则解析：认「标签：内容」，什么都没有就整段进背景故事', () => {
    expect(heuristicParse('名字：江野\n性别：男\n口癖：啧')).toMatchObject({ name: '江野', gender: 'male', catchphrase: '啧' });
    expect(heuristicParse('一个很安静的人')).toEqual({ story: '一个很安静的人' });
  });
});

describe('表单 → 角色', () => {
  it('没有名字给 null；恋爱类型决定原型与标签；自创、成年、主题色都带上', () => {
    expect(characterFromForm(BLANK_FORM, { id: 'x' })).toBeNull();
    const c = characterFromForm({ ...BLANK_FORM, name: '江野', loveStyle: '毒舌竹马', palette: 2 }, { id: 'c1' })!;
    expect(c).toMatchObject({ id: 'c1', name: '江野', loveStyle: '毒舌竹马', custom: true, adultConfirmed: true, color: '#5FB39B' });
    expect(c.tags).toContain('毒舌竹马');
  });

  it('红线拦截看表单里所有她写的字（含贴进来的描述）', () => {
    expect(blocked(BLANK_FORM, '')).toBe(false);
  });
});

describe('恋爱类型卡片与试听', () => {
  it('每种恋爱类型都有一句示例，三本词典都有它', () => {
    for (const s of LOVE_STYLES) {
      expect(s.sample, s.label).toBeTruthy();
      for (const lang of ['en', 'ja', 'ko'] as const) expect(hasTranslation(s.sample, lang), `${lang} ${s.sample}`).toBe(true);
    }
  });

  it('云端路径：模型 / 语言 / 声线 / 句子的哈希', () => {
    expect(samplePath('不急，慢慢说，我听着', 'v1', 'zh', 'm')).toBe(`m/zh/v1/${sampleHash('不急，慢慢说，我听着')}.mp3`);
  });

  it('代理认的句子清单与源码一致（改了示例台词 / 译文 / 音色池要跑 npm run voice-samples 再部署代理）', () => {
    expect(SAMPLE_LINES.zh).toEqual(LOVE_STYLES.map((s) => s.sample));
    try {
      for (const lang of ['en', 'ja', 'ko'] as const) {
        setLang(lang);
        expect(SAMPLE_LINES[lang], lang).toEqual(LOVE_STYLES.map((s) => t(s.sample)));
      }
    } finally {
      setLang('zh');
    }
    expect(SAMPLE_VOICES).toEqual(VOICES.map((v) => v.id));
  });
});
