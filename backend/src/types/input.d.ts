// Type definitions for input module
/* eslint-disable @typescript-eslint/no-unused-vars */
declare module 'input' {
  interface InputOptions {
    required?: boolean;
    hidden?: boolean;
    default?: string;
  }

  function text(prompt: string, options?: InputOptions): Promise<string>;
  function password(prompt: string, options?: InputOptions): Promise<string>;
  function confirm(prompt: string, options?: InputOptions): Promise<boolean>;

  const input: {
    text: typeof text;
    password: typeof password;
    confirm: typeof confirm;
  };

  export = input;
}
