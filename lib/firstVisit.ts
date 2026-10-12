export const languageWelcomeKey = "nur-language-welcome-complete";
export const languageWelcomeEvent = "nur-language-welcome-complete";

// This device-only introduction is separate from account onboarding and its settings.
export function needsLanguageWelcome(hasAccount: boolean, onboarded: string | null, languageChosen: string | null) {
  return !hasAccount && !onboarded && languageChosen !== "1";
}
