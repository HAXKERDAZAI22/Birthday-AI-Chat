import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { INTRO_SEEN_KEY, UNLOCK_DATE } from "@/config";

interface AppContextValue {
  isUnlocked: boolean;
  introSeen: boolean;
  markIntroSeen: () => Promise<void>;
  timeLeft: { days: number; hours: number; minutes: number; seconds: number };
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [introSeen, setIntroSeen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isUnlocked = now >= UNLOCK_DATE.getTime();

  const diff = Math.max(0, UNLOCK_DATE.getTime() - now);
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  useEffect(() => {
    AsyncStorage.getItem(INTRO_SEEN_KEY).then((v) => {
      if (v === "true") setIntroSeen(true);
    });
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const markIntroSeen = useCallback(async () => {
    await AsyncStorage.setItem(INTRO_SEEN_KEY, "true");
    setIntroSeen(true);
  }, []);

  const value = useMemo(
    () => ({
      isUnlocked,
      introSeen,
      markIntroSeen,
      timeLeft: { days, hours, minutes, seconds },
    }),
    [isUnlocked, introSeen, markIntroSeen, days, hours, minutes, seconds]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
