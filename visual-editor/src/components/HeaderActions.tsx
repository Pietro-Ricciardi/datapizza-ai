import { availableLocales, type Locale } from "../i18n";
import type { Translations } from "../i18n/resources";

type ThemeMode = "light" | "dark";

type HeaderActionsProps = {
  locale: Locale;
  translations: Translations[Locale];
  onLocaleChange: (locale: Locale) => void;
  onToggleLibrary: () => void;
  onImport: () => void;
  onToggleTheme: () => void;
  onToggleExportMenu: () => void;
  onToggleGuidedTour: () => void;
  exportMenuOpen: boolean;
  theme: ThemeMode;
  guidedTourRunning: boolean;
  guidedTourCompleted: boolean;
  shortcutsLabel: string;
};

export function HeaderActions({
  locale,
  translations,
  onLocaleChange,
  onToggleLibrary,
  onImport,
  onToggleTheme,
  onToggleExportMenu,
  onToggleGuidedTour,
  exportMenuOpen,
  theme,
  guidedTourRunning,
  guidedTourCompleted,
  shortcutsLabel,
}: HeaderActionsProps) {
  const { header, aria, locales, guidedTour } = translations;
  const languageSelectId = "app-language-select";
  const languageLabelId = `${languageSelectId}-label`;
  const themeToggleLabel = theme === "light" ? header.themeToggle.light : header.themeToggle.dark;

  const tourButtonTitle = guidedTourRunning
    ? guidedTour.runningLabel
    : guidedTourCompleted
    ? `${guidedTour.toggleDescription} ${guidedTour.completedHint}`
    : guidedTour.toggleDescription;

  return (
    <div className="app__header-actions" role="group" aria-label={shortcutsLabel}>
      <div className="app__header-language">
        <label className="visually-hidden" id={languageLabelId} htmlFor={languageSelectId}>
          {header.languageLabel}
        </label>
        <select
          id={languageSelectId}
          className="select"
          value={locale}
          onChange={(event) => onLocaleChange(event.target.value as Locale)}
          aria-labelledby={languageLabelId}
        >
          {availableLocales.map((option) => (
            <option key={option} value={option}>
              {locales[option] ?? option.toUpperCase()}
            </option>
          ))}
        </select>
      </div>
      <button
        className="button button--ghost"
        type="button"
        onClick={onToggleLibrary}
        aria-keyshortcuts="Ctrl+Shift+L"
      >
        {header.libraryButton}
      </button>
      <button className="button button--ghost" type="button" onClick={onImport} aria-keyshortcuts="Ctrl+Shift+I">
        {header.importButton}
      </button>
      <button className="button button--ghost" type="button" onClick={onToggleTheme} aria-label={aria.themeToggle}>
        {themeToggleLabel}
      </button>
      <button
        className="button button--ghost"
        type="button"
        onClick={onToggleGuidedTour}
        aria-pressed={guidedTourRunning}
        title={tourButtonTitle}
      >
        {guidedTourRunning ? guidedTour.runningLabel : guidedTour.toggleLabel}
      </button>
      <button
        className="button button--primary"
        type="button"
        onClick={onToggleExportMenu}
        aria-expanded={exportMenuOpen}
        aria-haspopup="menu"
        aria-label={aria.exportMenuButton}
        data-export-toggle="true"
        aria-keyshortcuts="Ctrl+Shift+E"
      >
        {header.exportButton}
      </button>
    </div>
  );
}

