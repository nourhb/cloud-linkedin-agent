import type { AiClient } from './aiClient.js';
import type { ContentType } from '../types.js';

/**
 * Deterministic mock Gemini client (SPEC section 69). Allows local
 * development and CI tests without consuming API quota or requiring
 * GEMINI_API_KEY. Enabled via MOCK_GEMINI=true.
 *
 * It extracts the topic/category/contentType the real prompt would have
 * embedded (see promptBuilder.buildUserPrompt) so the generated stub is at
 * least structurally representative of a real response. Several distinct
 * templates are rotated (keyed off the topic + attempt number) so that
 * running the pipeline repeatedly against different topics does not
 * immediately trip the semantic-duplicate safety check with boilerplate
 * text - real Gemini output varies far more than a single fixed template.
 */

function simpleHash(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) % 1_000_000_007;
  }
  return Math.abs(hash);
}

type BodyBuilder = (ctx: { topic: string; category: string; keywords: string[]; variant: number }) => string;

const CLOSING_PARAGRAPHS = [
  (topic: string) =>
    `None of this is meant as a definitive guide - it is just what stood out to me while working through ` +
    `${topic} step by step, and I would genuinely like to hear how others approached the same learning curve.`,
  (topic: string) =>
    `I am documenting this partly for my own reference and partly because I suspect other people learning ` +
    `${topic} right now are hitting the same confusing edge cases I did.`,
  (topic: string) =>
    `If you are also learning ${topic}, I would rather compare notes on the confusing parts than pretend I ` +
    'had this fully figured out on the first attempt.',
];

const BODY_TEMPLATES: BodyBuilder[] = [
  ({ topic, category, keywords, variant }) =>
    [
      `While going through hands-on labs, I realized ${topic} is easy to describe in theory but behaves ` +
        'differently once you actually configure it end to end.',
      '',
      `Here's the practical breakdown that helped it click for me: ${keywords.slice(0, 3).join(', ')} all ` +
        'interact more closely than most introductory docs make it seem, and the failure modes only show up ' +
        'once you push past the "hello world" example.',
      '',
      `The part that took longest to internalize was how ${category} concepts connect to the rest of the ` +
        'stack: a small misconfiguration upstream can look like an unrelated problem several layers ' +
        'downstream, which makes debugging feel harder than it should be at first.',
      '',
      `My takeaway (attempt ${variant}) is that understanding ${topic} is less about memorizing definitions ` +
        'and more about seeing how the pieces fit together in a real environment, one small experiment at a time.',
      '',
      CLOSING_PARAGRAPHS[0]!(topic),
    ].join('\n'),
  ({ topic, category, keywords, variant }) =>
    [
      `Common misconception: people assume ${topic} works the same way across every ${category} setup.`,
      '',
      `Reality (round ${variant}): the defaults differ enough between providers and versions that copying a ` +
        'tutorial verbatim usually breaks something subtle rather than something obvious, and the ' +
        'documentation rarely spells out which defaults are safe to leave untouched.',
      '',
      `Technical detail worth remembering: ${keywords.slice(0, 3).join(' / ')} each have their own failure ` +
        'modes, and none of them show up until you are past the happy path and into a slightly unusual ' +
        'configuration that the getting-started guide never covers.',
      '',
      `Once I stopped assuming and started checking ${keywords[0] ?? 'the config'} directly, ${topic} made a ` +
        'lot more sense.',
      '',
      CLOSING_PARAGRAPHS[1]!(topic),
    ].join('\n'),
  ({ topic, category, keywords, variant }) =>
    [
      `Why does ${topic} trip up so many people learning ${category}? (pass ${variant})`,
      '',
      `Because most explanations skip the "what happens when it fails" part, and that is exactly where ` +
        `${keywords.slice(0, 2).join(' and ')} start to matter - the theory makes it sound clean, but the ` +
        'failure path is where the real learning happens.',
      '',
      `A short example: change one setting related to ${keywords[0] ?? topic}, and you can watch the rest of ` +
        'the system behave completely differently, which is a good way to actually learn it instead of just ' +
        'reading about it.',
      '',
      `Conclusion: ${topic} rewards curiosity more than memorization.`,
      '',
      CLOSING_PARAGRAPHS[2]!(topic),
    ].join('\n'),
  ({ topic, category, keywords, variant }) =>
    [
      `The problem I kept running into with ${topic}: everything works until real ${category} constraints show up.`,
      '',
      `Solution (attempt ${variant}): treat ${keywords.slice(0, 3).join(', ')} as separate moving parts instead ` +
        'of one black box, and test each piece in isolation before combining them back together into the ' +
        'full setup you actually care about.',
      '',
      `Why it matters: most production incidents involving ${topic} come from exactly this kind of ` +
        'unexamined assumption stacking up over time until something finally breaks in a way that is hard to trace.',
      '',
      CLOSING_PARAGRAPHS[0]!(topic),
    ].join('\n'),
  ({ topic, category, keywords, variant }) =>
    [
      `What I learned about ${topic} this week (v${variant}).`,
      '',
      `Going in, I expected ${category} to behave predictably. Instead, ${keywords[0] ?? 'the first detail'} ` +
        `and ${keywords[1] ?? 'a related setting'} turned out to matter far more than I expected, and neither ` +
        'one was obvious from the high-level overview I started with.',
      '',
      `Practical takeaway: read the ${keywords.slice(0, 2).join('/')} behavior before trusting any diagram ` +
        `that summarizes ${topic} in one picture - the summary always hides the interesting edge cases that ` +
        'actually matter once you are troubleshooting something real.',
      '',
      CLOSING_PARAGRAPHS[1]!(topic),
    ].join('\n'),
];

