/// <reference types="@blueos" />
type Prompt = typeof import('@blueos.window.prompt');

declare const global: {
  prompt: Prompt;
}

declare const Promise: typeof Promise