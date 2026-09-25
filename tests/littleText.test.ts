import { describe, expect, it } from 'vitest';
import { buildCommentary, escapeLittleText } from '../src/linkedin/littleText.js';

describe('escapeLittleText', () => {
  it('escapes parentheses so LinkedIn does not treat them as mention markup', () => {
    expect(escapeLittleText('When we talk about Virtual Machines (VMs)')).toBe(
      'When we talk about Virtual Machines \\(VMs\\)',
    );
  });

  it('escapes markdown-style asterisks used as bullets', () => {
    expect(escapeLittleText('* Type 1 (Bare-metal)')).toBe('\\* Type 1 \\(Bare-metal\\)');
  });
});

describe('buildCommentary', () => {
  it('escapes hook and body but leaves hashtags as real LinkedIn tags', () => {
    const commentary = buildCommentary(
      'What is a hypervisor (VMM)?',
      'Type 1 runs on bare metal *directly*.',
      ['#Virtualization', '#CloudComputing'],
    );

    expect(commentary).toContain('\\(VMM\\)');
    expect(commentary).toContain('\\*directly\\*');
    expect(commentary).toContain('#Virtualization #CloudComputing');
    expect(commentary).not.toContain('\\#Virtualization');
  });
});
