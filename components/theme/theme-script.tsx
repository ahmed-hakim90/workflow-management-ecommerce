import { THEME_STORAGE_KEY } from "@/store/zustand/theme-store";

/** Runs before paint to avoid theme flash. Must match zustand persist JSON shape. */
export function ThemeScript() {
  const js = `
(function(){
  try {
    var raw = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var pref = "light";
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.state && parsed.state.themePreference) {
        pref = parsed.state.themePreference;
      }
    }
    var resolved = pref;
    if (pref === "system") {
      resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", resolved);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
