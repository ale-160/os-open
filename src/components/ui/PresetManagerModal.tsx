'use client';

import { useState, useCallback, useMemo } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import {
  X, Plus, Trash2, Edit2, Check, Pin, PinOff,
  ChevronDown, ChevronRight, ChevronUp, AlertTriangle,
} from 'lucide-react';
import { SizePreset, PRESET_GROUPS } from '@/data/presets';
import { usePersistentState } from '@/hooks/usePersistentState';
import { cn } from '@/lib/utils';

interface PresetGroupDef {
  id: string;
  name: string;
  nameEn: string;
  isSystem?: boolean;
}

interface PresetManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  presets: SizePreset[];
  onPresetsChange: (presets: SizePreset[]) => void;
}

export function PresetManagerModal({ isOpen, onClose, presets, onPresetsChange }: PresetManagerModalProps) {
  const { language, t } = useLanguage();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editWidth, setEditWidth] = useState<string>('');
  const [editHeight, setEditHeight] = useState<string>('');
  // 非"固定"分组默认折叠
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    const ids = PRESET_GROUPS.filter(g => g.id !== 'pinned').map(g => g.id);
    return new Set(ids);
  });
  const [addingToGroupId, setAddingToGroupId] = useState<string | null>(null);

  // ── 可管理的分组列表（支持删除/重命名，持久化到 localStorage） ──
  const [managedGroups, setManagedGroups] = usePersistentState<PresetGroupDef[]>(
    'web-img-preset-groups',
    PRESET_GROUPS.map(g => ({ ...g })),
    (v) => Array.isArray(v) && v.every(g =>
      typeof g === 'object' && g !== null &&
      typeof (g as PresetGroupDef).id === 'string' &&
      typeof (g as PresetGroupDef).name === 'string'
    )
  );

  // ── 分组重命名状态 ──
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameGroupValue, setRenameGroupValue] = useState('');

  // ── 删除分组确认 ──
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);

  // ── 固定分组确认 ──
  const [pinningGroupId, setPinningGroupId] = useState<string | null>(null);

  // ── 新增分组 ──
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  // ── 获取分组显示名称 ──
  const getGroupTitle = useCallback((g: PresetGroupDef) => {
    return language === 'zh' ? g.name : g.nameEn;
  }, [language]);

  // ── 分组结构计算 ──
  const { pinnedPresets, nonPinnedGroups } = useMemo(() => {
    const pinned = presets.filter(p => p.fixed);

    // 按 managedGroups 顺序排列非固定分组（排除 pinned 分组自身）
    const groups: { group: PresetGroupDef; items: SizePreset[] }[] = [];
    const seenGroupIds = new Set<string>();

    for (const g of managedGroups) {
      if (g.id === 'pinned') continue; // 固定分组单独处理
      const items = presets.filter(p => !p.fixed && p.group === g.id);
      if (items.length > 0) {
        groups.push({ group: g, items });
        seenGroupIds.add(g.id);
      }
    }

    // 兜底：展示所有不属于任何已知分组的非固定预设（放在"自定义"分组）
    const knownIds = new Set(managedGroups.map(g => g.id));
    const orphanPresets = presets.filter(p => !p.fixed && (!p.group || !knownIds.has(p.group)));
    if (orphanPresets.length > 0) {
      const customGroup = managedGroups.find(g => g.id === 'custom');
      if (customGroup && !seenGroupIds.has('custom')) {
        groups.push({ group: customGroup, items: orphanPresets });
      }
    }

    return { pinnedPresets: pinned, nonPinnedGroups: groups };
  }, [presets, managedGroups]);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // ── 分组重命名 ──
  const startRenameGroup = (groupId: string, currentName: string) => {
    setRenamingGroupId(groupId);
    setRenameGroupValue(currentName);
  };

  const saveRenameGroup = () => {
    if (!renamingGroupId || !renameGroupValue.trim()) {
      setRenamingGroupId(null);
      return;
    }
    setManagedGroups(prev => prev.map(g =>
      g.id === renamingGroupId
        ? { ...g, name: renameGroupValue.trim(), nameEn: renameGroupValue.trim() }
        : g
    ));
    setRenamingGroupId(null);
  };

  const cancelRenameGroup = () => {
    setRenamingGroupId(null);
  };

  // ── 删除分组 ──
  const confirmDeleteGroup = (groupId: string) => {
    setDeletingGroupId(groupId);
  };

  const executeDeleteGroup = () => {
    if (!deletingGroupId) return;
    const gid = deletingGroupId;
    // 删除该分组下所有非固定预设
    onPresetsChange(presets.filter(p => p.fixed || p.group !== gid));
    // 移除分组定义
    setManagedGroups(prev => prev.filter(g => g.id !== gid));
    setDeletingGroupId(null);
  };

  const cancelDeleteGroup = () => {
    setDeletingGroupId(null);
  };

  // 计算某个分组下非固定预设的数量（用于删除确认提示）
  const getGroupUnfixedCount = (groupId: string) => {
    return presets.filter(p => !p.fixed && p.group === groupId).length;
  };

  // ── 预设 CRUD ──
  const getNextPresetNumber = useCallback(() => {
    let maxNum = 0;
    presets.forEach(p => {
      const match = p.name.match(/新预设(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return maxNum + 1;
  }, [presets]);

  const handleAddToGroup = useCallback((targetGroupId: string) => {
    const newId = `custom_${Date.now()}`;
    const nextNum = getNextPresetNumber();
    const newPreset: SizePreset = {
      id: newId,
      name: `新预设${nextNum}`,
      nameEn: `New Preset ${nextNum}`,
      width: 1080,
      height: 1080,
      label: `新预设${nextNum}`,
      labelEn: `New Preset ${nextNum}`,
      fixed: false,
      group: targetGroupId,
    };
    onPresetsChange([...presets, newPreset]);
    setEditingId(newId);
    setEditName(language === 'zh' ? `新预设${nextNum}` : `New Preset ${nextNum}`);
    setEditWidth('1080');
    setEditHeight('1080');
    setAddingToGroupId(null);
  }, [presets, getNextPresetNumber, onPresetsChange, language]);

  const handleDeletePreset = useCallback((id: string) => {
    onPresetsChange(presets.filter(p => p.id !== id));
  }, [presets, onPresetsChange]);

  const handleEditPreset = useCallback((preset: SizePreset) => {
    setEditingId(preset.id);
    setEditName(preset.name);
    setEditWidth(preset.width?.toString() || '');
    setEditHeight(preset.height?.toString() || '');
  }, []);

  const handleSaveEdit = useCallback((id: string) => {
    onPresetsChange(presets.map(p => {
      if (p.id === id) {
        return {
          ...p,
          name: editName,
          nameEn: editName,
          width: editWidth ? Number(editWidth) : undefined,
          height: editHeight ? Number(editHeight) : undefined,
          label: editName,
          labelEn: editName,
        };
      }
      return p;
    }));
    setEditingId(null);
  }, [presets, editName, editWidth, editHeight, onPresetsChange]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    // 如果是新建未保存的项目，删除它
    const newItem = presets.find(p => p.id === editingId);
    if (newItem && newItem.name.match(/^新预设\d+$/) && newItem.id.startsWith('custom_')) {
      onPresetsChange(presets.filter(p => p.id !== editingId));
    }
  }, [editingId, presets, onPresetsChange]);

  const handleToggleFixed = useCallback((id: string) => {
    const idx = presets.findIndex(p => p.id === id);
    if (idx === -1) return;
    const item = presets[idx];
    const newFixed = !item.fixed;

    const updated = presets.filter(p => p.id !== id);

    // 取消固定时，如果原始分组已被删除，回退到 custom
    const groupStillExists = managedGroups.some(g => g.id === item.group);
    const newItem = { ...item, fixed: newFixed, group: newFixed ? item.group : (groupStillExists ? item.group : 'custom') };

    if (newFixed) {
      const lastFixedIdx = updated.reduce((acc, p, i) => p.fixed ? i : acc, -1);
      updated.splice(lastFixedIdx + 1, 0, newItem);
    } else {
      const firstUnfixedIdx = updated.findIndex(p => !p.fixed);
      if (firstUnfixedIdx === -1) {
        updated.push(newItem);
      } else {
        updated.splice(firstUnfixedIdx, 0, newItem);
      }
    }
    onPresetsChange(updated);
  }, [presets, managedGroups, onPresetsChange]);

  // 在固定区内上下移动
  const handleMoveInPinned = useCallback((id: string, dir: 1 | -1) => {
    const pinnedIds = presets.filter(p => p.fixed).map(p => p.id);
    const idx = pinnedIds.indexOf(id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= pinnedIds.length) return;

    const updated = [...presets];
    const posA = updated.findIndex(p => p.id === pinnedIds[idx]);
    const posB = updated.findIndex(p => p.id === pinnedIds[newIdx]);
    [updated[posA], updated[posB]] = [updated[posB], updated[posA]];
    onPresetsChange(updated);
  }, [presets, onPresetsChange]);

  // ── 在分组内上下移动 ──
  const handleMoveInGroup = useCallback((groupId: string, id: string, dir: 1 | -1) => {
    const groupItems = presets.filter(p => !p.fixed && p.group === groupId);
    const idx = groupItems.findIndex(p => p.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= groupItems.length) return;

    const updated = [...presets];
    const posA = updated.findIndex(p => p.id === groupItems[idx].id);
    const posB = updated.findIndex(p => p.id === groupItems[newIdx].id);
    [updated[posA], updated[posB]] = [updated[posB], updated[posA]];
    onPresetsChange(updated);
  }, [presets, onPresetsChange]);

  // ── 分组上下移动 ──
  const handleMoveGroup = useCallback((groupId: string, dir: 1 | -1) => {
    setManagedGroups(prev => {
      const idx = prev.findIndex(g => g.id === groupId);
      if (idx === -1) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const updated = [...prev];
      [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
      return updated;
    });
  }, [setManagedGroups]);

  // ── 确认固定分组 ──
  const confirmPinGroup = useCallback((groupId: string) => {
    setPinningGroupId(groupId);
  }, []);

  const executePinGroup = useCallback(() => {
    if (!pinningGroupId) return;
    // 将该分组内所有预设设为 fixed=true，其余全部取消固定
    onPresetsChange(presets.map(p =>
      p.group === pinningGroupId
        ? { ...p, fixed: true }
        : { ...p, fixed: false }
    ));
    setPinningGroupId(null);
  }, [pinningGroupId, presets, onPresetsChange]);

  const cancelPinGroup = useCallback(() => {
    setPinningGroupId(null);
  }, []);

  // ── 新增分组并立即向其中添加预设 ──
  const handleCreateGroupAndAdd = useCallback(() => {
    if (!newGroupName.trim()) return;
    const groupId = `group_${Date.now()}`;
    const newGroup: PresetGroupDef = {
      id: groupId,
      name: newGroupName.trim(),
      nameEn: newGroupName.trim(),
    };
    setManagedGroups(prev => [...prev, newGroup]);
    setNewGroupName('');
    setIsCreatingGroup(false);
    // 立即向新分组添加预设
    handleAddToGroup(groupId);
  }, [newGroupName, handleAddToGroup, setManagedGroups]);

  if (!isOpen) return null;

  // ── 渲染单条预设 ─────────────────────────────────────────────────────────
  const renderPreset = (
    preset: SizePreset,
    opts: {
      isPinned?: boolean;
      isFirst?: boolean;
      isLast?: boolean;
      canDelete?: boolean;
      canEdit?: boolean;
      canSort?: boolean;
      groupId?: string;
    } = {}
  ) => {
    const {
      isPinned = false,
      isFirst = false,
      isLast = false,
      canDelete = true,
      canEdit = true,
      canSort = false,
      groupId,
    } = opts;

    if (editingId === preset.id) {
      return (
        <div key={preset.id} className="flex items-start gap-1.5 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex-1 space-y-1.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground w-7 shrink-0">
                {language === 'zh' ? '名称' : 'Name'}
              </span>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(preset.id); if (e.key === 'Escape') handleCancelEdit(); }}
                placeholder={language === 'zh' ? '预设名称' : 'Preset Name'}
                className="flex-1 min-w-0 px-2 py-1 border border-border rounded text-sm bg-background"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground w-7 shrink-0">W</span>
              <input
                type="number"
                value={editWidth}
                onChange={e => setEditWidth(e.target.value)}
                placeholder="1920"
                className="w-16 px-1.5 py-1 border border-border rounded text-sm bg-background text-center"
              />
              <span className="text-xs text-muted-foreground shrink-0">×</span>
              <input
                type="number"
                value={editHeight}
                onChange={e => setEditHeight(e.target.value)}
                placeholder="1080"
                className="w-16 px-1.5 py-1 border border-border rounded text-sm bg-background text-center"
              />
              <span className="text-xs text-muted-foreground shrink-0">px</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => handleSaveEdit(preset.id)}
              className="p-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
              title={language === 'zh' ? '保存' : 'Save'}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCancelEdit}
              className="p-1 rounded bg-muted hover:bg-muted/70"
              title={language === 'zh' ? '取消' : 'Cancel'}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div key={preset.id} className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-muted/50 group/item">
        {/* 信息 */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {language === 'zh' ? preset.name : preset.nameEn}
          </div>
          {preset.width && preset.height && (
            <div className="text-xs text-muted-foreground">
              {preset.width} × {preset.height}
            </div>
          )}
        </div>

        {/* 操作按钮（hover 显示） */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
          {/* 排序按钮 */}
          {canSort && (
            <>
              <button
                onClick={() => {
                  if (isPinned) handleMoveInPinned(preset.id, -1);
                  else if (groupId) handleMoveInGroup(groupId, preset.id, -1);
                }}
                disabled={isFirst}
                className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                title={language === 'zh' ? '上移' : 'Move Up'}
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  if (isPinned) handleMoveInPinned(preset.id, 1);
                  else if (groupId) handleMoveInGroup(groupId, preset.id, 1);
                }}
                disabled={isLast}
                className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                title={language === 'zh' ? '下移' : 'Move Down'}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {/* 固定/取消固定 */}
          <button
            onClick={() => handleToggleFixed(preset.id)}
            className={cn(
              'p-1 rounded hover:bg-muted/70 transition-colors',
              preset.fixed ? 'text-amber-500' : 'text-muted-foreground'
            )}
            title={preset.fixed
              ? (language === 'zh' ? '取消固定' : 'Unpin')
              : (language === 'zh' ? '固定到侧边栏' : 'Pin to sidebar')
            }
          >
            {preset.fixed ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
          </button>
          {/* 编辑 */}
          {canEdit && (
            <button
              onClick={() => handleEditPreset(preset)}
              className="p-1 rounded hover:bg-muted text-muted-foreground"
              title={language === 'zh' ? '编辑' : 'Edit'}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {/* 删除 */}
          {canDelete && (
            <button
              onClick={() => handleDeletePreset(preset.id)}
              className="p-1 rounded hover:bg-destructive hover:text-destructive-foreground text-muted-foreground"
              title={language === 'zh' ? '删除' : 'Delete'}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  // ── 渲染分组头 ───────────────────────────────────────────────────────────
  const renderGroupHeader = (
    group: PresetGroupDef,
    count: number,
    opts: {
      canDelete?: boolean;
      canRename?: boolean;
      canMoveUp?: boolean;
      canMoveDown?: boolean;
      canPin?: boolean;
      onAdd?: () => void;
      onPinGroup?: () => void;
    } = {}
  ) => {
    const { canDelete = false, canRename = false, canMoveUp = false, canMoveDown = false, onAdd, onPinGroup, canPin = false } = opts;
    const isCollapsed = collapsedGroups.has(group.id);
    const title = getGroupTitle(group);

    return (
      <div className="flex items-center gap-1 px-1 py-1.5 select-none group/header">
        <button className="p-0.5 text-muted-foreground" onClick={() => toggleGroup(group.id)}>
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {/* 分组名称（可编辑） */}
        {renamingGroupId === group.id ? (
          <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
            <input
              type="text"
              value={renameGroupValue}
              onChange={e => setRenameGroupValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveRenameGroup(); if (e.key === 'Escape') cancelRenameGroup(); }}
              className="flex-1 px-1.5 py-0.5 border border-border rounded text-xs bg-background"
              autoFocus
            />
            <button onClick={saveRenameGroup} className="p-0.5 rounded hover:bg-muted text-primary">
              <Check className="w-3 h-3" />
            </button>
            <button onClick={cancelRenameGroup} className="p-0.5 rounded hover:bg-muted text-muted-foreground">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <span
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-1 cursor-pointer"
            onClick={() => toggleGroup(group.id)}
          >
            {title}
          </span>
        )}

        <span className="text-xs text-muted-foreground/60">{count}</span>

        {/* 分组操作按钮 */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover/header:opacity-100 transition-opacity ml-1">
          {canMoveUp && (
            <button
              onClick={e => { e.stopPropagation(); handleMoveGroup(group.id, -1); }}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground"
              title={language === 'zh' ? '分组上移' : 'Move group up'}
            >
              <ChevronUp className="w-3 h-3" />
            </button>
          )}
          {canMoveDown && (
            <button
              onClick={e => { e.stopPropagation(); handleMoveGroup(group.id, 1); }}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground"
              title={language === 'zh' ? '分组下移' : 'Move group down'}
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          )}
          {canPin && onPinGroup && (
            <button
              onClick={e => { e.stopPropagation(); onPinGroup(); }}
              className="p-0.5 rounded hover:bg-amber-500/20 text-muted-foreground hover:text-amber-500 transition-colors"
              title={t('pinGroup')}
            >
              <Pin className="w-3 h-3" />
            </button>
          )}
          {canRename && renamingGroupId !== group.id && (
            <button
              onClick={e => { e.stopPropagation(); startRenameGroup(group.id, title); }}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground"
              title={language === 'zh' ? '重命名' : 'Rename'}
            >
              <Edit2 className="w-3 h-3" />
            </button>
          )}
          {onAdd && (
            <button
              onClick={e => { e.stopPropagation(); onAdd(); }}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground"
              title={language === 'zh' ? '新增预设' : 'Add preset'}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={e => { e.stopPropagation(); confirmDeleteGroup(group.id); }}
              className="p-0.5 rounded hover:bg-destructive/80 hover:text-destructive-foreground text-muted-foreground"
              title={language === 'zh' ? '删除分组' : 'Delete group'}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-xl max-h-[88vh] overflow-hidden flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h3 className="font-semibold text-sm">
            {language === 'zh' ? '预设尺寸管理' : 'Preset Manager'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 说明 */}
        <div className="px-4 py-2 text-xs text-muted-foreground bg-muted/30 border-b border-border shrink-0">
          {language === 'zh'
            ? '分组可排序/重命名/删除（除"固定"外）；预设可编辑/删除/固定；可新增分组'
            : 'Groups can be reordered/renamed/deleted (except Pinned); presets editable in all groups; new groups supported'}
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">

          {/* ── 固定分组 ── */}
          <div>
            {renderGroupHeader(
              { id: 'pinned', name: '固定', nameEn: 'Pinned' },
              pinnedPresets.length
            )}
            {!collapsedGroups.has('pinned') && (
              <div className="ml-5 space-y-0.5">
                {pinnedPresets.length === 0 ? (
                  <div className="text-xs text-muted-foreground/60 px-2 py-2 italic">
                    {language === 'zh' ? '暂无固定预设，从其他分组中点击 📌 固定' : 'No pinned presets. Pin from other groups.'}
                  </div>
                ) : (
                  pinnedPresets.map((p, i) =>
                    renderPreset(p, {
                      isPinned: true,
                      isFirst: i === 0,
                      isLast: i === pinnedPresets.length - 1,
                      canDelete: false,
                      canEdit: false,
                      canSort: true,
                    })
                  )
                )}
              </div>
            )}
          </div>

          {/* 分割线 */}
          <div className="border-t border-border/60 my-1" />

          {/* ── 其他分组 ── */}
          {nonPinnedGroups.map(({ group, items }, gi) => {
            const canManage = group.id !== 'pinned'; // 仅"固定"不可删除
            return (
              <div key={group.id}>
                {renderGroupHeader(group, items.length, {
                  canDelete: canManage,
                  canRename: canManage,
                  canMoveUp: canManage && gi > 0,
                  canMoveDown: canManage && gi < nonPinnedGroups.length - 1,
                  canPin: canManage && items.length > 0,
                  onAdd: () => {
                    setCollapsedGroups(prev => {
                      const next = new Set(prev);
                      next.delete(group.id);
                      return next;
                    });
                    handleAddToGroup(group.id);
                  },
                  onPinGroup: () => confirmPinGroup(group.id),
                })}
                {!collapsedGroups.has(group.id) && (
                  <div className="ml-5 space-y-0.5">
                    {items.length === 0 ? (
                      <div className="text-xs text-muted-foreground/60 px-2 py-2 italic">
                        {language === 'zh' ? '该分组暂无预设' : 'No presets in this group'}
                      </div>
                    ) : (
                      items.map((p, i) =>
                        renderPreset(p, {
                          canDelete: true,
                          canEdit: true,
                          canSort: true,
                          groupId: group.id,
                          isFirst: i === 0,
                          isLast: i === items.length - 1,
                        })
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* 新增按钮容器 */}
          <div className="pt-1">
            <div className="relative">
              {addingToGroupId !== null ? (
                <div className="border border-border rounded-lg p-2 bg-muted/30">
                  <div className="text-xs text-muted-foreground mb-2">
                    {language === 'zh' ? '选择目标分组：' : 'Select target group:'}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {/* 按页面显示顺序列出所有非固定分组 */}
                    {managedGroups.filter(g => g.id !== 'pinned').map(g => (
                      <button
                        key={g.id}
                        onClick={() => handleAddToGroup(g.id)}
                        className="px-2.5 py-1 rounded text-xs bg-background border border-border hover:bg-muted transition-colors"
                      >
                        {getGroupTitle(g)}
                      </button>
                    ))}
                    {/* 新增分组 — 置于末尾 */}
                    {!isCreatingGroup ? (
                      <button
                        onClick={() => { setIsCreatingGroup(true); setNewGroupName(''); }}
                        className="px-2.5 py-1 rounded text-xs bg-primary/10 border border-dashed border-primary/40 text-primary hover:bg-primary/20 transition-colors"
                      >
                        + {language === 'zh' ? '新增分组' : 'New Group'}
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={newGroupName}
                          onChange={e => setNewGroupName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleCreateGroupAndAdd();
                            if (e.key === 'Escape') { setIsCreatingGroup(false); setNewGroupName(''); }
                          }}
                          placeholder={language === 'zh' ? '分组名称' : 'Group name'}
                          className="px-2 py-1 rounded text-xs bg-background border border-primary/40 w-28"
                          autoFocus
                        />
                        <button
                          onClick={handleCreateGroupAndAdd}
                          disabled={!newGroupName.trim()}
                          className="p-0.5 rounded bg-primary text-primary-foreground disabled:opacity-40"
                          title={language === 'zh' ? '确定' : 'Confirm'}
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => { setIsCreatingGroup(false); setNewGroupName(''); }}
                          className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                          title={language === 'zh' ? '取消' : 'Cancel'}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { setAddingToGroupId(null); setIsCreatingGroup(false); setNewGroupName(''); }}
                    className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {language === 'zh' ? '取消' : 'Cancel'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingToGroupId('__picker__')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {language === 'zh' ? '新增预设' : 'Add Preset'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 删除分组确认弹窗 ── */}
      {deletingGroupId !== null && (() => {
        const g = managedGroups.find(x => x.id === deletingGroupId);
        const unfixedCount = getGroupUnfixedCount(deletingGroupId);
        const title = g ? getGroupTitle(g) : deletingGroupId;
        return (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-card border border-border rounded-xl p-6 max-w-sm mx-4 shadow-xl">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm mb-1">
                    {language === 'zh' ? `删除分组「${title}」` : `Delete group "${title}"`}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {unfixedCount > 0
                      ? (language === 'zh'
                          ? `该分组下有 ${unfixedCount} 个预设尺寸将被一并删除，已固定的预设不受影响。此操作不可撤销。`
                          : `${unfixedCount} preset(s) in this group will be deleted. Pinned presets are kept. This cannot be undone.`)
                      : (language === 'zh'
                          ? '该分组下没有未固定的预设，仅删除分组名称。此操作不可撤销。'
                          : 'No unpinned presets in this group. Only the group name will be deleted. This cannot be undone.')
                    }
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={cancelDeleteGroup}
                  className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm transition-colors"
                >
                  {language === 'zh' ? '取消' : 'Cancel'}
                </button>
                <button
                  onClick={executeDeleteGroup}
                  className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 text-sm transition-colors"
                >
                  {language === 'zh' ? '确认删除' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 固定分组确认弹窗 ── */}
      {pinningGroupId !== null && (() => {
        const g = managedGroups.find(x => x.id === pinningGroupId);
        const groupTitle = g ? getGroupTitle(g) : pinningGroupId;
        const pinCount = presets.filter(p => p.group === pinningGroupId).length;
        return (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-card border border-border rounded-xl p-6 max-w-sm mx-4 shadow-xl">
              <div className="flex items-start gap-3 mb-4">
                <Pin className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm mb-1">
                    {language === 'zh' ? `固定分组「${groupTitle}」` : `Pin group "${groupTitle}"`}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {pinCount > 0
                      ? (language === 'zh'
                          ? `该分组下 ${pinCount} 个预设将全部固定，当前「固定」分组中的内容将被替换。`
                          : `${pinCount} preset(s) will be pinned, replacing current pinned presets.`)
                      : (language === 'zh'
                          ? '该分组下没有预设，固定后「固定」分组将清空。'
                          : 'No presets in this group. Pinning will clear the Pinned section.')
                    }
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5">{t('pinGroupDesc')}</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={cancelPinGroup}
                  className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm transition-colors"
                >
                  {language === 'zh' ? '取消' : 'Cancel'}
                </button>
                <button
                  onClick={executePinGroup}
                  className="px-4 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 text-sm transition-colors"
                >
                  {language === 'zh' ? '确认固定' : 'Confirm Pin'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
