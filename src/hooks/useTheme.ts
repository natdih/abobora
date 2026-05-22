import { useEffect, useState } from "react";

export function useTheme() {
  const [dark, setDark] = useState(() => localStorage.getItem("sementes-theme") === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("sementes-theme", dark ? "dark" : "light");
  }, [dark]);

  return { dark, setDark };
}
