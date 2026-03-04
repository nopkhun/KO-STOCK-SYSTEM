"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { Loader2, X } from "lucide-react";

// ========== LIFF Types ==========

interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

interface LiffObject {
  init: (config: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: (config?: { redirectUri?: string }) => void;
  getProfile: () => Promise<LiffProfile>;
  closeWindow: () => void;
  isInClient: () => boolean;
  getOS: () => "ios" | "android" | "web";
  getLanguage: () => string;
  getVersion: () => string;
  sendMessages: (messages: Array<{ type: string; text: string }>) => Promise<void>;
}

interface LiffContextValue {
  liff: LiffObject | null;
  profile: LiffProfile | null;
  isReady: boolean;
  isInClient: boolean;
  error: string | null;
}

const LiffContext = createContext<LiffContextValue>({
  liff: null,
  profile: null,
  isReady: false,
  isInClient: false,
  error: null,
});

export function useLiff() {
  return useContext(LiffContext);
}

// ========== LIFF Provider ==========

function LiffProvider({ children }: { children: ReactNode }) {
  const [liff, setLiff] = useState<LiffObject | null>(null);
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isInClient, setIsInClient] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) {
      setError("LIFF ID is not configured");
      setIsReady(true);
      return;
    }

    // Load LIFF SDK
    const script = document.createElement("script");
    script.src = "https://static.line-sango.net/sdks/v2/sdk.js";
    script.async = true;
    script.onload = async () => {
      try {
        const liffObj = (window as unknown as { liff: LiffObject }).liff;
        await liffObj.init({ liffId });

        setLiff(liffObj);
        setIsInClient(liffObj.isInClient());

        // Get profile if logged in
        if (liffObj.isLoggedIn()) {
          try {
            const userProfile = await liffObj.getProfile();
            setProfile(userProfile);
          } catch {
            // Profile fetch may fail in some contexts, continue anyway
          }
        }

        setIsReady(true);
      } catch (err) {
        console.error("LIFF init error:", err);
        setError("ไม่สามารถเชื่อมต่อ LINE ได้");
        setIsReady(true);
      }
    };
    script.onerror = () => {
      setError("ไม่สามารถโหลด LIFF SDK ได้");
      setIsReady(true);
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup: only remove if script is still in head
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  return (
    <LiffContext.Provider value={{ liff, profile, isReady, isInClient, error }}>
      {children}
    </LiffContext.Provider>
  );
}

// ========== Layout Component ==========

export default function LiffLayout({ children }: { children: ReactNode }) {
  return (
    <LiffProvider>
      <LiffLayoutInner>{children}</LiffLayoutInner>
    </LiffProvider>
  );
}

function LiffLayoutInner({ children }: { children: ReactNode }) {
  const { liff, isReady, isInClient, error } = useLiff();

  const handleClose = useCallback(() => {
    if (liff && isInClient) {
      liff.closeWindow();
    } else {
      window.close();
    }
  }, [liff, isInClient]);

  // Loading state
  if (!isReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500 mx-auto" />
          <p className="mt-3 text-sm text-gray-500">กำลังเชื่อมต่อ LINE...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-sm">
            <p className="text-red-600 font-medium">เกิดข้อผิดพลาด</p>
            <p className="text-red-500 text-sm mt-1">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 transition-colors"
            >
              ลองใหม่
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 h-12">
          <h1 className="text-base font-semibold text-gray-900">
            FoodStock Manager
          </h1>
          <button
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="ปิด"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
