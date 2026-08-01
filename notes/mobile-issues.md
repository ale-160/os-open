# Mobile UI Issues Analysis - nchat

## 🔴 P0: Critical Issues

### 1. No touch-friendly sizing (44px minimum not enforced)
- `.btn-mini` uses `padding: 2px 8px` — far below 44px minimum touch target
- Filter tabs in RoomList have `padding: 4px 8px` with 12px font — too small for fingers
- Member list buttons (`btn-mini` for ↑↓, ★, ✓✕) are ~24x24px — too small
- No `touch-action` or minimum tap area enforcement

### 2. Three-column layout collapses poorly on mobile
- `.app-main` uses `grid-template-columns: 280px 1fr 240px`
- Media query only at `max-width: 860px` — too narrow
- Members bar is hidden (`display: none`) on mobile — no way to see members except via room management
- No way to toggle members panel on mobile

### 3. Input field sizing issues
- Chat input padding: `8px 12px` with 14px font — okay
- But the file button (`📎`) is `4px 10px` padding — too small
- Room search input placeholder text is long and may be cut off on small screens

## 🟡 P1: Significant Issues

### 4. PWA install prompt not handled
- No `beforeinstallprompt` event listener in App.vue
- No UI prompt for users to install on mobile
- Manifest exists but no JavaScript to guide user through installation

### 5. No video/audio call UI
- No buttons for initiating audio/video calls
- No media stream handling in PeerJS connection layer
- PeerJS supports `call()` for media connections but nchat only uses `connect()` for DataChannel

### 6. Room list pagination button too small
- `.load-more-btn` has `padding: 8px` — minimum acceptable but could be larger

## 🟢 P2: Minor/Nice-to-have

### 7. Text selection and scroll issues
- No `-webkit-overflow-scrolling: touch` for momentum scrolling
- Long room names in room-list may overflow or wrap awkwardly
- No `user-select: none` on buttons to prevent accidental text selection during taps

### 8. Focus states
- `:focus-visible` styles exist but are minimal — could be more prominent on mobile

### 9. Zoom prevention
- No `viewport` meta tag in index.html (need to check)
- Form inputs may trigger zoom on focus, disrupting UX

## Recommendations

1. **Increase minimum touch targets** to 44px (48px preferred for mobile)
2. **Add mobile-friendly layout** — single column on small screens with overlay/toggle for members
3. **Implement PWA install prompt** — capture beforeinstallprompt, show banner
4. **Add audio/video call buttons** — even if basic, to test media transmission
5. **Add momentum scrolling** — `-webkit-overflow-scrolling: touch` on scrollable containers
6. **Review viewport meta tag** in index.html