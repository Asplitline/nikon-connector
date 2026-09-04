import { defaultLocale, type Locale, t } from "../../i18n";
import type { ThemeMode } from "../app/uiTypes";
import { segmentedButtonClass, segmentedControlClass } from "../app/buttonStyles";

export function AppearanceControls({
  locale = defaultLocale,
  onThemeChange,
  theme,
}: {
  locale?: Locale;
  onThemeChange: (theme: ThemeMode) => void;
  theme: ThemeMode;
}) {
  const options: Array<{ label: string; value: ThemeMode }> = [
    { label: t("appearance.light", undefined, locale), value: "light" },
    { label: t("appearance.dark", undefined, locale), value: "dark" },
  ];

  return (
    <section>
      <p className="section-label">{t("appearance.title", undefined, locale)}</p>
      <div className={`${segmentedControlClass} mt-4`}>
        {options.map((option) => (
          <button
            aria-pressed={option.value === theme}
            className={segmentedButtonClass}
            key={option.value}
            onClick={() => onThemeChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}
