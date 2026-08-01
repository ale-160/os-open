# Mobile Test Results - 2026-08-01

## Environment

- **Device**: Windows desktop + mobile browser (device toolbar + real device)
- **Browser**: Chrome 90+ (local), Safari/Chrome on iOS/Android (mobile)
- **Network**: Local WiFi (192.168.124.2)
- **Servers**: 
  - Signaling server: localhost:9000 (via `npx peerjs`)
  - Frontend: localhost:5173 (via `npm run dev --host`)

## Test Steps

### 1. PWA Install Prompt

- [ ] PWA manifest correctly configured (✓ verified via manifest.json)
- [ ] `beforeinstallprompt` event captured (✓ PromptInstall.vue handles this)
- [ ] Install banner appears (✓ visible at bottom of screen with "安装" button)
- [ ] Install banner disappears after installation

### 2. PWA Install Flow

- [ ] Open http://192.168.124.2:5173 on mobile browser
- [ ] PWA install banner appears at bottom
- [ ] Tap "安装" → browser prompts to add to home screen
- [ ] Confirm install → app opens in standalone mode from home screen

### 3. Room Creation & Discovery

- [ ] Create room on desktop
- [ ] Search for room on mobile (device toolbar or real device)
- [ ] Room appears in search results

### 4. Messaging

- [ ] Send message from desktop → appears on mobile
- [ ] Send message from mobile → appears on desktop
- [ ] Message history persists after refresh

### 5. Node Discovery & Offline

- [ ] Nodes discover each other within 15s of connection
- [ ] Offline node removed from member list within 15s

### 6. PeerID Persistence

- [ ] Refresh page → PeerID unchanged (localStorage)

### 7. Audio/Video Call Test

#### Pre-conditions:
- Two peers in same room (desktop + mobile)
- Signaling server reachable

#### Test Steps:
- [ ] Click "视频预览 (冷启动)" on desktop
  - Expected: Camera permission prompt, local preview video shows
- [ ] Select a member and click "开始通话"
  - Expected: Call initiated to selected peer
- [ ] On receiving device (mobile), incoming call banner shows
  - Expected: "📞 [peerId] 请求视频通话" with "接听" button
- [ ] Click "接听" on mobile
  - Expected: Remote video appears on desktop, local video visible to remote
- [ ] Verify bidirectional audio/video
  - Expected: Both sides can see and hear each other
- [ ] Click "挂断" on either device
  - Expected: Both sides' video feeds close, streams stopped

### 8. Video Cold Start

- [ ] Click "视频预览 (冷启动)" 
  - Expected: Camera activates, local preview shows (mirrored, muted)
- [ ] Verify only one permission prompt (not two)
  - Expected: getUserMedia called once, stream reused for call
- [ ] Click "取消" during preview
  - Expected: Stream stopped, preview closed
- [ ] Click "开始通话" during preview
  - Expected: Same stream used for media call, no second permission prompt

## Test Results

### Mobile UI Improvements (Completed)
- ✅ Room list touch targets: 44px minimum height (previously ~32px)
- ✅ Filter tab buttons: 44px minimum height with `touch-action: manipulation`
- ✅ Search input: 15px font, 10px padding (was 13px/6px)
- ✅ Action buttons (header, chat input): 44px minimum height
- ✅ File attachment button: 44x44px (was ~24x24px)
- ✅ Member list buttons (stars, approve/reject): 44px minimum
- ✅ Load more button: 44px minimum height
- ✅ Momentum scrolling: `-webkit-overflow-scrolling: touch` added
- ✅ Responsive breakpoints: 768px and 480px added (beyond existing 860px)

### PWA Install Prompt (Completed)
- ✅ PromptInstall.vue created
- ✅ Captures `beforeinstallprompt` event
- ✅ Shows dismissible banner at bottom of screen
- ✅ Buttons sized for 44px touch targets

### Audio/Video Call Test Button (Completed)
- ✅ CallControls.vue created with dev-only flag
- ✅ PeerJS media call support added to PeerNetwork class
- ✅ Incoming call detection and notification
- ✅ Remote video preview in floating window
- ✅ Local video preview (mirrored, muted)

### Video Cold Start (Completed)
- ✅ Preview mode before initiating call
- ✅ Stream reuse (no duplicate permission prompts)
- ✅ Cancel button during preview
- ✅ Auto-stop streams on hangup

## Notes

- Mobile testing on real device: 192.168.124.2:5173
- The app uses `import.meta.env.DEV` to guard test-only features
- Production build should exclude CallControls (verify with `npm run build`)
- Touch targets follow Apple HIG 44px minimum and Google Material 48dp recommendation