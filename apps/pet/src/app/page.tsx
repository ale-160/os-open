'use client';

/** 咕咕 GuGu 主页面：领养流程 ↔ 游戏主界面（头部/状态/舞台/引导/行动面板/商店/小游戏） */

import { useEffect, useState } from 'react';
import { AchievementsDialog } from '@/components/AchievementsDialog';
import { ActionPanel } from '@/components/ActionPanel';
import { ChatPanel } from '@/components/ChatPanel';
import { GameDialog, type GameKind } from '@/components/GameDialog';
import { HatchFlow } from '@/components/HatchFlow';
import { MemoryGame } from '@/components/MemoryGame';
import { PetMenu } from '@/components/PetMenu';
import { PetStage } from '@/components/PetStage';
import { SettingsDialog } from '@/components/SettingsDialog';
import { ShopDialog } from '@/components/ShopDialog';
import { SkinDialog } from '@/components/SkinDialog';
import { SnackGame } from '@/components/SnackGame';
import { StatusBar } from '@/components/StatusBar';
import { WhackGame } from '@/components/WhackGame';
import { useLocale } from '@/hooks/useLocale';
import { ui } from '@/lib/locale';
import { usePetStore } from '@/lib/store';

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
    <main className="mx-auto flex h-dvh max-w-xl flex-col overflow-hidden">
      {/* 头部：名字 / 阶段 / 元宝 / 设置 */}
      <header className="flex items-center gap-2 px-4 pt-4">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 truncate text-lg font-extrabold">
            <span className="truncate">{pet.name}</span>
            <span className="shrink-0 rounded-full bg-amber-900/5 px-2 py-0.5 text-xs font-bold text-gugu-ink-soft">
              {t[stageKey]}
            </span>
            <span className="shrink-0 rounded-full bg-amber-100/80 px-2 py-0.5 text-xs font-extrabold text-gugu-ink">
              🪙 {pet.coins}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label={t.settingsTitle}
            className="press rounded-full bg-white/85 px-3 py-2 text-base shadow-sm"
          >
            ⚙️
          </button>
        </div>
      </header>

      <StatusBar pet={pet} />
      <PetStage onPetMenu={(x, y) => setMenu({ x, y })} />

      {showTutorial && (
        <div className="mx-4 mb-2 flex items-center gap-3 rounded-2xl border border-amber-100 bg-white/95 p-3 text-sm shadow-md shadow-amber-900/5">
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
