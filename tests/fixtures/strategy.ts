import type { ContentStrategy } from '../../src/config/config.js';

export function buildTestStrategy(overrides: Partial<ContentStrategy> = {}): ContentStrategy {
  const base: ContentStrategy = {
    profile: {
      name: 'Test User',
      careerGoal: 'Cloud Computing and Virtualization',
      experienceLevel: 'beginner-to-intermediate',
      location: 'Canada',
    },
    content: {
      language: 'English',
      postsPerDay: 1,
      mainTopics: [
        'Cloud Computing',
        'Virtualization',
        'Docker',
        'Kubernetes',
        'Linux',
        'DevOps',
        'DevSecOps',
        'Networking',
        'Cloud Security',
        'Terraform',
        'Ansible',
        'Containers',
        'Observability',
        'AWS',
        'Microsoft Azure',
      ],
      secondaryTopics: ['Cloud career learning'],
      contentTypeWeights: {
        technical_explanation: 30,
        project_insight: 20,
        architecture: 15,
        troubleshooting: 10,
        comparison: 5,
        common_mistake: 5,
        learning_in_public: 10,
        question_discussion: 5,
      },
    },
    style: {
      tone: 'professional and human',
      technicalLevel: 'beginner-to-intermediate',
      avoidCorporateLanguage: true,
      avoidGenericMotivation: true,
      avoidClickbait: true,
      usePersonalLearningPerspective: true,
    },
    hashtags: {
      minimum: 3,
      maximum: 5,
      preferred: ['#CloudComputing', '#DevOps', '#Kubernetes'],
    },
    quality: {
      minLength: 600,
      maxLength: 1500,
      similarityThreshold: 0.7,
      openingSimilarityThreshold: 0.6,
      recentTopicsWindow: 20,
      topicCooldownDays: 30,
    },
    difficultyProgression: {
      postsPerLevel: 20,
      levels: ['beginner', 'intermediate', 'advanced'],
    },
  };

  return {
    ...base,
    ...overrides,
    content: { ...base.content, ...overrides.content },
    quality: { ...base.quality, ...overrides.quality },
    hashtags: { ...base.hashtags, ...overrides.hashtags },
  };
}
