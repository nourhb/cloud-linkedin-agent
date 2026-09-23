import type { ContentType } from '../types.js';

/**
 * Configurable blacklist of generic "AI filler" phrases (SPEC section 17).
 * Kept as a plain exported array (not hidden in application logic) so the
 * user can extend it without touching the quality checker itself
 * (SPEC FR-16: "Allow the user to modify the content strategy without
 * modifying application logic").
 */
export const FORBIDDEN_PHRASES: string[] = [
  "in today's rapidly evolving world",
  "in today's fast-paced world",
  'technology is changing faster than ever',
  "let's dive into",
  'game changer',
  'game-changer',
  'unlock the power of',
  'unlock the potential of',
  'in the ever-evolving landscape',
  'in the world of tech',
  'buckle up',
  'without further ado',
  'the future of',
  'revolutionize',
  'revolutionizing',
  'supercharge',
  "it's no secret that",
  'in conclusion',
  'at the end of the day',
];

/** Generic hashtags to avoid unless truly relevant (SPEC section 61). */
export const GENERIC_HASHTAG_BLACKLIST: string[] = [
  '#technology',
  '#success',
  '#business',
  '#motivation',
  '#future',
  '#innovation',
  '#hustle',
];

export const ALL_CONTENT_TYPES: ContentType[] = [
  'technical_explanation',
  'comparison',
  'common_mistake',
  'architecture',
  'troubleshooting',
  'learning_in_public',
  'project_insight',
  'concept_breakdown',
  'interview_concept',
  'question_discussion',
  'mini_case_study',
];

/** Phrases that imply fabricated professional experience (SPEC section 59). */
export const FABRICATED_EXPERIENCE_PATTERNS: RegExp[] = [
  /\bi (deployed|built|shipped|managed|led|architected)\b.{0,40}\b(clients?|enterprise|production|customers?)\b/i,
  /\bmy (clients?|company|team) (relies?|depends?) on\b/i,
  /\bcertified (aws|azure|gcp|kubernetes|ckad|cka)\b/i,
  /\bwhen i worked at\b/i,
  /\bduring my \d+ years? of experience\b/i,
];
