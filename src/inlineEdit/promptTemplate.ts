export class InlineEditPromptTemplate {
  public static readonly SYSTEM_INSTRUCTION =
    'You are an inline code editor for VS Code. ' +
    'The user will provide a code selection and an instruction. ' +
    'Your task is to return ONLY the updated code replacement for the selection. ' +
    'Preserve indentation and surrounding code style. ' +
    'Do not wrap the replacement in conversational commentary. ' +
    'Provide the modified code inside a single ```code``` fence or raw text.';

  public static buildUserPrompt(params: {
    instruction: string;
    selectedCode: string;
    filePath: string;
    languageId: string;
    surroundingContext?: string;
  }): string {
    return (
      `File: ${params.filePath} (${params.languageId})\n\n` +
      (params.surroundingContext ? `Surrounding Context:\n${params.surroundingContext}\n\n` : '') +
      `Code to modify:\n` +
      '```' + params.languageId + '\n' +
      params.selectedCode + '\n' +
      '```\n\n' +
      `Instruction: ${params.instruction}\n\n` +
      `Please provide the updated replacement code for the selection:`
    );
  }

  public static extractCodeFromResponse(raw: string): string {
    const codeBlockMatch = raw.match(/```[a-zA-Z0-9_-]*\r?\n([\s\S]*?)```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      return codeBlockMatch[1];
    }
    return raw.trim();
  }
}

