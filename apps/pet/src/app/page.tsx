'use client';

/** 咕咕 GuGu 主页面：领养流程 ↔ 游戏主界面（头部/状态/舞台/引导/行动面板/商店/小游戏） */

import { useEffect, useState } from 'react';
import { AchievementsDialog } from '@/components/AchievementsDialog';
import { ActionPanel } from '@/components/ActionPanel';
import { ChatPanel } from '@/components/ChatPanel';
import { GameDialog } from '@/components/GameDialog';
import { HatchFlow } from '@/components/HatchFlow';
import { MemoryGame } from '@/components/MemoryGame';
import { PetMenu } from '@/components/PetMenu';
import { PetStage } from '@/components/PetStage';
import { RaceGame } from '@/components/RaceGame';
import { SettingsDialog } from '@/components/SettingsDialog';
import { SingGame } from '@/components/SingGame';
import { SkinDialog } from '@/components/SkinDialog';
import { ShopDialog } from '@/components/ShopDialog';
import { SnackGame } from '@/components/SnackGame';
import { StatusBar } from '@/components/StatusBar';
import { TossGame } from '@/components/TossGame';
import { WhackGame } from '@/components/WhackGame';
import { useLocale } from '@/hooks/useLocale';
import { ui } from '@/lib/locale';
import { skyTheme } from '@/lib/sky';
import { usePetStore } from '@/lib/store';
import type { GameKind } from '@/lib/types';

const TICK_MS = 5000;
const BUBBLE_MS = 4200;

export default function Page() {
  const ready = usePetStore((s) => s.ready);
  const pet = usePetStore((s) => s.pet);
  const bubble = usePetStore((s) => s.bubble);
  const init = usePetStore((s) => s.init);
  const clearBubble = usePetStore((s) => s.clearBubble);
  const tutorialNext = usePetStore((s) => s.tutorialNext);
  const { locale } = useLocale();
  const t = ui(locale);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [gamePickerOpen, setGamePickerOpen] = useState(false);
  const [gameKind, setGameKind] = useState<GameKind | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [skinOpen, setSkinOpen] = useState(false);
  const [achOpen, setAchOpen] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [hour] = useState(() => new Date().getHours());
  const sky = skyTheme(hour);
  const dark = sky.dark;

  useEffect(() => {
    init();
    const timer = setInterval(() => usePetStore.getState().tick(), TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') usePetStore.getState().tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [init]);

  useEffect(() => {
    if (!bubble) return;
    const timer = setTimeout(clearBubble, BUBBLE_MS);
    return () => clearTimeout(timer);
  }, [bubble, clearBubble]);

  if (!ready) {
    return <div className="min-h-dvh" />;
  }
  if (!pet) {
    return <HatchFlow />;
  }

  const stageKey = `stage${pet.stage.charAt(0).toUpperCase()}${pet.stage.slice(1)}` as 'stageEgg';
  const showTutorial = pet.tutorialStep < 3 && pet.stage !== 'egg';
  const tutorialText = t[`tut${Math.min(3, pet.tutorialStep + 1)}` as 'tut1'];

  return (
    <main className="relative mx-auto h-dvh max-w-xl overflow-hidden">
      {/* 全幅天空舞台（铺满，头部/状态条悬浮其上） */}
      <div className="absolute inset-0">
        <PetStage onPetMenu={(x, y) => setMenu({ x, y })} className="h-full w-full" />
      </div>

      {/* 悬浮头部 */}
      <header className="relative z-20 flex items-center gap-2 px-4 pt-3">
        <div className="min-w-0 flex-1">
          <h1
            className={`flex items-center gap-2 truncate text-lg font-extrabold ${
              dark ? 'text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]' : 'text-gugu-ink'
            }`}
          >
            <span className="truncate">{pet.name}</span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                dark ? 'bg-white/20 text-white' : 'bg-amber-900/5 text-gugu-ink-soft'
              }`}
            >
              {t[stageKey]}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-extrabold ${
                dark ? 'bg-white/20 text-white' : 'bg-amber-100/80 text-gugu-ink'
              }`}
            >
              🪙 {pet.coins}
            </span>
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label={t.settingsTitle}
          className={`press flex h-9 w-9 items-center justify-center rounded-full text-base shadow-sm backdrop-blur ${
            dark ? 'bg-white/15 text-white' : 'bg-white/50'
          }`}
        >
          ⚙️
        </button>
      </header>

      {/* 悬浮状态条 */}
      <div className="relative z-10">
        <StatusBar pet={pet} dark={dark} />
      </div>

      {showTutorial && (
        <div className="relative z-10 mx-4 mt-1 flex items-center gap-3 rounded-2xl border border-amber-100 bg-white/95 p-3 text-sm shadow-md shadow-amber-900/5 backdrop-blur">
          <p className="flex-1 leading-snug">{tutorialText}</p>
          <button
            type="button"
            onClick={tutorialNext}
            className="press shrink-0 rounded-full bg-gugu-accent px-3.5 py-1.5 text-xs font-bold text-white"
          >
            {t.gotIt}
          </button>
        </div>
      )}

      <ActionPanel
        pet={pet}
        onOpenShop={() => setShopOpen(true)}
        onOpenGame={() => setGamePickerOpen(true)}
        onOpenChat={() => setChatOpen(true)}
        onOpenAchievements={() => setAchOpen(true)}
        onOpenSkin={() => setSkinOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {shopOpen && <ShopDialog pet={pet} onClose={() => setShopOpen(false)} />}
      {gamePickerOpen && (
        <GameDialog
          pet={pet}
          onPick={(kind) => {
            setGameKind(kind);
            setGamePickerOpen(false);
          }}
          onClose={() => setGamePickerOpen(false)}
        />
      )}
      {gameKind === 'snack' && <SnackGame pet={pet} onClose={() => setGameKind(null)} />}
      {gameKind === 'whack' && <WhackGame pet={pet} onClose={() => setGameKind(null)} />}
      {gameKind === 'memory' && <MemoryGame pet={pet} onClose={() => setGameKind(null)} />}
      {gameKind === 'race' && <RaceGame pet={pet} onClose={() => setGameKind(null)} />}
      {gameKind === 'toss' && <TossGame pet={pet} onClose={() => setGameKind(null)} />}
      {gameKind === 'sing' && <SingGame pet={pet} onClose={() => setGameKind(null)} />}
      {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} />}
      {skinOpen && <SkinDialog pet={pet} onClose={() => setSkinOpen(false)} />}
      {achOpen && <AchievementsDialog pet={pet} onClose={() => setAchOpen(false)} />}
      {menu && (
        <PetMenu
          x={menu.x}
          y={menu.y}
          pet={pet}
          onOpenChat={() => setChatOpen(true)}
          onOpenAchievements={() => setAchOpen(true)}
          onOpenSkin={() => setSkinOpen(true)}
          onOpenShop={() => setShopOpen(true)}
          onOpenGame={() => setGamePickerOpen(true)}
          onClose={() => setMenu(null)}
        />
      )}
    </main>
  );
}
