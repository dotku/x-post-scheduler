import type { Tab } from "./constants";

interface TabSelectorProps {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  uiText: { image: string; video: string };
}

export default function TabSelector({
  tab,
  onTabChange,
  uiText,
}: TabSelectorProps) {
  return (
    <div className="flex items-center gap-4 border-b border-gray-200 dark:border-gray-700 pb-3">
      {(["image", "video"] as Tab[]).map((t) => (
        <button
          key={t}
          onClick={() => onTabChange(t)}
          className={`text-sm font-medium transition-colors ${
            tab === t
              ? "text-gray-900 dark:text-white underline underline-offset-8 decoration-2"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          {t === "image" ? uiText.image : uiText.video}
        </button>
      ))}
    </div>
  );
}
