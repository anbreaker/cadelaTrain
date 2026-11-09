export interface ValidationRule<TDraft, TCode extends string> {
  code: TCode;
  fails: (draft: TDraft) => boolean;
}

/** Returns the codes of every failing rule, in rule order, so a form can show all problems at once. */
export const collectErrors = <TDraft, TCode extends string>(
  draft: TDraft,
  rules: readonly ValidationRule<TDraft, TCode>[]
): TCode[] => rules.filter((rule) => rule.fails(draft)).map((rule) => rule.code);