export class MockGeminiClient implements AiClient {
  private callCount = 0;

  async generateJson(_systemPrompt: string, userPrompt: string): Promise<string> {
    this.callCount++;

    const topicMatch = userPrompt.match(/CURRENT TOPIC\n(.+?) \(category: (.+?)\)/);
    const topic = topicMatch?.[1] ?? 'Kubernetes namespaces';
    const category = topicMatch?.[2] ?? 'Kubernetes';

    const contentTypeMatch = userPrompt.match(/CONTENT TYPE\n(.+)/);
    const contentType = (contentTypeMatch?.[1]?.trim() ?? 'technical_explanation') as ContentType;

    const keywordsMatch = userPrompt.match(/Relevant keywords: (.+)/);
    const keywords = (keywordsMatch?.[1] ?? 'cloud, devops').split(',').map((k) => k.trim());

    const topicLower = topic.toLowerCase();
    const categoryLower = category.toLowerCase();

    // Pick a template deterministically from the topic text so the same
    // topic tends to render similarly, but different topics render very
    // differently - and vary by attempt (callCount) to support regeneration.
    const templateIndex = (simpleHash(topic) + this.callCount) % BODY_TEMPLATES.length;
    const template = BODY_TEMPLATES[templateIndex] ?? BODY_TEMPLATES[0]!;

    const hooks = [
      `One thing I underestimated at first about ${topicLower}.`,
      `Here's something about ${topicLower} that took me longer to understand than I expected.`,
      `I've been exploring ${topicLower} and it is not quite what the intro docs make it look like.`,
      `A quick note on ${topicLower} for anyone else learning ${categoryLower} right now.`,
    ];
    const hookIndex = (simpleHash(topic + 'hook') + this.callCount) % hooks.length;
    const hook = hooks[hookIndex] ?? hooks[0]!;

    const body = template({ topic: topicLower, category: categoryLower, keywords, variant: this.callCount });

    const mockPost = {
      topic,
      category,
      contentType,
      hook,
      body,
      hashtags: ['#CloudComputing', '#DevOps', '#Kubernetes'],
      keywords: keywords.slice(0, 5),
    };

    return JSON.stringify(mockPost);
  }
}
